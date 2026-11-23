// Imported by a test worker ahead of /dist/worker.js. Holds every PBKDF2
// derivation back for a while before running it. Beekeeper derives a wallet's
// key from the password whenever it checks a password against a wallet that no
// session holds unlocked, wrong passwords included: it rejects one by the
// wallet's MAC, before decrypting anything. With the wallet unlocked in some
// session it compares the password in memory and derives nothing.
const DELAY_MS = 200;

const originalDeriveBits = SubtleCrypto.prototype.deriveBits;
SubtleCrypto.prototype.deriveBits = async function (algorithm, ...args) {
  if (algorithm?.name === "PBKDF2") {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  return await originalDeriveBits.call(this, algorithm, ...args);
};
