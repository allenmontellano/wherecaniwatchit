import * as Sentry from '@sentry/nextjs'

// Thin wrapper over Sentry so call sites stay decoupled from the SDK and
// no-op safely when Sentry is not initialized (e.g. CLI scripts, tests).
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'warning'
): void {
  Sentry.captureMessage(message, { level, extra: context })
}
