import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import { circuitBreaker } from './circuitBreaker.js'

const KEY = 'test-service'

describe('CircuitBreaker', () => {
  beforeEach(() => {
    circuitBreaker.resetAll()
  })

  it('starts in closed state — isOpen returns false for unknown key', () => {
    assert.equal(circuitBreaker.isOpen(KEY), false)
  })

  it('remains closed after fewer failures than threshold', () => {
    for (let i = 0; i < 4; i++) {
      circuitBreaker.recordFailure(KEY)
    }
    assert.equal(circuitBreaker.isOpen(KEY), false)
    const state = circuitBreaker.getState(KEY)
    assert.equal(state?.state, 'closed')
    assert.equal(state?.failures, 4)
  })

  it('opens circuit after reaching failure threshold (5)', () => {
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure(KEY)
    }
    assert.equal(circuitBreaker.isOpen(KEY), true)
    const state = circuitBreaker.getState(KEY)
    assert.equal(state?.state, 'open')
  })

  it('recordSuccess resets failures and closes circuit', () => {
    for (let i = 0; i < 3; i++) {
      circuitBreaker.recordFailure(KEY)
    }
    circuitBreaker.recordSuccess(KEY)
    const state = circuitBreaker.getState(KEY)
    assert.equal(state?.state, 'closed')
    assert.equal(state?.failures, 0)
    assert.equal(circuitBreaker.isOpen(KEY), false)
  })

  it('transitions to half-open after reset timeout passes', () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure(KEY)
    }
    assert.equal(circuitBreaker.isOpen(KEY), true)

    // Manually set nextAttemptTime to the past to simulate timeout passing
    const state = circuitBreaker.getState(KEY)!
    state.nextAttemptTime = Date.now() - 1

    // Now isOpen should return false and transition to half-open
    assert.equal(circuitBreaker.isOpen(KEY), false)
    assert.equal(circuitBreaker.getState(KEY)?.state, 'half-open')
  })

  it('re-opens from half-open state on failure', () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure(KEY)
    }

    // Simulate timeout passing → half-open
    const state = circuitBreaker.getState(KEY)!
    state.nextAttemptTime = Date.now() - 1
    circuitBreaker.isOpen(KEY) // triggers transition to half-open

    // One more failure should re-open
    circuitBreaker.recordFailure(KEY)
    assert.equal(circuitBreaker.getState(KEY)?.state, 'open')
  })

  it('reset removes state for a specific key', () => {
    circuitBreaker.recordFailure(KEY)
    circuitBreaker.reset(KEY)
    assert.equal(circuitBreaker.getState(KEY), undefined)
    assert.equal(circuitBreaker.isOpen(KEY), false)
  })

  it('resetAll clears all states', () => {
    circuitBreaker.recordFailure('service-a')
    circuitBreaker.recordFailure('service-b')
    circuitBreaker.resetAll()
    assert.equal(circuitBreaker.getState('service-a'), undefined)
    assert.equal(circuitBreaker.getState('service-b'), undefined)
  })

  it('tracks multiple independent services', () => {
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure('service-a')
    }
    circuitBreaker.recordFailure('service-b')

    assert.equal(circuitBreaker.isOpen('service-a'), true)
    assert.equal(circuitBreaker.isOpen('service-b'), false)
  })
})
