import type { ApiTransaction, IHiveChainInterface, ITransaction, TTransactionPackType } from "@hiveio/wax";
import { proxy, wrap, type Endpoint, type Remote, type Local } from "comlink";
import { AuthorizationError, CheckRequiredError, GenericError } from "./errors";
import type { PasskeyError } from "./errors";
import { isSupportSharedWorker, isSupportWebWorker } from "./environment";
import { withTimeout, DEFAULT_INIT_TIMEOUT } from "./utils";
import {
  isPasskeySupported as checkPasskeySupport,
  getPasskeyRecord,
  loadPasskeyRecord,
  registerPasskey as registerPasskeyCredential,
  recoverPasswordWithPasskey,
  recoverPasswordWithRecord,
  removePasskeyRecord,
  type PasskeyRecord,
} from "./passkey";
import type {
  Auth,
  WorkerExpose,
  AuthUser,
  KeyAuthorityType,
  UserSettings,
} from "./worker";
export type {
  AuthUser,
  KeyAuthorityType,
  AuthorizationError,
  CheckRequiredError,
  PasskeyError,
  PasskeyRecord,
};

export interface RegisterOptions {
  /**
   * Whether `sign` refuses active and owner keys for this wallet, so that each
   * such signature needs {@link Client.signWithCheck}. Applies when the call
   * creates the wallet; adding a key to an existing wallet keeps its setting.
   * @defaultValue `false`
   */
  requireActiveCheck?: boolean;
}

/**
 * What proves the user for a check: the wallet password, or a passkey
 * registered with {@link Client.registerPasskey}. Read the passkey record with
 * {@link Client.loadPasskey} before the user's gesture; the check then asks the
 * authenticator first thing, as Safari needs. `userVerification` defaults to
 * `"required"`, and an assertion without the user-verified flag is refused.
 */
export type CheckCredential =
  | { password: string }
  | {
      passkey: PasskeyRecord;
      userVerification?: UserVerificationRequirement;
    };

// Starts the authenticator synchronously, before anything else is awaited.
async function passwordOf(credential: CheckCredential): Promise<string> {
  if ("password" in credential) return credential.password;
  return await recoverPasswordWithRecord(
    credential.passkey,
    credential.userVerification ?? "required",
  );
}

export interface AuthStatus {
  /**
   * Value that describes auth status
   * @type {boolean}
   */
  ok: boolean;
  /**
   * An error in case of unsuccessful authorization
   */
  error?: AuthorizationError | null;
}

export interface ClientOptions {
  /**
   * Url for worker script path provided by hb-auth library
   * @type {string}
   * @defaultValue `"/auth/worker.js"`
   */
  workerUrl: string;
  /**
   * Session timeout (in seconds) for Wallet, after that session will be destroyed and user must authenticate again
   * @type {number}
   * @defaultValue `900`
   */
  sessionTimeout: number;
  /**
   * Initialization timeout (in milliseconds) for worker and WASM loading.
   * If initialization takes longer than this, it will fail with a timeout error.
   * @type {number}
   * @defaultValue `30000` (30 seconds)
   */
  initTimeout: number;
}

/* @hidden */
const defaultOptions: ClientOptions = {
  workerUrl: "/auth/worker.js",
  sessionTimeout: 900,
  initTimeout: DEFAULT_INIT_TIMEOUT,
};

/**
 * Authorisation base client
 */
abstract class Client {
  /** @hidden */
  #worker!: Remote<WorkerExpose>;
  /** @hidden */
  #options!: ClientOptions;
  /** @hidden */
  #auth!: Local<Auth>;
  /** @hidden */
  protected hiveChain!: IHiveChainInterface;
  /** @hidden */
  #sessionEndCallback: () => Promise<void> = async () => {};

  /** @hidden */
  protected set options(options: ClientOptions) {
    this.#options = { ...this.#options, ...options };
  }

  /** @hidden */
  protected get options(): ClientOptions {
    return this.#options;
  }

  /**
   * @hidden
   * Authentication method to implement in derived classes
   * based on authentication type
   */
  protected abstract authorize(
    username: string,
    txBuilder: ITransaction,
    keyType: KeyAuthorityType,
    isStrict?: boolean,
  ): Promise<boolean>;

