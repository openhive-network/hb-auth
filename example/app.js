import { Client, isSupportWebWorker } from "../dist/hb-auth.mjs";

const authClient = Client.getClient();

console.log(isSupportWebWorker, authClient);
