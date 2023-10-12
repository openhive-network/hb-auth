import { client, isSupportWebWorker } from "../dist/hb-auth.mjs";

console.log(isSupportWebWorker, client);

client.initialize().then((v) => console.log(v))