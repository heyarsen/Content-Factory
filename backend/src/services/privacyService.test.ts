import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPrivacyExportPayload, getDeletionSchedule, isDeletionConfirmationValid } from './privacyService'

const baseParams = {
  user: { id: 'user-1', email: 'test@example.com' },
  profile: { id: 'user-1', email: 'test@example.com' },
  preferences: { user_id: 'user-1' },
  socialAccounts: [],
  videos: [],
  scheduledPosts: [],
  videoPlans: [],
  videoPlanItems: [],
  videoPrompts: [],
  contentItems: [],
  reels: [],
  avatars: [],
  supportTickets: [],
  supportMessages: [],
  creditTransactions: [],
  subscriptions: [],
  consentLogs: [],
  deletionRequests: [],
}

describe('privacy export', () => {
  it('returns expected fields', () => {
    const payload = buildPrivacyExportPayload(baseParams)
    assert.equal(payload.user.email, 'test@example.com')
    assert.equal(payload.profile?.id, 'user-1')
    assert.equal(payload.preferences?.user_id, 'user-1')
    assert.deepEqual(payload.socialAccounts, [])
  })
})

describe('deletion confirmation', () => {
  it('requires DELETE confirmation', () => {
    assert.equal(isDeletionConfirmationValid(undefined), false)
    assert.equal(isDeletionConfirmationValid('delete'), false)
    assert.equal(isDeletionConfirmationValid('DELETE'), true)
  })

  it('creates a scheduled deletion date', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const schedule = getDeletionSchedule(now)
    assert.equal(schedule.requestedAt, '2024-01-01T00:00:00.000Z')
    assert.ok(new Date(schedule.scheduledFor).getTime() > now.getTime())
  })
})
