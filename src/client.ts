import { wrap } from "../node_modules/comlink/dist/esm/comlink";
import { GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
import { type Auth } from "./worker";
/**
 * Client class is responsible for creating a new
 * auth client, managing the whole auth process (importing keys, verification, validation)
 * also provides auth related functions (auth check, unlock, logout/destroy auth)
 * and some helpers like (signing transactions as an authorised user)
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export interface ClientOptions {
  chainId: string;
}

class Client {
  #worker: any; // type this
  #options!: ClientOptions;
  #auth!: Auth;

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
    this.#worker = wrap(worker) as unknown as any;
  }

  public async initialize(options: ClientOptions): Promise<any> {
    this.options = options;
    this.#auth = await new this.#worker.Auth(this.options.chainId);
    await this.#auth.initialize();

    return await Promise.resolve("works, module is ready");
  }
}

const client = new Client();

export { client };