  /**
   * Additional options for auth client
   * @param strict @type {boolean} - Strict authorization by checking if public key in signature matches user's public key, so other authorities will be ignored. Note that this doesn't affect OfflineClient's behaviour.
   * @param clientOptions @type {ClientOptions} - Options
   */
  constructor(clientOptions: Partial<ClientOptions> = {}) {
    this.options = { ...defaultOptions, ...clientOptions };
    if (!isSupportWebWorker) {
      throw new GenericError(
        `WebWorker support is required for running this library.
         Your browser/environment does not support WebWorkers.`,
      );
    }
  }

  /** @hidden */
  private async loadWebWorker(): Promise<void> {
    if (this.#worker) return;
    this.#worker = wrap<WorkerExpose>(await this.getWorkerEndpoint());
  }

  private async getWorkerEndpoint(): Promise<Endpoint> {
    return new Promise((resolve, reject) => {
      try {
        let worker: SharedWorker | Worker;

        if (isSupportSharedWorker) {
          // extendedLifetime keeps the SharedWorker alive for 30s after all
          // tabs disconnect, surviving single-tab refresh. Chrome 148+, no-op
          // on browsers that don't support it.
          worker = new SharedWorker(this.options.workerUrl, {
            type: "module",
            /* @ts-expect-error -- extendedLifetime not yet in TS SharedWorkerOptions */
            extendedLifetime: true,
          });
          worker.onerror = (event) => {
            reject(
              new GenericError(
                `Failed to load auth worker: ${event.message || "Unknown error"}`,
              ),
            );
          };
          resolve(worker.port);
        } else {
          worker = new Worker(this.options.workerUrl, { type: "module" });
          worker.onerror = (event) => {
            reject(
              new GenericError(
                `Failed to load auth worker: ${event.message || "Unknown error"}`,
              ),
            );
          };
          resolve(worker);
        }
      } catch (err) {
        reject(
          new GenericError(
            `Failed to create auth worker: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    });
  }

  /** @hidden */
  protected getAuthInstance(): Local<Auth> {
    return this.#auth;
  }

  /**
   * Async method that prepares client to run.
   * That method should be called first before calling other methods.
   * @param hiveChain - The Hive chain interface instance (created via createHiveChain from @hiveio/wax)
   * @returns {InstanceType<Client>}
   */
  public async initialize(hiveChain: IHiveChainInterface): Promise<this> {
    const timeout = this.options.initTimeout;

    try {
      await withTimeout(
        this.loadWebWorker(),
        timeout,
        `Auth worker failed to load within ${timeout}ms. ` +
          `Check if ${this.options.workerUrl} exists and is accessible.`,
      );

      this.#auth = await withTimeout(
        new this.#worker.Auth(this.options.sessionTimeout),
        timeout,
        `Auth initialization timed out after ${timeout}ms. ` +
          `The WASM module may have failed to load.`,
      );

      this.hiveChain = hiveChain;

      return this;
    } catch (err) {
      // Cleanup on failure to allow re-initialization
      // @ts-expect-error Intentionally resetting to undefined for re-initialization
      this.#worker = undefined;
      // @ts-expect-error Intentionally resetting to undefined for re-initialization
      this.#auth = undefined;
      throw err;
    }
  }

  /**
   * Method to set callback for being notified on session and or logout action.
   * @param cb Async callback function that fires on session end
   * @returns {Promise<void>}
   */
  public async setSessionEndCallback(cb: () => Promise<void>): Promise<void> {
    this.#sessionEndCallback = cb;
    await this.#auth.setSessionEndCallback(proxy(this.#sessionEndCallback));
  }

  /**
   * Method to get all registered users with their active auth status.
   * If there is no user registered, it will return an empty array.
   * @deprecated Use @see {Client.getRegisteredUsers} instead.
   * @returns {Promise<AuthUser[]>}
   */
  public async getAuths(): Promise<AuthUser[]> {
    return await this.#auth.getAuths();
  }

  /**
   * Method to get auth status for a given user.
   * If there is no user it will return null.
   * @param username Username
   * @deprecated Use @see {Client.getRegisteredUserByUsername} instead.
   * @returns {Promise<AuthUser> | null}
   */
  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    return await this.#auth.getAuthByUser(username);
  }

  public async getUserSettings(username: string): Promise<UserSettings | null> {
    return await this.#auth.getUserSettings(username);
  }

  public async setUserSettings(
    username: string,
    settings: {
      strict: boolean;
      authorizedAccounts?: { [K in KeyAuthorityType]?: string };
    },
    keyType: KeyAuthorityType,
  ): Promise<void> {
    return await this.#auth.setUserSettings(username, settings, keyType);
  }

  /** @hidden */
  private async getVerificationTx(
    username: string,
    keyType: KeyAuthorityType,
    offline?: boolean,
  ): Promise<ITransaction> {
    let txBuilder: ITransaction;

    if (offline) {
      txBuilder = this.hiveChain.createTransactionWithTaPoS(
        "04e3256d94edee6ac72add19c1439260fbb00701",
        "+1m",
      );
    } else {
      txBuilder = await this.hiveChain.createTransaction("+1m");
    }

    if (keyType === "posting") {
      txBuilder.pushOperation({
        vote_operation: {
          voter: username,
          author: "author",
          permlink: "permlink",
          weight: 10000,
        },
      });
    } else if (keyType === "active") {
      txBuilder.pushOperation({
        limit_order_cancel_operation: { owner: username, orderid: 0 },
      });
    } else if (keyType === "owner") {
      txBuilder.pushOperation({
        decline_voting_rights_operation: { account: username, decline: false },
      });
    } else {
      throw new AuthorizationError(
        `Invalid key type. Only 'active', 'posting' or 'owner' key supported`,
      );
    }

    txBuilder.validate();

    return txBuilder;
  }

  /**
   * Method that registers a new user or adding
   * another key with different authority to existing user.
   * @param username Username
   * @param password Password
   * @param wifKey Private key
   * @param keyType Key authority type
   * @param options Options for a wallet this call creates
   * @returns {Promise<AuthStatus>}
   */
  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
    options: RegisterOptions = {},
    offline?: boolean,
  ): Promise<AuthStatus> {
    const txBuilder = await this.getVerificationTx(username, keyType, offline);
    const signature = await this.#auth.register(
      username,
      password,
      txBuilder.sigDigest,
      wifKey,
      keyType,
      strict,
      options.requireActiveCheck ?? false,
    );

    txBuilder.addSignature(signature);

    const authenticated = await this.authorize(
      username,
      txBuilder,
      keyType,
      strict,
    );

    if (authenticated) {
      await this.#auth.onAuthComplete(username, false);
      return Promise.resolve({ ok: true });
    } else {
      await this.#auth.onAuthComplete(username, true);
      return Promise.reject(new AuthorizationError("Invalid credentials"));
    }
  }

  /**
   * Method that authenticates an already registered user.
   * @param username Username
   * @param password Password
   * @param keyType Key authority type
   * @returns {Promise<AuthStatus>}
   */
  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
    offline?: boolean,
  ): Promise<AuthStatus> {
    try {
      const userSettings = await this.getUserSettings(username);
      const isStrict = userSettings?.strict[keyType] ?? true;

      // Create a verification transaction
      const txBuilder = await this.getVerificationTx(
        username,
        keyType,
        offline,
      );
      const signature = await this.#auth.authenticate(
        username,
        password,
        keyType,
        txBuilder.sigDigest,
      );

      txBuilder.addSignature(signature);
      const authenticated = await this.authorize(
        username,
        txBuilder,
        keyType,
        isStrict,
      );

      if (authenticated) {
        await this.#auth.onAuthComplete(username, false);
        return Promise.resolve({ ok: true });
      } else {
        await this.#auth.logout(username);
        return Promise.reject(new AuthorizationError("Invalid credentials"));
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Method that locks user session and keeps user session during session time.
   * Note that when user session time ends, user should authenticate again.
   */
  public async lock(): Promise<void> {
    await this.#auth.lock();
  }

  /**
   * Method that unlocks existing user's session.
   * This method will extend user's session time after unlocking.
   * This is different than authenticate method.
   * @param username Username
   * @param password Password
   */
  public async unlock(username: string, password: string): Promise<void> {
    await this.#auth.unlock(username, password);
  }

  /**
   * Method that imports a new key for given user
   * This method requires user to be authenticated or unlocked first
   * @param username Username
   * @param wifKey WIF key
   * @param keyType Key authority type
   * @returns {Promise<string>} Public Key
   */
  public async importKey(
    username: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    return await this.#auth.importKey(username, wifKey, keyType);
  }

  /**
   * Method that invalidates existing key for given user by creating a new alias with a timestamp
   * and removing the old alias. This is useful when user
   * wants to change their key but still wants to have old key mapped to their account.
   * @param username Username
   * @param keyType Key authority type
   */
  public async invalidateExistingKey(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await this.#auth.invalidateExistingKey(username, keyType);
  }

  /**
   * Method that ends existing user session. This is different than locking user.
   * When this is called any callback set via @see {Client.setSessionCallback} will fire.
   */
  public async logout(username: string): Promise<void> {
    await this.#auth.logout(username);
  }

  /**
   * Method that ends all user sessions.
   */
  public async logoutAll(): Promise<void> {
    await this.#auth.logoutAll();
  }

  /**
   * Method that signs given transaction as an authorized user based on selected authority type.
   * @param username Username
   * @param transactionDigest Transaction digest string
   * @param keyType Key authority type
   * @returns {Promise<string>} Signature
   * @throws {CheckRequiredError} For an active or owner key while the user's
   *   wallet requires a check before active-key operations; sign with
   *   {@link Client.signWithCheck} instead.
   */
  public async sign(
    username: string,
    transactionDigest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    try {
      return await this.#auth.sign(username, transactionDigest, keyType);
    } catch (error) {
      // Comlink delivers the worker's errors as plain Errors with their name.
      if (error instanceof Error && error.name === "CheckRequiredError") {
        throw new CheckRequiredError(error.message);
      }
      throw error;
    }
  }

  /**
   * Checks the password or a passkey without changing the user's session:
   * no logout, no session-end callback, and the wallet is not unlocked. Like
   * every unlock it restarts the session's idle clock, but it does not revive
   * an expired session. After a few wrong passwords in a row, through any call
   * that checks one, the user's wallet is locked.
   * @param username Username
   * @param credential Password or passkey
   * @throws {AuthorizationError} "Invalid credentials" for a wrong password
   * @throws {PasskeyError} If the passkey assertion fails or lacks a required flag
   */
  public async checkCredential(
    username: string,
    credential: CheckCredential,
  ): Promise<void> {
    const password = await passwordOf(credential);
    await this.#auth.checkPassword(username, password);
  }

  /**
   * Checks the password or a passkey, as {@link Client.checkCredential} does,
   * and signs one digest with the user's key of the given type, whether the
   * user's wallet is unlocked, locked or expired. Nothing is remembered: the
   * next operation needs its own check.
   * @param username Username
   * @param transactionDigest Transaction digest string
   * @param keyType Key authority type
   * @param credential Password or passkey
   * @returns {Promise<string>} Signature
   */
  public async signWithCheck(
    username: string,
    transactionDigest: string,
    keyType: KeyAuthorityType,
    credential: CheckCredential,
  ): Promise<string> {
    const password = await passwordOf(credential);
    return await this.#auth.signWithPassword(
      username,
      password,
      transactionDigest,
      keyType,
    );
  }

  /**
   * Whether the user's wallet requires a check before active-key operations.
   * While the wallet is unlocked the stored setting is verified; otherwise it
   * is reported as stored. A missing or tampered setting reads as `true`.
   * @param username Username
   */
  public async getRequireActiveCheck(username: string): Promise<boolean> {
    return await this.#auth.getRequireActiveCheck(username);
  }

  /**
   * Turns the check before active-key operations on or off for the user's
   * wallet. Either way it needs the password or a passkey; a failed check
   * leaves the setting unchanged.
   * @param username Username
   * @param requireActiveCheck New setting
   * @param credential Password or passkey
   */
  public async setRequireActiveCheck(
    username: string,
    requireActiveCheck: boolean,
    credential: CheckCredential,
  ): Promise<void> {
    const password = await passwordOf(credential);
    await this.#auth.setRequireActiveCheck(
      username,
      password,
      requireActiveCheck,
    );
  }

  /**
   * Method that signs given transaction as an authorized user based on selected authority type.
   * @param username Username
   * @param transactionDigest Transaction digest string
   * @param wifKey WIF key
   * @param keyType Key authority type
   * @returns {Promise<string>} Signature
   */
  public async singleSign(
    username: string,
    transactionDigest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    try {
      return await this.#auth.singleSign(
        username,
        transactionDigest,
        wifKey,
        keyType,
      );
    } catch (err) {
      return Promise.reject(
        new AuthorizationError(`Unexpected error: ${err as string}`),
      );
    }
  }

  /**
   * Method that returns all registered users with their active auth status.
   * @returns {Promise<AuthUser[]>}
   */
  public async getRegisteredUsers(): Promise<AuthUser[]> {
    return await this.#auth.getRegisteredUsers();
  }

  /**
   * Method that returns a registered user by username.
   * @param username Username
   * @returns {Promise<AuthUser | null>}
   */
  public async getRegisteredUserByUsername(
    username: string,
  ): Promise<AuthUser | null> {
    return await this.#auth.getRegisteredUserByUsername(username);
  }

  // -- Passkey / Biometric Unlock --

  /**
   * Check if the browser supports WebAuthn with PRF extension
   * for biometric unlock.
   */
  public async isPasskeySupported(): Promise<boolean> {
    return checkPasskeySupport();
  }

  /**
   * Check if a passkey is registered for the given user.
   */
  public async hasPasskey(username: string): Promise<boolean> {
    const record = await getPasskeyRecord(username);
    return record !== null;
  }

  /**
   * Register a passkey for biometric unlock. Encrypts the user's
   * password with a PRF-derived key so future unlocks can use
   * biometric instead of password entry.
   *
   * Should be called after a successful password authentication.
   * Requires two authenticator touches (one for credential creation,
   * one for PRF key derivation).
   *
   * @param username Username
   * @param password The user's current beekeeper password
   */
  public async registerPasskey(
    username: string,
    password: string,
  ): Promise<void> {
    await registerPasskeyCredential(username, password);
  }

  /**
   * Read the user's passkey for a {@link CheckCredential}. Call it before the
   * user's gesture, so that the check can ask the authenticator first thing.
   * @throws {PasskeyError} NO_PASSKEY_REGISTERED if the user has none
   */
  public async loadPasskey(username: string): Promise<PasskeyRecord> {
    return await loadPasskeyRecord(username);
  }

  /**
   * Remove a registered passkey for the given user.
   * The user will need to enter their password on next unlock.
   */
  public async removePasskey(username: string): Promise<void> {
    await removePasskeyRecord(username);
  }
}

/**
 * Auth client that doesn't
 * verify user's authority through the network. So, user has resposibility
 * for imported keys' validity.
 */
class OfflineClient extends Client {
  // simple auth based on wallet auth status
  protected async authorize(): Promise<boolean> {
    return true;
  }

  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
    options: RegisterOptions = {},
  ): Promise<AuthStatus> {
    return await super.register(
      username,
      password,
      wifKey,
      keyType,
      strict,
      options,
      true,
    );
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<AuthStatus> {
    return await super.authenticate(username, password, keyType, true);
  }

  public async biometricUnlock(
    username: string,
    keyType: KeyAuthorityType,
    userVerification?: UserVerificationRequirement,
  ): Promise<AuthStatus> {
    const password = await recoverPasswordWithPasskey(username, userVerification);
    return this.authenticate(username, password, keyType);
  }
}

/**
 * Auth client that additionally authorizes
 * user by verifying user's signature through the network.
 */
class OnlineClient extends Client {
  // TODO: This will be refactored after extension of blockchain
  // which is verify_authority will return authorized account also it will validate
  // strict in this api
  // !! THIS ALSO SHOULD USE AccountAuthority Interface to check if account has the given key easily
  protected async authorize(
    username: string,
    txBuilder: ITransaction,
    keyType: KeyAuthorityType,
    isStrict: boolean,
  ): Promise<boolean> {
    const verificationResult = await this.verify(txBuilder.toApiJson());

    if (!verificationResult) {
      return false;
    }

    const accounts = await this.hiveChain.api.database_api.find_accounts({
      accounts: [username],
    });

    const account = accounts.accounts[0]; // hive-1234
    const publicKey = txBuilder.signatureKeys[0];

    const key_references =
      await this.hiveChain.api.account_by_key_api.get_key_references({
        keys: [publicKey],
      }); // account[0][......authorityAccounts]

    if (isStrict) {
      const key_auth_match = account[keyType].key_auths.some((keyAuths) =>
        publicKey.endsWith(keyAuths[0]),
      );

      if (!key_auth_match) {
        return false;
      }

      const key_owners = key_references.accounts[0] || [];
      return key_owners.includes(username);
    } else {
      // When not in strict mode, check both key_auths and account_auths
      const key_auth_match = account[keyType].key_auths.some((keyAuths) =>
        publicKey.endsWith(keyAuths[0]),
      );

      if (!key_auth_match) {
        // If no direct key match, check if the key belongs to an authorized account

        let key_owner;

        for (const accountAuth of account[keyType].account_auths) {
          if (key_references.accounts[0]?.includes(accountAuth[0])) {
            key_owner = accountAuth[0];
            break;
          }
        }

        if (key_owner) {
          // Save the authorized account to user settings
          const currentSettings = (await this.getUserSettings(username)) ?? {
            strict: {},
            alias: username,
            authorizedAccounts: {},
          };

          const authorizedAccounts = currentSettings.authorizedAccounts ?? {};

          if (!authorizedAccounts[keyType]) {
            await this.setUserSettings(
              username, // hive-12345
              {
                strict: currentSettings.strict[keyType] ?? true,
                authorizedAccounts: {
                  ...authorizedAccounts,
                  [keyType]: key_owner,
                },
              },
              keyType,
            );
          }
        }

        return !!key_owner;
      }

      return true;
    }
  }

  private async verify(trx: ApiTransaction): Promise<boolean> {
    try {
      const response = await this.hiveChain.api.database_api.verify_authority({
        trx,
        pack: "hf26" as TTransactionPackType,
      });

      return response.valid;
    } catch (err) {
      // Log the error for debugging instead of silently swallowing it
      console.error(
        "[hb-auth] verify_authority failed:",
        err instanceof Error ? err.message : err,
      );
      return false;
    }
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<AuthStatus> {
    return await super.authenticate(username, password, keyType, false);
  }

  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
    options: RegisterOptions = {},
  ): Promise<AuthStatus> {
    return await super.register(
      username,
      password,
      wifKey,
      keyType,
      strict,
      options,
      false,
    );
  }

  /**
   * Unlock using biometric authentication (WebAuthn PRF).
   * Decrypts the stored password via passkey, then authenticates
   * through the normal flow. Falls back with PasskeyError if
   * biometric fails — caller should catch and show password dialog.
   *
   * @param username Username
   * @param keyType Key authority type
   * @param userVerification Level of verification:
   *   - "discouraged": minimal friction (blog/posting operations)
   *   - "preferred": biometric if available (default)
   *   - "required": always biometric/PIN (wallet/active/owner operations)
   * @returns {Promise<AuthStatus>}
   * @throws {PasskeyError} If biometric fails or no passkey registered
   */
  public async biometricUnlock(
    username: string,
    keyType: KeyAuthorityType,
    userVerification?: UserVerificationRequirement,
  ): Promise<AuthStatus> {
    const password = await recoverPasswordWithPasskey(username, userVerification);
    return this.authenticate(username, password, keyType);
  }
}

export { OnlineClient, OfflineClient };
