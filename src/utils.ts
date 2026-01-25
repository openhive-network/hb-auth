import { GenericError } from "./errors";

/**
 * Default timeout for initialization operations (30 seconds)
 */
export const DEFAULT_INIT_TIMEOUT = 30000;

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the specified time, rejects with the provided error message.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs
 * @returns The result of the promise if it resolves in time
 * @throws GenericError if timeout occurs
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new GenericError(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}
