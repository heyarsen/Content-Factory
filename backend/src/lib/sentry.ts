/**
 * Sentry error monitoring integration for the backend.
 *
 * Usage:
 *   1. Set SENTRY_DSN environment variable in Railway / .env
 *   2. Call `initSentry()` once at the very top of server.ts (before any routes)
 *   3. Use `captureException(err, context)` anywhere in the codebase
 *   4. Add `sentryErrorHandler()` as the LAST error-handling middleware in Express
 */

import * as Sentry from '@sentry/node'

let initialized = false

/**
 * Initialize Sentry SDK.
 * Safe to call multiple times — only initializes once.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN

  if (!dsn) {
    console.info('[Sentry] SENTRY_DSN not set — error monitoring disabled')
    return
  }

  if (initialized) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.npm_package_version,

    integrations: [
      // Automatically captures Express request data
      Sentry.expressIntegration(),
    ],

    // Capture 100% of transactions in development, 10% in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Ignore noisy errors that don't need attention
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],

    beforeSend(event, hint) {
      // Strip sensitive data from request bodies
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization']
        for (const field of sensitiveFields) {
          if (data[field]) {
            data[field] = '[REDACTED]'
          }
        }
      }
      return event
    },
  })

  initialized = true
  console.info('[Sentry] Error monitoring initialized')
}

/**
 * Capture an exception with optional context.
 * Falls back gracefully if Sentry is not initialized.
 */
export function captureException(
  error: unknown,
  context?: {
    userId?: string
    operation?: string
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }
): void {
  if (!initialized) {
    // Log to console as fallback
    console.error('[Error]', context?.operation || 'Unknown operation', error)
    return
  }

  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId })
    }
    if (context?.operation) {
      scope.setTag('operation', context.operation)
    }
    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value)
      }
    }
    if (context?.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value)
      }
    }
    Sentry.captureException(error)
  })
}

/**
 * Capture a message (non-error event) with severity level.
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>
): void {
  if (!initialized) {
    console.log(`[Sentry:${level}] ${message}`, extra || '')
    return
  }

  Sentry.withScope((scope) => {
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        scope.setExtra(key, value)
      }
    }
    Sentry.captureMessage(message, level)
  })
}

/**
 * Express error handler middleware — must be registered LAST.
 * Captures unhandled Express errors and forwards to Sentry.
 * Uses Sentry v8 API: setupExpressErrorHandler.
 */
export function sentryErrorHandler(): any {
  return Sentry.expressErrorHandler()
}

/**
 * Express request handler middleware — must be registered FIRST.
 * In Sentry v8, request context is captured automatically via expressIntegration.
 * This is a no-op passthrough for API compatibility.
 */
export function sentryRequestHandler() {
  // Sentry v8 uses expressIntegration() in init() instead of requestHandler middleware
  // Return a passthrough middleware for compatibility
  return (_req: any, _res: any, next: any) => next()
}

export { Sentry }
