import { client, isSupportWebWorker } from "../dist/hb-auth.mjs";

console.log(isSupportWebWorker, client);

const CHAIN_ID = "beeab0de00000000000000000000000000000000000000000000000000000000";

client.initialize({ chainId: CHAIN_ID }).then((v) => console.log(v))