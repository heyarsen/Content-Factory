import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldLoadAnalytics, shouldLoadMarketing, ConsentRecord } from './consent'

const baseConsent: ConsentRecord = {
  categories: {
    necessary: true,
    analytics: false,
    marketing: false,
  },
  consentedAt: '2024-01-01T00:00:00.000Z',
  region: 'eu',
  policyVersion: '2024-01-01',
  bannerVersion: '2024-01-01',
  cookiePolicyVersion: '2024-01-01',
}

describe('consent gating', () => {
  it('does not load analytics without consent', () => {
    assert.equal(shouldLoadAnalytics(null), false)
    assert.equal(shouldLoadAnalytics(baseConsent), false)
  })

  it('loads analytics only when opted in', () => {
    const consent = {
      ...baseConsent,
      categories: { ...baseConsent.categories, analytics: true },
    }
    assert.equal(shouldLoadAnalytics(consent), true)
  })

  it('does not load marketing without consent', () => {
    assert.equal(shouldLoadMarketing(null), false)
    assert.equal(shouldLoadMarketing(baseConsent), false)
  })

  it('loads marketing only when opted in', () => {
    const consent = {
      ...baseConsent,
      categories: { ...baseConsent.categories, marketing: true },
    }
    assert.equal(shouldLoadMarketing(consent), true)
  })
})
