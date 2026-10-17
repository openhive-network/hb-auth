// Imported by a test worker ahead of /dist/worker.js. Counts successful WASM
// instantiations in that worker and answers every message on a
// BroadcastChannel with the count; a message carrying a boolean
// `failInstantiation` first switches forced instantiation failure on or off.
// Only resolved calls are counted, because Emscripten falls back from
// instantiateStreaming to instantiate when streaming fails.
let instantiations = 0;
let failInstantiation = false;

for (const name of ["instantiate", "instantiateStreaming"]) {
  const original = WebAssembly[name];
  WebAssembly[name] = async (...args) => {
    if (failInstantiation) {
      throw new WebAssembly.CompileError("WASM instantiation disabled by test");
    }
    const result = await original.apply(WebAssembly, args);
    instantiations += 1;
    return result;
  };
}

const channel = new BroadcastChannel("hb-auth-wasm-instantiations");
channel.onmessage = (event) => {
  if (typeof event.data?.failInstantiation === "boolean") {
    failInstantiation = event.data.failInstantiation;
  }
  channel.postMessage(instantiations);
};
