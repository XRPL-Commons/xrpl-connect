/**
 * Async utilities shared across the toolkit.
 */

/**
 * Race a promise against a timeout, resolving to `fallback` if it doesn't
 * settle within `ms` — and also if it rejects.
 *
 * This never rejects: it exists so that a single slow or hung wallet adapter
 * (e.g. an `isAvailable()` that performs a network probe on a flaky mobile
 * connection) cannot block availability checks for every other wallet. A
 * `Promise.all` over unbounded `isAvailable()` calls waits for the slowest
 * one; wrapping each call here caps that wait.
 *
 * @param operation - Function that starts the promise to bound. Synchronous
 * throws are treated like rejected promises.
 * @param ms - Maximum time to wait, in milliseconds.
 * @param fallback - Value to resolve with on timeout or rejection.
 */
export function withTimeout<T>(operation: () => Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;

    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish(fallback), ms);

    try {
      operation().then(
        (value) => finish(value),
        () => finish(fallback)
      );
    } catch {
      finish(fallback);
    }
  });
}
