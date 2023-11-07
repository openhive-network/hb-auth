import Wax, { operation, transaction } from '@hive/wax';
import {
  proxy,
  wrap,
  type Remote,
  type Local,
} from "../node_modules/comlink/dist/esm/comlink";
import { GenericError, InternalError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
import type { Auth, WorkerExpose, AuthUser, KeyAuthorityType } from "./worker";

export interface ClientOptions {
  chainId: string;
  node: string;
}

const defaultOptions: ClientOptions = {
  chainId: 'beeab0de00000000000000000000000000000000000000000000000000000000',
  node: 'https://api.hive.blog'
}

abstract class Client {
  #worker!: Remote<WorkerExpose>;
  #options!: ClientOptions;
  #auth!: Local<Auth>;
  #sessionEndCallback: () => Promise<void> = async () => {}

  protected set options(options: ClientOptions) {
    this.#options = { ...this.#options, ...options };
  }

  protected get options(): ClientOptions {
    return this.#options;
  }

  /**
   * Authentication method to implement in derived classes 
   * based on authentication type
   */
  protected abstract authorize(username: string, digest: string, signature: string, keyType: KeyAuthorityType): Promise<boolean>;

  constructor(private readonly clientOptions: ClientOptions = defaultOptions) {
    this.options = clientOptions
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

  protected getAuthInstance(): Local<Auth> {
    return this.#auth;
  }

  public async initialize(): Promise<Client> {
    this.#auth = await new this.#worker.Auth();

    return await Promise.resolve(this);
  }

  public async setSessionEndCallback(cb: () => Promise<void>): Promise<void> {
    this.#sessionEndCallback = cb;
    await this.#auth.setSessionEndCallback(proxy(this.#sessionEndCallback));
  }

  public async getAuths(): Promise<AuthUser[]> {
    return await this.#auth.getAuths();
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    return await this.#auth.getAuthByUser(username);
  }

  private async getVerificationDigest(username: string, keyType: KeyAuthorityType): Promise<string> {
    const wax = await Wax();
    const proto = new wax.proto_protocol();

    const dynamicGlobalProps = await fetch(this.options.node, {
      method: 'post',
      body: JSON.stringify({ "jsonrpc": "2.0", "method": "database_api.get_dynamic_global_properties", "id": 1 })
    })
    const { result: globalProps } = await dynamicGlobalProps.json()
    const ref_block_num = globalProps.head_block_number & 0xffff
    const ref_block_prefix = Buffer.from(globalProps.head_block_id, 'hex').readUInt32LE(4)

    const op = keyType === 'posting' ? operation.create({
      vote: {
        voter: username,
        author: 'ngc1559', // change this
        permlink: 'hello-people-of-the-planet-hive',
        weight: 10000
      }
    }) : operation.create({ limit_order_cancel: { owner: username, orderid: 0 } })

    const tx = transaction.create({
      ref_block_num,
      ref_block_prefix,
      expiration: new Date(Date.now() + (1000 * 60)).toISOString().slice(0, -5),
      operations: [{
        ...op
      }],
      extensions: []
    })

    const { content: digest, exception_message } = proto.cpp_calculate_sig_digest(JSON.stringify(transaction.toJSON(tx)), this.options.chainId);

    if (exception_message) {
      throw new InternalError(exception_message);
    }

    return digest as string;
  }

  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<{ ok: boolean }> {
    const digest = await this.getVerificationDigest(username, keyType);
    const signature = await this.#auth.register(username, password, wifKey, keyType, digest);
    const authenticated = await this.authorize(username, digest, signature, keyType);

    if (authenticated) {
      await this.#auth.onAuthComplete()
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
      const digest = await this.getVerificationDigest(username, keyType);
      const signature = await this.#auth.authenticate(username, password, keyType, digest);
      const authenticated = await this.authorize(username, digest, signature, keyType);

      if (authenticated) {
        return await Promise.resolve({ ok: true });
      } else {
        // TODO: return reason here
        await this.#auth.logout()
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
  protected async authorize(username: string): Promise<boolean> {
    try {
      const authStatus = await this.getAuthByUser(username);
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
  protected async authorize(username: string, digest: string, signature: string, keyType: KeyAuthorityType): Promise<boolean> {
    return await this.verify(username, digest, signature, keyType);
  }

  private async verify(username: string, digest: string, signature: string, keyType: KeyAuthorityType): Promise<boolean> {
    const body: any =
    {
      "jsonrpc": "2.0",
      "method": "database_api.verify_signatures",
      "params": {
        "hash": digest,
        "signatures": [signature],
        "required_other": [],
        "required_active": [],
        "required_owner": [],
        "required_posting": []
      },
      "id": 1
    }

    if (keyType === 'posting') {
      body.params.required_posting.push(username)
    } else {
      body.params.required_active.push(username);
    }

    const verifyResponse = await fetch(this.options.node, {
      method: 'post',
      body: JSON.stringify(body)
    })

    const { result: { valid } } = await verifyResponse.json()
    return valid
  }
}

export { OnlineClient, OfflineClient };
