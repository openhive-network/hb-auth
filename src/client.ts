import { createWaxFoundation } from "@hive/wax";
import {
  proxy,
  wrap,
  type Remote,
  type Local,
} from "../node_modules/comlink/dist/esm/comlink";
import { AuthorizationError, GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
import type { Auth, WorkerExpose, AuthUser, KeyAuthorityType } from "./worker";
export type { AuthUser, KeyAuthorityType };

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
}

/* @hidden */
const defaultOptions: ClientOptions = {
  chainId: "beeab0de00000000000000000000000000000000000000000000000000000000",
  node: "https://api.hive.blog",
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
    digest: string,
    signature: string,
    keyType: KeyAuthorityType,
  ): Promise<boolean>;

  /**
   * @description Additional options for auth client
   * @param clientOptions @type {ClientOptions} - Options
   */
  constructor(private readonly clientOptions: ClientOptions = defaultOptions) {
    this.options = clientOptions;
    if (!isSupportWebWorker) {
      throw new GenericError(
        `WebWorker support is required for running this library.
         Your browser/environment does not support WebWorkers.`,
      );
    }
    // load worker
    this.loadWebWorker();
  }

  /** @hidden */
  private loadWebWorker(): void {
    if (this.#worker) return;

    const workerBlob = new Blob([workerString]);
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    this.#worker = wrap<WorkerExpose>(worker);
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
    this.#auth = await new this.#worker.Auth();

    return await Promise.resolve(this);
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
  private async getVerificationDigest(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    const dynamicGlobalProps = await fetch(this.options.node, {
      method: "post",
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "database_api.get_dynamic_global_properties",
        id: 1,
      }),
    });
    const { result: globalProps } = await dynamicGlobalProps.json();

    const wax = await createWaxFoundation();
    const tx = new wax.TransactionBuilder(globalProps.head_block_id, "+1m");

    if (keyType === "posting") {
      tx.push({
        vote: {
          voter: username,
          author: "author",
          permlink: "permlink",
          weight: 10000,
        },
      });
    } else {
      tx.push({
        limit_order_cancel: { owner: username, orderid: 0 },
      });
    }

    return tx.sigDigest;
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
  ): Promise<AuthStatus> {
    const digest = await this.getVerificationDigest(username, keyType);
    const signature = await this.#auth.register(
      username,
      password,
      wifKey,
      keyType,
      digest,
    );
    const authenticated = await this.authorize(
      username,
      digest,
      signature,
      keyType,
    );

    if (authenticated) {
      await this.#auth.onAuthComplete();
      return await Promise.resolve({ ok: true });
    } else {
      // TODO: handle that case more clearly
      return await Promise.resolve({
        ok: false,
        error: new AuthorizationError(""),
      });
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
  ): Promise<AuthStatus> {
    try {
      const digest = await this.getVerificationDigest(username, keyType);
      const signature = await this.#auth.authenticate(
        username,
        password,
        keyType,
        digest,
      );
      const authenticated = await this.authorize(
        username,
        digest,
        signature,
        keyType,
      );

      if (authenticated) {
        return await Promise.resolve({ ok: true });
      } else {
        await this.#auth.logout();
        // TODO: handle that case more clearly
        return await Promise.resolve({
          ok: false,
          error: new AuthorizationError(""),
        });
      }
    } catch (err) {
      return await Promise.reject(err);
    }
  }

  /**
   * @description Method that ends existing user session.
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
  // simple auth based on wallet auth status
  protected async authorize(username: string): Promise<boolean> {
    try {
      const authStatus = await this.getAuthByUser(username);
      if (authStatus?.authorized) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  }
}

/**
 * @description Auth client that additionally authorizes
 * user by verifying user's signature through the network.
 */
class OnlineClient extends Client {
  protected async authorize(
    username: string,
    digest: string,
    signature: string,
    keyType: KeyAuthorityType,
  ): Promise<boolean> {
    return await this.verify(username, digest, signature, keyType);
  }

  private async verify(
    username: string,
    digest: string,
    signature: string,
    keyType: KeyAuthorityType,
  ): Promise<boolean> {
    const body: any = {
      jsonrpc: "2.0",
      method: "database_api.verify_signatures",
      params: {
        hash: digest,
        signatures: [signature],
        required_other: [],
        required_active: [],
        required_owner: [],
        required_posting: [],
      },
      id: 1,
    };

    if (keyType === "posting") {
      body.params.required_posting.push(username);
    } else {
      body.params.required_active.push(username);
    }

    const verifyResponse = await fetch(this.options.node, {
      method: "post",
      body: JSON.stringify(body),
    });

    const {
      result: { valid },
    } = await verifyResponse.json();
    return valid;
  }
}

export { OnlineClient, OfflineClient };
