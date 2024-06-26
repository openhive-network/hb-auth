import {
  type ApiTransaction,
  type IHiveChainInterface,
  type ITransactionBuilder,
  TTransactionPackType,
  createHiveChain,
} from "@hiveio/wax";
import { proxy, wrap, type Endpoint, type Remote, type Local } from "comlink";
import { AuthorizationError, GenericError } from "./errors";
import { isSupportSharedWorker, isSupportWebWorker } from "./environment";
import type { Auth, WorkerExpose, AuthUser, KeyAuthorityType } from "./worker";
export type { AuthUser, KeyAuthorityType, AuthorizationError };

export interface AuthStatus {
  /**
   * @description Value that describes auth status
   * @type {boolean}
   */
  ok: boolean;
  /**
   * @description An error in case of unsuccessful authorization
   * @optional
   */
  error?: AuthorizationError | null;
}

export interface ClientOptions {
  /**
   * @description Blockchain ID used for calculating digest
   * @type {string}
   * @defaultValue `"beeab0de00000000000000000000000000000000000000000000000000000000"`
   */
  chainId: string;
  /**
   * @description Blockchain Node address for online account verification
   * @type {string}
   * @defaultValue `"https://api.hive.blog"`
   */
  node: string;
  /**
   * @description Url for worker script path provided by hb-auth library
   * @type {string}
   * @defaultValue `"/auth/worker.js"`
   */
  workerUrl: string;
  /**
   * @description Session timeout (in seconds) for Wallet, after that session will be destroyed and user must authenticate again
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

  /** @hidden */
  protected set isStrict(strict: boolean) {
    this.#strict = strict;
  }

  /** @hidden */
  protected get isStrict(): boolean {
    return this.#strict;
  }

  /**
   * @hidden
   * Authentication method to implement in derived classes
   * based on authentication type
   */
  protected abstract authorize(
    username: string,
    txBuilder: ITransactionBuilder,
    keyType: KeyAuthorityType,
  ): Promise<boolean>;

  /**
   * @description Additional options for auth client
   * @param strict @type {boolean} - Strict authorization by checking if public key in signature matches user's public key, so other authorities will be ignored. Note that this doesn't affect OfflineClient's behaviour.
   * @param clientOptions @type {ClientOptions} - Options
   */
  constructor(
    private readonly strict: boolean,
    readonly clientOptions: Partial<ClientOptions> = {},
  ) {
    this.isStrict = strict;
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
    // TODO: detect missing worker file and throw

    return new Promise((resolve, reject) => {
      let worker: SharedWorker | Worker;
      if (isSupportSharedWorker) {
        worker = new SharedWorker(this.options.workerUrl);
        return resolve(worker.port);
      } else {
        worker = new Worker(this.options.workerUrl);
        return resolve(worker);
      }
    });
  }

  /** @hidden */
  protected getAuthInstance(): Local<Auth> {
    return this.#auth;
  }

  /**
   * @description Async method that prepares client to run.
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
   * @description Method to set callback for being notified on session and or logout action.
   * @param cb Async callback function that fires on session end
   * @returns {Promise<void>}
   */
  public async setSessionEndCallback(cb: () => Promise<void>): Promise<void> {
    this.#sessionEndCallback = cb;
    await this.#auth.setSessionEndCallback(proxy(this.#sessionEndCallback));
  }

  /**
   * @description Method to get all registered users with their active auth status.
   * If there is no user registered, it will return an empty array.
   * @returns {Promise<AuthUser[]>}
   */
  public async getAuths(): Promise<AuthUser[]> {
    return await this.#auth.getAuths();
  }

