import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'
import {
  buildConsentRecord,
  ConsentCategories,
  ConsentRecord,
  defaultConsent,
  loadStoredConsent,
  resolveRegion,
  saveConsent,
  shouldLoadAnalytics,
  shouldLoadMarketing,
} from '../../lib/consent'
import { CookiePreferencesModal } from './CookiePreferencesModal'
import { Button } from '../ui/Button'
import { useLanguage } from '../../contexts/LanguageContext'
import { CONSENT_BANNER_VERSION, COOKIE_POLICY_VERSION } from '../../lib/privacyConfig'

const ANALYTICS_SCRIPT_ID = 'analytics-script'
const MARKETING_SCRIPT_ID = 'marketing-script'

function loadAnalyticsScript() {
  const analyticsId = import.meta.env.VITE_GA_ID
  if (!analyticsId) {
    return
  }

  if (document.getElementById(ANALYTICS_SCRIPT_ID)) {
    return
  }

  const script = document.createElement('script')
  script.id = ANALYTICS_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`
  script.dataset.consentCategory = 'analytics'
  document.head.appendChild(script)

  const inlineScript = document.createElement('script')
  inlineScript.dataset.consentCategory = 'analytics'
  inlineScript.text = `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${analyticsId}', { anonymize_ip: true });`
  document.head.appendChild(inlineScript)
}

function loadMarketingScript() {
  const metaPixelId = import.meta.env.VITE_META_PIXEL_ID
  if (!metaPixelId) {
    return
  }

  if (document.getElementById(MARKETING_SCRIPT_ID)) {
    return
  }

  const script = document.createElement('script')
  script.id = MARKETING_SCRIPT_ID
  script.async = true
  script.dataset.consentCategory = 'marketing'
  script.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?\n  n.callMethod.apply(n,arguments):n.queue.push(arguments)};\n  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\n  n.queue=[];t=b.createElement(e);t.async=!0;\n  t.src=v;s=b.getElementsByTagName(e)[0];\n  s.parentNode.insertBefore(t,s)}(window, document,'script',\n  'https://connect.facebook.net/en_US/fbevents.js');\n  fbq('init', '${metaPixelId}');\n  fbq('track', 'PageView');`
  document.head.appendChild(script)
}

function persistConsent(consent: ConsentRecord) {
  saveConsent(consent)
}

export function CookieConsentManager() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [region] = useState(() => resolveRegion())
  const storedConsent = useMemo(() => loadStoredConsent(), [])
  const [consent, setConsent] = useState<ConsentRecord | null>(storedConsent)
  const [showBanner, setShowBanner] = useState(!storedConsent)
  const [showPreferences, setShowPreferences] = useState(false)
  const [syncedConsentAt, setSyncedConsentAt] = useState<string | null>(null)

  useEffect(() => {
    if (consent && shouldLoadAnalytics(consent)) {
      loadAnalyticsScript()
    }

    if (consent && shouldLoadMarketing(consent)) {
      loadMarketingScript()
    }
  }, [consent])

  useEffect(() => {
    if (!user || !consent || syncedConsentAt === consent.consentedAt) {
      return
    }

    api.post('/api/privacy/consent', {
      categories: consent.categories,
      region: consent.region,
      policyVersion: consent.policyVersion,
      bannerVersion: consent.bannerVersion,
      consentedAt: consent.consentedAt,
    }).then(() => {
      setSyncedConsentAt(consent.consentedAt)
    }).catch((error) => {
      console.warn('Failed to sync consent:', error)
    })
  }, [consent, syncedConsentAt, user])
  useEffect(() => {
    const openHandler = () => setShowPreferences(true)
    window.addEventListener('open-cookie-preferences', openHandler)
    return () => window.removeEventListener('open-cookie-preferences', openHandler)
  }, [])

  const applyConsent = (categories: ConsentCategories) => {
    const updated = buildConsentRecord(categories, region)
    setConsent(updated)
    persistConsent(updated)
    setShowBanner(false)
  }

  const handleAcceptAll = () =>
    applyConsent({ necessary: true, analytics: true, marketing: true })

  const handleReject = () =>
    applyConsent({ necessary: true, analytics: false, marketing: false })

  const handleManage = () => {
    setShowPreferences(true)
  }

  const currentCategories = consent?.categories || defaultConsent()

  if (!showBanner) {
    return (
      <CookiePreferencesModal
        isOpen={showPreferences}
        categories={currentCategories}
        onClose={() => setShowPreferences(false)}
        onSave={applyConsent}
      />
    )
  }

  return (
    <>
      <CookiePreferencesModal
        isOpen={showPreferences}
        categories={currentCategories}
        onClose={() => setShowPreferences(false)}
        onSave={applyConsent}
      />
      <div className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.8)] backdrop-blur-xl sm:left-auto sm:right-6 sm:max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          {t('legal.cookies.banner_title')}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">
          {t('legal.cookies.banner_heading')}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {t('legal.cookies.banner_desc')} (v{COOKIE_POLICY_VERSION}/{CONSENT_BANNER_VERSION}).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={handleAcceptAll}>{t('legal.cookies.accept_all')}</Button>
          <Button variant="secondary" onClick={handleReject}>
            {t('legal.cookies.reject_non_essential')}
          </Button>
          <button
            type="button"
            onClick={handleManage}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            {t('legal.cookies.manage_preferences')}
          </button>
        </div>
      </div>
    </>
  )
}
