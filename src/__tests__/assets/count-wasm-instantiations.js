// Imported by a test worker ahead of /dist/worker.js. Counts WASM starts and
// successful instantiations in that worker and answers every message on a
// BroadcastChannel with `{ starts, instantiations }`; a message carrying a
// boolean `failInstantiation` or `hangInstantiation` first switches forced
// instantiation failure, or instantiation that never settles, on or off.
// Emscripten tries instantiateStreaming once per start and falls back to
// instantiate when it fails, so starts count streaming calls and only resolved
// calls count as instantiations.
let starts = 0;
let instantiations = 0;
let failInstantiation = false;
let hangInstantiation = false;

for (const name of ["instantiate", "instantiateStreaming"]) {
  const original = WebAssembly[name];
  WebAssembly[name] = async (...args) => {
    if (name === "instantiateStreaming") starts += 1;
    if (hangInstantiation) {
      return await new Promise(() => {});
    }
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
  if (typeof event.data?.hangInstantiation === "boolean") {
    hangInstantiation = event.data.hangInstantiation;
  }
  channel.postMessage({ starts, instantiations });
};
