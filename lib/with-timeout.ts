// Shared default for wrapping a single DB round-trip so callers fail fast
// instead of hanging when the database is unreachable (SEC-09).
export const DB_TIMEOUT_MS = 8_000

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Operation "${label}" timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

// Races a promise against a timeout so callers fail fast instead of hanging
// when a downstream dependency (DB, cache) is unreachable. Clears the timer
// on settle so no handle leaks.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
