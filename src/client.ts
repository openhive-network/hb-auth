import {
  type ApiTransaction,
  type IHiveChainInterface,
  type ITransaction,
  TTransactionPackType,
  createHiveChain,
} from "@hiveio/wax";
import { proxy, wrap, type Endpoint, type Remote, type Local } from "comlink";
import { AuthorizationError, GenericError } from "./errors";
import { isSupportSharedWorker, isSupportWebWorker } from "./environment";
import type {
  Auth,
  WorkerExpose,
  AuthUser,
  KeyAuthorityType,
  UserSettings,
} from "./worker";
export type { AuthUser, KeyAuthorityType, AuthorizationError };

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
   * Blockchain ID used for calculating digest
   * @type {string}
   * @defaultValue `"beeab0de00000000000000000000000000000000000000000000000000000000"`
   */
  chainId: string;
  /**
   * Blockchain Node address for online account verification
   * @type {string}
   * @defaultValue `"https://api.hive.blog"`
   */
  node: string;
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
}

/* @hidden */
const defaultOptions: ClientOptions = {
  chainId: "beeab0de00000000000000000000000000000000000000000000000000000000",
  node: "https://api.hive.blog",
  workerUrl: "/auth/worker.js",
  sessionTimeout: 900,
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
  #strict!: boolean;
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
  constructor(readonly clientOptions: Partial<ClientOptions> = {}) {
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
    return new Promise((resolve) => {
      let worker: SharedWorker | Worker;

      if (isSupportSharedWorker) {
        worker = new SharedWorker(this.options.workerUrl, { type: "module" });
        resolve(worker.port);
      } else {
        worker = new Worker(this.options.workerUrl, { type: "module" });
        resolve(worker);
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
   * @returns {InstanceType<Client>}
   */
  public async initialize(): Promise<this> {
    try {
      await this.loadWebWorker();
      this.#auth = await new this.#worker.Auth(this.options.sessionTimeout);
      this.hiveChain = await createHiveChain({
        apiEndpoint: this.options.node,
        chainId: this.options.chainId,
      });

      return Promise.resolve(this);
    } catch (err) {
      return Promise.reject(err);
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
   * @returns {Promise<AuthStatus>}
   */
  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
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
   */
  public async sign(
    username: string,
    transactionDigest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    return await this.#auth.sign(username, transactionDigest, keyType);
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
}

/**
 * Auth client that doesn't
 * verify user's authority through the network. So, user has resposibility
 * for imported keys' validity.
 */
class OfflineClient extends Client {
  constructor(readonly clientOptions: Partial<ClientOptions> = {}) {
    super(clientOptions);
  }

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
  ): Promise<AuthStatus> {
    return await super.register(
      username,
      password,
      wifKey,
      keyType,
      strict,
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
}

/**
 * Auth client that additionally authorizes
 * user by verifying user's signature through the network.
 */
class OnlineClient extends Client {
  constructor(readonly clientOptions: Partial<ClientOptions> = {}) {
    super(clientOptions);
  }

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
        pack: TTransactionPackType.HF_26,
      });

      return response.valid;
    } catch (err) {
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
  ): Promise<AuthStatus> {
    return await super.register(
      username,
      password,
      wifKey,
      keyType,
      strict,
      false,
    );
  }
}

export { OnlineClient, OfflineClient };
