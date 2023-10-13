import { client, isSupportWebWorker } from "../dist/hb-auth.mjs";

console.log(isSupportWebWorker, client);

client.initialize({ chainId: 'abc' }).then((v) => console.log(v))