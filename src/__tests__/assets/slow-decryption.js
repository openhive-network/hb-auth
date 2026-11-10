// Imported by a test worker ahead of /dist/worker.js. Holds every
// SubtleCrypto decryption back for a while before running it. Beekeeper
// decrypts a wallet while unlocking it, so each unlock stays suspended, with
// beekeeper mid-call, long enough for other calls to arrive meanwhile.
const DELAY_MS = 200;

const originalDecrypt = SubtleCrypto.prototype.decrypt;
SubtleCrypto.prototype.decrypt = async function (...args) {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  return await originalDecrypt.apply(this, args);
};
