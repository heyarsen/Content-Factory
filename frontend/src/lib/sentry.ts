/**
 * Sentry error monitoring integration for the React frontend.
 *
 * Usage:
 *   1. Set VITE_SENTRY_DSN environment variable in Railway / .env
 *   2. Call `initSentry()` once in main.tsx before rendering the app
 *   3. Wrap your root component with `<SentryErrorBoundary>` for UI error catching
 *   4. Use `captureException(err, context)` for manual error reporting
 */

import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Initialize Sentry for the React frontend.
 * Safe to call multiple times — only initializes once.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn) {
    console.info('[Sentry] VITE_SENTRY_DSN not set — error monitoring disabled')
    return
  }

  if (initialized) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    release: import.meta.env.VITE_APP_VERSION,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text and block all media in session replays for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Capture 100% of transactions in development, 10% in production
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,

    // Capture 10% of sessions for replay
    replaysSessionSampleRate: 0.1,

    // Capture 100% of sessions with errors
    replaysOnErrorSampleRate: 1.0,

    beforeSend(event) {
      // Don't send events in development
      if (import.meta.env.DEV) {
        console.warn('[Sentry] Event captured (dev mode — not sent):', event)
        return null
      }
      return event
    },
  })

  initialized = true
  console.info('[Sentry] Frontend error monitoring initialized')
}

/**
 * Capture an exception with optional user context.
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
    console.error('[Error]', context?.operation || 'Unknown', error)
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
 * Set the current authenticated user in Sentry context.
 * Call this after login / on app load if user is already authenticated.
 */
export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (!initialized) return
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * React Error Boundary component powered by Sentry.
 * Wrap your root component or critical sections with this.
 *
 * Example:
 *   <SentryErrorBoundary fallback={<ErrorPage />}>
 *     <App />
 *   </SentryErrorBoundary>
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary

export { Sentry }
