import { wrap, type Remote, type Local } from "../node_modules/comlink/dist/esm/comlink";
import { GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
import type { Auth, WorkerExpose } from "./worker";


export interface ClientOptions {
  chainId: string;
}

export type KeyAuthorityType = "posting" | "active";

class Client {
  #worker!: Remote<WorkerExpose>;
  #options!: ClientOptions;
  #auth!: Local<Auth>;

  public set options(options: ClientOptions) {
    this.#options = { ...this.#options, ...options };
  }

  public get options(): ClientOptions {
    return this.#options;
  }

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
    this.#worker = wrap<WorkerExpose>(worker)
  }

  public async initialize(options: ClientOptions): Promise<Client> {
    this.options = options;
    this.#auth = await new this.#worker.Auth(options.chainId)

    return await Promise.resolve(this);
  }

  public async register(
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    username: string
  ): Promise<{ ok: boolean }> {
    await this.#auth.register(password, wifKey, `${username}:${keyType}`);
    return await Promise.resolve({ ok: false });
  }

  public async authorize(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<{ ok: boolean }> {
    return await Promise.resolve({ ok: false });
  }

  public async logout(): Promise<{ ok: boolean }> {
    return await Promise.resolve({ ok: false });
  }

  public async sign(): Promise<{ ok: boolean }> {
    return await Promise.resolve({ ok: false });
  }
}

const client = new Client();

export { client };
