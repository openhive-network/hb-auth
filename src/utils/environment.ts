export const isSupportWebWorker = typeof Worker !== "undefined";
export const isBrowser = typeof Window !== "undefined";
export const getEnvironment = isBrowser ? "browser" : "node";