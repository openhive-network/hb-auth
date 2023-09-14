import { LOCK_TIMEOUT } from "./constants";
import { GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import workerString from "worker";
/**
 * Client class is responsible for creating a new
 * auth client, managing the whole auth process (importing keys, verification, validation)
 * also provides auth related functions (auth check, unlock, logout/destroy auth)
 * and some helpers like (signing transactions as an authorised user)
 */
export class Client {
  private static instance: Client | undefined;
  private readonly lockTimeout: number = LOCK_TIMEOUT;

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

    worker.onmessage = (msg) => {
      console.log("got msg from the worker: ", msg);
    };

    // import("./worker.mjs")
    //   .then((workerStr) => {
    //     console.log(workerStr);
    //   })
    //   .catch((err) => {
    //     console.log("cant load worker string", err);
    //   });
  }

  public static getClient(): Client {
    if (Client.instance === undefined) {
      Client.instance = new Client();
    }

    return Client.instance;
  }
}
