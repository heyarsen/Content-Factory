/**
 * Supabase connection manager with health checks and connection pooling
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { circuitBreaker } from './circuitBreaker.js'

let connectionHealthCache: {
  isHealthy: boolean
  lastCheck: number
  consecutiveFailures: number
} = {
  isHealthy: true,
  lastCheck: 0,
  consecutiveFailures: 0,
}

const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3

/**
 * Check if Supabase is reachable
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  const now = Date.now()
  const timeSinceLastCheck = now - connectionHealthCache.lastCheck

  // Use cached result if it's recent
  if (timeSinceLastCheck < HEALTH_CHECK_INTERVAL && connectionHealthCache.isHealthy) {
    return true
  }

  // Check circuit breaker first
  if (circuitBreaker.isOpen('supabase')) {
    console.log('[Supabase Health] Circuit breaker is open, skipping health check')
    connectionHealthCache.isHealthy = false
    return false
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase Health] Missing environment variables')
    connectionHealthCache.isHealthy = false
    connectionHealthCache.consecutiveFailures++
    circuitBreaker.recordFailure('supabase')
    return false
  }

  try {
    // Quick health check - try to reach the REST API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'apikey': supabaseAnonKey,
        },
      })
      clearTimeout(timeoutId)

      const isHealthy = response.status < 500
      const wasUnhealthy = !connectionHealthCache.isHealthy || connectionHealthCache.consecutiveFailures > 0

      connectionHealthCache.isHealthy = isHealthy
      connectionHealthCache.lastCheck = now

      if (isHealthy) {
        if (wasUnhealthy) {
          console.log('[Supabase Health] ✅ Connection restored - healthy')
        }
        connectionHealthCache.consecutiveFailures = 0
        circuitBreaker.recordSuccess('supabase')
      } else {
        connectionHealthCache.consecutiveFailures++
        circuitBreaker.recordFailure('supabase')
        console.log(`[Supabase Health] ❌ Connection unhealthy (status: ${response.status}, failures: ${connectionHealthCache.consecutiveFailures})`)
      }

      return isHealthy
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      connectionHealthCache.isHealthy = false
      connectionHealthCache.consecutiveFailures++
      connectionHealthCache.lastCheck = now
      circuitBreaker.recordFailure('supabase')

      const state = circuitBreaker.getState('supabase')
      if (connectionHealthCache.consecutiveFailures <= 3 || state?.state === 'open') {
        console.log(`[Supabase Health] ❌ Connection check failed (${connectionHealthCache.consecutiveFailures} failures): ${fetchError.message}`, {
          errorCode: fetchError.cause?.code,
          circuitBreakerState: state?.state,
        })
      }
      return false
    }
  } catch (error: any) {
    connectionHealthCache.isHealthy = false
    connectionHealthCache.consecutiveFailures++
    connectionHealthCache.lastCheck = now
    circuitBreaker.recordFailure('supabase')

    console.error('[Supabase Health] ❌ Health check error:', error.message)
    return false
  }
}

/**
 * Get Supabase client with health check and circuit breaker
 */
export async function getSupabaseClientWithHealthCheck(
  url: string,
  key: string,
  options?: any
): Promise<{ client: SupabaseClient | null; error: string | null }> {
  // Check circuit breaker
  if (circuitBreaker.isOpen('supabase')) {
    const state = circuitBreaker.getState('supabase')
    const nextAttempt = state?.nextAttemptTime ? new Date(state.nextAttemptTime).toISOString() : 'unknown'
    return {
      client: null,
      error: `Supabase service is temporarily unavailable. Circuit breaker is open. Next attempt: ${nextAttempt}`,
    }
  }

  // Perform health check
  const isHealthy = await checkSupabaseHealth()
  if (!isHealthy) {
    return {
      client: null,
      error: 'Supabase service is currently unavailable. Please try again in a few moments.',
    }
  }

  // Create client with timeout
  const createFetchWithTimeout = (timeoutMs: number = 90000) => {
    return async (fetchUrl: string, fetchOptions: any = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(fetchUrl, {
          ...fetchOptions,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        // Record success if we got a response
        if (response.status < 500) {
          circuitBreaker.recordSuccess('supabase')
        }

        return response
      } catch (error: any) {
        clearTimeout(timeoutId)

        // Record failure for timeout/connection errors
        if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('fetch failed')) {
          circuitBreaker.recordFailure('supabase')
        }

        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms`)
        }
        throw error
      }
    }
  }

  try {
    const customFetch = createFetchWithTimeout(90000)
    const client = createClient(url, key, {
      ...options,
      global: {
        ...options?.global,
        fetch: customFetch as any,
        headers: {
          ...options?.global?.headers,
          'x-client-info': 'content-factory-backend',
        },
      },
    })

    return { client, error: null }
  } catch (error: any) {
    circuitBreaker.recordFailure('supabase')
    return {
      client: null,
      error: error.message || 'Failed to create Supabase client',
    }
  }
}

/**
 * Force health check (bypass cache)
 */
export async function forceHealthCheck(): Promise<boolean> {
  connectionHealthCache.lastCheck = 0
  return await checkSupabaseHealth()
}

/**
 * Get connection health status
 */
export function getConnectionHealth(): {
  isHealthy: boolean
  lastCheck: number
  consecutiveFailures: number
  circuitBreakerState: 'closed' | 'open' | 'half-open' | undefined
} {
  const state = circuitBreaker.getState('supabase')
  return {
    isHealthy: connectionHealthCache.isHealthy,
    lastCheck: connectionHealthCache.lastCheck,
    consecutiveFailures: connectionHealthCache.consecutiveFailures,
    circuitBreakerState: state?.state,
  }
}