  /**
   * @description Method to get auth status for a given user.
   * If there is no user it will return null.
   * @param username Username
   * @returns {Promise<AuthUser> | null}
   */
  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    return await this.#auth.getAuthByUser(username);
  }

  /** @hidden */
  private async getVerificationTx(
    username: string,
    keyType: KeyAuthorityType,
    offline?: boolean,
  ): Promise<ITransactionBuilder> {
    let txBuilder: ITransactionBuilder;

    if (offline) {
      txBuilder = new this.hiveChain.TransactionBuilder(
        "04e3256d94edee6ac72add19c1439260fbb00701",
        "+1m",
      );
    } else {
      txBuilder = await this.hiveChain.getTransactionBuilder("+1m");
    }

    if (keyType === "posting") {
      txBuilder.push({
        vote: {
          voter: username,
          author: "author",
          permlink: "permlink",
          weight: 10000,
        },
      });
    } else {
      txBuilder.push({
        limit_order_cancel: { owner: username, orderid: 0 },
      });
    }

    txBuilder.validate();

    return txBuilder;
  }

  /**
   * @description Method that registers a new user or adding
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
    offline?: boolean,
  ): Promise<AuthStatus> {
    const txBuilder = await this.getVerificationTx(username, keyType, offline);
    const signature = await this.#auth.register(
      username,
      password,
      txBuilder.sigDigest,
      wifKey,
      keyType,
    );

    txBuilder.build(signature);

    const authenticated = await this.authorize(username, txBuilder, keyType);

    if (authenticated) {
      await this.#auth.onAuthComplete(false);
      return Promise.resolve({ ok: true });
    } else {
      await this.#auth.onAuthComplete(true);
      return Promise.reject(new AuthorizationError("Invalid credentials"));
    }
  }

  /**
   * @description Method that authenticates an already registered user.
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

      txBuilder.build(signature);

      const authenticated = await this.authorize(username, txBuilder, keyType);

      if (authenticated) {
        await this.#auth.onAuthComplete(false);
        return Promise.resolve({ ok: true });
      } else {
        await this.#auth.logout();
        // TODO: handle that case more clearly
        return Promise.reject(new AuthorizationError("Invalid credentials"));
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * @description Method that locks user session and keeps user session during session time.
   * Note that when user session time ends, user should authenticate again.
   */
  public async lock(): Promise<void> {
    await this.#auth.lock();
  }

  /**
   * @description Method that unlocks existing user's session.
   * This method will extend user's session time after unlocking.
   * This is different than authenticate method.
   * @param username Username
   * @param password Password
   */
  public async unlock(username: string, password: string): Promise<void> {
    await this.#auth.unlock(username, password);
  }

  /**
   * @description Method that imports a new key for given user
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
   * @description Method that ends existing user session. This is different than locking user.
   * When this is called any callback set via @see {Client.setSessionCallback} will fire.
   */
  public async logout(): Promise<void> {
    await this.#auth.logout();
  }

  /**
   * @description Method that signs given transaction as an authorized user based on selected authority type.
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
}

/**
 * @description Auth client that doesn't
 * verify user's authority through the network. So, user has resposibility
 * for imported keys' validity.
 */
class OfflineClient extends Client {
  constructor(readonly clientOptions: Partial<ClientOptions> = {}) {
    super(false, clientOptions);
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
  ): Promise<AuthStatus> {
    return await super.register(username, password, wifKey, keyType, true);
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
 * @description Auth client that additionally authorizes
 * user by verifying user's signature through the network.
 */
class OnlineClient extends Client {
  protected async authorize(
    username: string,
    txBuilder: ITransactionBuilder,
    keyType: KeyAuthorityType,
  ): Promise<boolean> {
    const verificationResult = await this.verify(
      txBuilder.toApiJson() as ApiTransaction,
    );

    if (this.isStrict && verificationResult) {
      const accounts = await this.hiveChain.api.database_api.find_accounts({
        accounts: [username],
      });
      const account_key = accounts.accounts[0][keyType].key_auths[0][0];

      return account_key.endsWith(txBuilder.signatureKeys[0]);
    }

    return verificationResult;
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

  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<AuthStatus> {
    return await super.register(username, password, wifKey, keyType, false);
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<AuthStatus> {
    return await super.authenticate(username, password, keyType, false);
  }
}

export { OnlineClient, OfflineClient };
