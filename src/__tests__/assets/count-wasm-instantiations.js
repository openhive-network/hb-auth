// Imported by a test worker ahead of /dist/worker.js. Counts WASM starts,
// successful instantiations and closes of beekeeper's storage database (one
// per deleted beekeeper instance) in that worker and answers every message on
// a BroadcastChannel with `{ starts, instantiations, storageCloses }`. A
// message carrying a boolean `failInstantiation` or `hangInstantiation` first
// switches forced instantiation failure, or instantiation held until hanging
// is switched off again, on or off; a boolean `failStorageWrites` makes
// beekeeper's writes to its storage database fail, which fails the next
// deletion of that beekeeper; a true `hangNextStorageWrite` makes the next
// read-write transaction on that database never finish, and the deletion of
// the beekeeper that started it waits for it forever; one carrying `timings` sets the worker's
// `hbAuthTimings` overrides.
// Emscripten tries instantiateStreaming once per start and falls back to
// instantiate when it fails, so starts count streaming calls and only resolved
// calls count as instantiations.
const STORAGE_DB = "/storage_root_v3";

let starts = 0;
let instantiations = 0;
let storageCloses = 0;
let failInstantiation = false;
let hangInstantiation = false;
let failStorageWrites = false;
let hangNextStorageWrite = false;
let releaseHung = () => {};
let hung = Promise.resolve();

for (const name of ["instantiate", "instantiateStreaming"]) {
  const original = WebAssembly[name];
  WebAssembly[name] = async (...args) => {
    if (name === "instantiateStreaming") starts += 1;
    if (hangInstantiation) {
      await hung;
    }
    if (failInstantiation) {
      throw new WebAssembly.CompileError("WASM instantiation disabled by test");
    }
    const result = await original.apply(WebAssembly, args);
    instantiations += 1;
    return result;
  };
}

const originalClose = IDBDatabase.prototype.close;
IDBDatabase.prototype.close = function (...args) {
  if (this.name === STORAGE_DB) storageCloses += 1;
  return originalClose.apply(this, args);
};

const originalPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function (...args) {
  if (failStorageWrites && this.transaction.db.name === STORAGE_DB) {
    throw new DOMException("Storage writes disabled by test", "UnknownError");
  }
  return originalPut.apply(this, args);
};

// Accepts any use and never calls back, so whatever waits on it waits forever.
const inert = new Proxy(function () {}, {
  get: () => inert,
  set: () => true,
  apply: () => inert,
});

const originalTransaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (...args) {
  if (
    hangNextStorageWrite &&
    this.name === STORAGE_DB &&
    args[1] === "readwrite"
  ) {
    hangNextStorageWrite = false;
    return inert;
  }
  return originalTransaction.apply(this, args);
};

const channel = new BroadcastChannel("hb-auth-wasm-instantiations");
channel.onmessage = (event) => {
  if (typeof event.data?.failInstantiation === "boolean") {
    failInstantiation = event.data.failInstantiation;
  }
  if (typeof event.data?.hangInstantiation === "boolean") {
    if (event.data.hangInstantiation && !hangInstantiation) {
      hung = new Promise((resolve) => {
        releaseHung = resolve;
      });
    } else if (!event.data.hangInstantiation) {
      releaseHung();
    }
    hangInstantiation = event.data.hangInstantiation;
  }
  if (typeof event.data?.failStorageWrites === "boolean") {
    failStorageWrites = event.data.failStorageWrites;
  }
  if (typeof event.data?.hangNextStorageWrite === "boolean") {
    hangNextStorageWrite = event.data.hangNextStorageWrite;
  }
  if (typeof event.data?.timings === "object") {
    self.hbAuthTimings = event.data.timings;
  }
  channel.postMessage({ starts, instantiations, storageCloses });
};
