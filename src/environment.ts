export const isBrowser = typeof Window !== "undefined";
export const isSupportWebWorker = isBrowser && typeof Worker !== "undefined";
export const isSupportSharedWorker = "SharedWorker" in globalThis;