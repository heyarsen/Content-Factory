import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime } from 'luxon'

import { AutomationService } from './automationService'

describe('AutomationService.hasScheduledTimePassed', () => {
  it('accepts single-digit hour/minute formats and marks overdue times as due', () => {
    const now = DateTime.fromISO('2026-01-15T09:30:00', { zone: 'UTC' })

    assert.equal(AutomationService.hasScheduledTimePassed('9:29', now), true)
    assert.equal(AutomationService.hasScheduledTimePassed('9:30', now), true)
    assert.equal(AutomationService.hasScheduledTimePassed('9:31', now), false)
  })

  it('supports seconds in scheduled_time values', () => {
    const now = DateTime.fromISO('2026-01-15T09:30:15', { zone: 'UTC' })

    assert.equal(AutomationService.hasScheduledTimePassed('09:30:14', now), true)
    assert.equal(AutomationService.hasScheduledTimePassed('09:30:15', now), true)
    assert.equal(AutomationService.hasScheduledTimePassed('09:30:16', now), false)
  })

  it('returns false for invalid times and true for null/empty schedule', () => {
    const now = DateTime.fromISO('2026-01-15T09:30:00', { zone: 'UTC' })

    assert.equal(AutomationService.hasScheduledTimePassed('25:00', now), false)
    assert.equal(AutomationService.hasScheduledTimePassed('09:75', now), false)
    assert.equal(AutomationService.hasScheduledTimePassed('invalid', now), false)
    assert.equal(AutomationService.hasScheduledTimePassed('', now), false)
    assert.equal(AutomationService.hasScheduledTimePassed('   ', now), false)
    assert.equal(AutomationService.hasScheduledTimePassed(null, now), true)
    assert.equal(AutomationService.hasScheduledTimePassed(undefined, now), true)
  })
})
