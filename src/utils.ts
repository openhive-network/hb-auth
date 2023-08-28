export const isSupportWebWorker = typeof Worker !== "undefined";

// check node or browser here
// export const isRunningInWorkerInstance =
//   isSupportWebWorker &&
//   typeof importScripts === "function" &&
//   self instanceof Worker;
