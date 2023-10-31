import {
  // proxy,
  wrap,
  type Remote,
  type Local,
} from "../node_modules/comlink/dist/esm/comlink";
import { GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
import type { Auth, WorkerExpose, AuthUser } from "./worker";

export interface ClientOptions {
  chainId: string;
  node: string;
  // onSessionEnd: () => Promise<void>;
}

export type KeyAuthorityType = "posting" | "active";

const defaultOptions: ClientOptions = {
  chainId: 'beeab0de00000000000000000000000000000000000000000000000000000000',
  node: 'https://api.hive.blog'
}

abstract class Client {
  #worker!: Remote<WorkerExpose>;
  #options: ClientOptions = defaultOptions
  #auth!: Local<Auth>;

  public set options(options: ClientOptions) {
    this.#options = { ...this.#options, ...options };
  }

  public get options(): ClientOptions {
    return this.#options;
  }

  /**
   * Authentication method to implement in derived classes 
   * based on authentication type
   */
  protected abstract authorize(username: string, password: string, keyType?: KeyAuthorityType): Promise<boolean>;

  constructor() {
    if (!isSupportWebWorker) {
      throw new GenericError(
        `WebWorker support is required for running this library.
         Your browser/environment does not support WebWorkers.`,
      );
    }
    // load worker
    this.loadWebWorker();
  }

  private loadWebWorker(): void {
    if (this.#worker) return;

    const workerBlob = new Blob([workerString]);
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    this.#worker = wrap<WorkerExpose>(worker);
  }

  public async initialize(options: ClientOptions): Promise<Client> {
    this.options = options;
    this.#auth = await new this.#worker.Auth(options.chainId);
    // TODO: refactor this, preserve callback after re-initialization
    // await this.#auth.setSessionEndCallback(proxy(options.onSessionEnd));

    return await Promise.resolve(this);
  }

  public async getCurrentAuth(): Promise<AuthUser | null> {
    return await this.#auth.getCurrentAuth();
  }

  public async register(
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    username: string,
  ): Promise<{ ok: boolean }> {
    await this.#auth.register(password, wifKey, username, keyType);

    const authenticated = await this.authorize(username, password, keyType);

    if (authenticated) {
      return await Promise.resolve({ ok: true });
    } else {
      return await Promise.resolve({ ok: false });
    }
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<{ ok: boolean }> {
    try {
      await this.#auth.authenticate(username, password);

      const authenticated = await this.authorize(username, password);
      
      if (authenticated) {
        return await Promise.resolve({ ok: true });
      } else {
        // TODO: return reason here
        return await Promise.resolve({ ok: false });
      }
    } catch (err) {
      return await Promise.reject(err);
    }
  }

  public async logout(): Promise<void> {
    // add feedback
    await this.#auth.logout();
  }

  public async sign(): Promise<{ ok: boolean }> {
    return await Promise.resolve({ ok: false });
  }
}

class OfflineClient extends Client {
  // simple auth based on wallet auth status
  protected async authorize(): Promise<boolean> {
    try {
      const authStatus = await this.getCurrentAuth();
      if (authStatus?.authorized) {
        return true;
      } else {
        return false
      }
    } catch (err) {
      return false
    }
  }
}

class OnlineClient extends Client {
  protected async authorize(username: string, password: string, keyType: KeyAuthorityType): Promise<boolean> {
    // get username
    // prepare transaction for that user: 
    // - if new registration determine by givin key
    // - if already registred find key type from the store
    // sign that transaction for user
    // send to node for verify
    // process result
    // authorize or deny
    return true
  }
}

const client = new OfflineClient();
const client2 = new OnlineClient();

export { client, client2 };
