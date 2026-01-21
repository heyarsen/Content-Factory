import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../hooks/useToast'
import { Settings, Globe, Bell, Share2, Instagram, Youtube, Facebook, Users } from 'lucide-react'
import api from '../lib/api'
import { timezones } from '../lib/timezones'
import { useLanguage } from '../contexts/LanguageContext'

interface Preferences {
  user_id: string
  timezone: string
  default_platforms: string[]
  notifications_enabled: boolean
  auto_research_default: boolean
  auto_approve_default: boolean
}

interface SocialAccount {
  id: string
  platform: string
  status: string
}


const availablePlatforms = ['instagram', 'youtube', 'tiktok', 'x', 'linkedin', 'pinterest', 'threads', 'facebook']
const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Users,
  facebook: Facebook,
  x: Share2,
  linkedin: Share2,
  pinterest: Share2,
  threads: Share2,
}

export function Preferences() {
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [preferences, setPreferences] = useState<Preferences>({
    user_id: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    default_platforms: [],
    notifications_enabled: true,
    auto_research_default: true,
    auto_approve_default: false,
  })

  const platformNames: Record<string, string> = {
    instagram: t('platforms.instagram'),
    youtube: t('platforms.youtube'),
    tiktok: t('platforms.tiktok'),
    facebook: t('platforms.facebook'),
    x: t('platforms.x'),
    linkedin: t('platforms.linkedin'),
    pinterest: t('platforms.pinterest'),
    threads: t('platforms.threads'),
  }

  useEffect(() => {
    loadPreferences()
    loadSocialAccounts()
  }, [])

  const loadPreferences = async () => {
    try {
      const response = await api.get('/api/preferences')
      if (response.data.preferences) {
        // Auto-detect timezone if not set
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        setPreferences({
          ...response.data.preferences,
          timezone: response.data.preferences.timezone || detectedTimezone,
        })
      } else {
        // No preferences exist, use detected timezone
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        setPreferences(prev => ({ ...prev, timezone: detectedTimezone }))
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      // Use detected timezone as fallback
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setPreferences(prev => ({ ...prev, timezone: detectedTimezone }))
    } finally {
      setLoading(false)
    }
  }

  const loadSocialAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      setSocialAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load social accounts:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/api/auth/preferences', preferences)
      toast.success(t('preferences.preferences_saved'))
    } catch (error) {
      toast.error(t('preferences.preferences_save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setPreferences({
      ...preferences,
      default_platforms: preferences.default_platforms.includes(platform)
        ? preferences.default_platforms.filter((p) => p !== platform)
        : [...preferences.default_platforms, platform],
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="h-32" />
          <div className="h-96" />
        </div>
      </Layout>
    )
  }

  const connectedPlatforms = socialAccounts
    .filter((acc: SocialAccount) => acc.status === 'connected')
    .map((acc: SocialAccount) => acc.platform)

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t('common.settings')}</p>
            <h1 className="text-3xl font-semibold text-primary">{t('preferences.title')}</h1>
            <p className="text-sm text-slate-500">
              {t('preferences.description')}
            </p>
          </div>
          <Button onClick={handleSave} loading={saving}>
            {t('common.save')}
          </Button>
        </div>

        {/* Language Selection */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Globe className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.language')}</h2>
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {[
              { code: 'en', name: 'English', flag: '🇺🇸' },
              { code: 'ru', name: 'Русский', flag: '🇷🇺' },
              { code: 'uk', name: 'Українська', flag: '🇺🇦' },
              { code: 'es', name: 'Español', flag: '🇪🇸' },
              { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as any)}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 transition-all hover:scale-[1.02] ${language === lang.code
                  ? 'border-brand-500 bg-brand-50 shadow-md'
                  : 'border-slate-100 bg-white hover:border-brand-200'
                  }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${language === lang.code ? 'text-brand-700' : 'text-slate-700'}`}>
                    {lang.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Connected Social Media */}
        {connectedPlatforms.length > 0 && (
          <Card className="p-6">
            <div className="mb-6 flex items-center gap-3">
              <Share2 className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-primary">{t('preferences.connected_social')}</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {connectedPlatforms.map((platform: string) => {
                const Icon = platformIcons[platform] || Share2
                return (
                  <div
                    key={platform}
                    className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2"
                  >
                    <Icon className="h-4 w-4 text-brand-600" />
                    <span className="text-sm font-medium text-brand-700">
                      {platformNames[platform] || platform}
                    </span>
                    <Badge variant="success">Connected</Badge>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {t('preferences.manage_social_desc')}{' '}
              <a href="/social" className="text-brand-600 hover:underline">
                {t('common.social_accounts')}
              </a>
            </p>
          </Card>
        )}

        {/* Timezone */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Globe className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.timezone')}</h2>
          </div>
          <div className="space-y-4">
            <Select
              label={t('video_planning.timezone')}
              value={preferences.timezone}
              onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              options={timezones}
            />
            <p className="text-xs text-slate-500">
              {t('preferences.timezone_desc')}
              <br />
              {t('preferences.detected_timezone')} <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
            </p>
          </div>
        </Card>

        {/* Default Platforms */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Settings className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.default_platforms')}</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('preferences.default_platforms_desc')}
            </p>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((platform) => {
                const isConnected = connectedPlatforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    disabled={!isConnected}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${preferences.default_platforms.includes(platform)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : isConnected
                        ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                    title={!isConnected ? 'Connect this platform in Social Accounts first' : ''}
                  >
                    {platformNames[platform] || platform}
                    {preferences.default_platforms.includes(platform) && (
                      <span className="ml-2">✓</span>
                    )}
                    {!isConnected && <span className="ml-2 text-xs">({t('video_planning.pending')})</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>


        {/* Notifications */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Bell className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('header.notifications')}</h2>
          </div>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="notifications"
              checked={preferences.notifications_enabled}
              onChange={(e) =>
                setPreferences({ ...preferences, notifications_enabled: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            <div className="flex-1">
              <label htmlFor="notifications" className="text-sm font-medium text-slate-700">
                {t('preferences.enable_notifications')}
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('preferences.notifications_desc')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
