/* eslint-disable @typescript-eslint/no-dynamic-delete */
// Add message type strictly here
// type MessageType = any;
interface Message {
  type: string;
  payload: any;
}

export class WorkerMessageHandler {
  private static idCount = 0;

  private get nextId(): number {
    return WorkerMessageHandler.idCount++;
  }

  private resolvers: Record<number, any> = {};
  private rejectors: Record<number, any> = {};

  constructor(private readonly worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = this.onWorkerMessage.bind(this);
  }

  private onWorkerMessage({ data }: MessageEvent): void {
    const { payload, error, id } = data;
    if (error) {
      this.rejectors[id](error);
    } else {
      this.resolvers[id](payload);
    }

    delete this.resolvers[id];
    delete this.rejectors[id];
  }

  public async call({ type, payload }: Message): Promise<any> {
    const messageId = this.nextId;

    this.worker.postMessage({ type, payload, id: messageId });

    // eslint-disable-next-line @typescript-eslint/return-await
    return new Promise((resolve, reject) => {
      this.resolvers[messageId] = resolve;
      this.rejectors[messageId] = reject;
    });
  }
}
