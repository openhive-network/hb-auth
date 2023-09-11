/* eslint-disable @typescript-eslint/no-dynamic-delete */
// Add message type strictly here
// type MessageType = any;
// interface Message {}

export class WorkerMessageHandler {
    private static idCount = 0
    private resolvers = {}
    private rejectors = {}

    constructor(private readonly worker: Worker) {
        this.worker = worker;

        this.worker.onmessage = ({ data }) => {
            const { payload, error, messageId } = data;

            if (error) {
                this.rejectors[messageId](error)
            } else {
                this.resolvers[messageId](payload)
            }

            delete this.resolvers[messageId];
            delete this.rejectors[messageId];
        }
    }

    public async call(args: any): Promise<any> {
        const messageId = WorkerMessageHandler.idCount++;

        this.worker.postMessage({ ...args, messageId });

        return await new Promise((resolve, reject) => {
            this.resolvers[messageId] = resolve;
            this.rejectors[messageId] = reject;
        })
    }
}
