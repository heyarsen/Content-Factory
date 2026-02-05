import { CONSENT_BANNER_VERSION, COOKIE_POLICY_VERSION } from './privacyConfig'

export type ConsentCategories = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export type ConsentRecord = {
  categories: ConsentCategories
  consentedAt: string
  region: 'eu' | 'non-eu' | 'unknown'
  policyVersion: string
  bannerVersion: string
  cookiePolicyVersion: string
}

const STORAGE_KEY = 'cf_consent_v1'
const COOKIE_KEY = 'cf_consent'

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'CH', 'GB', 'UK',
])

export function resolveRegion(): ConsentRecord['region'] {
  if (typeof navigator === 'undefined') {
    return 'eu'
  }

  const locale = navigator.language || ''
  const localeParts = locale.split('-')
  if (localeParts.length > 1) {
    const country = localeParts[1].toUpperCase()
    if (EU_COUNTRY_CODES.has(country)) {
      return 'eu'
    }
    return 'non-eu'
  }

  return 'eu'
}

export function defaultConsent(): ConsentCategories {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
  }
}

export function shouldLoadAnalytics(consent?: ConsentRecord | null): boolean {
  return Boolean(consent?.categories.analytics)
}

export function shouldLoadMarketing(consent?: ConsentRecord | null): boolean {
  return Boolean(consent?.categories.marketing)
}

export function buildConsentRecord(categories: ConsentCategories, region: ConsentRecord['region']): ConsentRecord {
  return {
    categories,
    consentedAt: new Date().toISOString(),
    region,
    policyVersion: COOKIE_POLICY_VERSION,
    bannerVersion: CONSENT_BANNER_VERSION,
    cookiePolicyVersion: COOKIE_POLICY_VERSION,
  }
}

export function loadStoredConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as ConsentRecord
  } catch {
    return null
  }
}

export function saveConsent(consent: ConsentRecord): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  const cookieValue = encodeURIComponent(JSON.stringify(consent))
  document.cookie = `${COOKIE_KEY}=${cookieValue}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

export function clearConsent(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
  document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
}
