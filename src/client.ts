import { GenericError } from "./errors";
import { isSupportWebWorker } from "./environment";
import { WorkerMessageHandler } from "./message";
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
    const messageHandler = new WorkerMessageHandler(worker);

    messageHandler
      .call({ type: "ping", payload: "something" })
      .then((res) => {
        console.log('responseFromWorker', res);
      })
      .catch((err) => {
        console.log("an error occurred", err);
      });

    messageHandler
      .call({ type: "", payload: null })
      .then((res) => {
        console.log('another response', res);
      })
      .catch((err) => {
        console.log("an error occurred", err);
      });
  }

  public static getClient(): Client {
    if (Client.instance === undefined) {
      Client.instance = new Client();
    }

    return Client.instance;
  }
}
