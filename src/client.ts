import { wrap } from "../node_modules/comlink/dist/esm/comlink";
import { GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
/**
 * Client class is responsible for creating a new
 * auth client, managing the whole auth process (importing keys, verification, validation)
 * also provides auth related functions (auth check, unlock, logout/destroy auth)
 * and some helpers like (signing transactions as an authorised user)
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Client {
  private static instance: Client | undefined;

  private constructor() {
    if (!isSupportWebWorker) {
      throw new GenericError(
        `WebWorker support is required for running this library.
         Your browser/environment does not support WebWorkers.`,
      );
    }

    const workerBlob = new Blob([workerString]);
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    const wrapped = wrap(worker) as unknown as any;

    console.log(wrapped);
  }

  public static getClient(): Client {
    if (Client.instance === undefined) {
      Client.instance = new Client();
    }

    return Client.instance;
  }
}
