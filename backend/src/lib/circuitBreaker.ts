/**
 * Circuit Breaker pattern to prevent repeated failed requests
 * When service is down, fail fast instead of waiting for timeouts
 */

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failures: number
  lastFailureTime: number
  nextAttemptTime: number
}

class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map()
  private readonly failureThreshold: number = 5
  private readonly timeout: number = 60000 // 60 seconds
  private readonly resetTimeout: number = 30000 // 30 seconds

  /**
   * Check if circuit is open (service is down)
   */
  isOpen(key: string): boolean {
    const state = this.states.get(key)
    if (!state) return false

    // If circuit is open, check if we should try again
    if (state.state === 'open') {
      const now = Date.now()
      if (now >= state.nextAttemptTime) {
        // Transition to half-open to test if service is back
        state.state = 'half-open'
        state.failures = 0
        return false
      }
      return true
    }

    return false
  }

  /**
   * Record a success (reset failures)
   */
  recordSuccess(key: string): void {
    const state = this.states.get(key)
    if (state) {
      state.state = 'closed'
      state.failures = 0
      state.lastFailureTime = 0
      state.nextAttemptTime = 0
    }
  }

  /**
   * Record a failure (increment failure count)
   */
  recordFailure(key: string): void {
    let state = this.states.get(key)
    if (!state) {
      state = {
        state: 'closed',
        failures: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      }
      this.states.set(key, state)
    }

    state.failures++
    state.lastFailureTime = Date.now()

    // If we've exceeded the threshold, open the circuit
    if (state.failures >= this.failureThreshold) {
      state.state = 'open'
      state.nextAttemptTime = Date.now() + this.resetTimeout
      console.log(`[CircuitBreaker] Circuit opened for ${key} - ${state.failures} failures, will retry after ${new Date(state.nextAttemptTime).toISOString()}`)
    } else if (state.state === 'half-open') {
      // If we're in half-open state and got a failure, open the circuit again
      state.state = 'open'
      state.nextAttemptTime = Date.now() + this.resetTimeout
    }
  }

  /**
   * Get current state
   */
  getState(key: string): CircuitBreakerState | undefined {
    return this.states.get(key)
  }

  /**
   * Reset circuit breaker (for testing or manual reset)
   */
  reset(key: string): void {
    this.states.delete(key)
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.states.clear()
  }
}

export const circuitBreaker = new CircuitBreaker()

