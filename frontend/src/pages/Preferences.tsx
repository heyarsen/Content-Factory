import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../hooks/useToast'
import {
  Settings,
  Globe,
  Bell,
  Sparkles,
  Share2,
  Instagram,
  Youtube,
  Facebook,
  Users,
} from 'lucide-react'
import api from '../lib/api'

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

// Generate comprehensive timezone list
function getAllTimezones() {
  try {
    // Use Intl.supportedValuesOf if available (modern browsers)
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      const timezones = (Intl as any).supportedValuesOf('timeZone') as string[]
      return timezones.map((tz: string) => {
        // Format timezone name for display
        const parts = tz.split('/')
        const name = parts[parts.length - 1].replace(/_/g, ' ')
        return {
          value: tz,
          label: `${tz} - ${name}`,
        }
      }).sort((a: { value: string; label: string }, b: { value: string; label: string }) => a.label.localeCompare(b.label))
    }
  } catch (e) {
    console.warn('Intl.supportedValuesOf not available, using fallback list')
  }

  // Fallback to common timezones if Intl.supportedValuesOf is not available
  return [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'America/New_York - Eastern Time' },
    { value: 'America/Chicago', label: 'America/Chicago - Central Time' },
    { value: 'America/Denver', label: 'America/Denver - Mountain Time' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles - Pacific Time' },
    { value: 'Europe/London', label: 'Europe/London - London' },
    { value: 'Europe/Paris', label: 'Europe/Paris - Paris' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin - Berlin' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo - Tokyo' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai - Shanghai' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai - Dubai' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney - Sydney' },
  ]
}

const timezones = getAllTimezones()

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
const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

export function Preferences() {
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
      await api.put('/api/preferences', preferences)
      toast.success('Preferences saved successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save preferences')
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
    .filter(acc => acc.status === 'connected')
    .map(acc => acc.platform)

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Settings</p>
            <h1 className="text-3xl font-semibold text-primary">Preferences</h1>
            <p className="text-sm text-slate-500">
              Configure your default settings for video creation and automation.
            </p>
          </div>
          <Button onClick={handleSave} loading={saving}>
            Save Preferences
          </Button>
        </div>

        {/* Connected Social Media */}
        {connectedPlatforms.length > 0 && (
          <Card className="p-6">
            <div className="mb-6 flex items-center gap-3">
              <Share2 className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-primary">Connected Social Media</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {connectedPlatforms.map((platform) => {
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
              Manage your social media connections in{' '}
              <a href="/social" className="text-brand-600 hover:underline">
                Social Accounts
              </a>
            </p>
          </Card>
        )}

        {/* Timezone */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Globe className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Timezone</h2>
          </div>
          <div className="space-y-4">
            <Select
              label="Default Timezone"
              value={preferences.timezone}
              onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              options={timezones}
            />
            <p className="text-xs text-slate-500">
              This timezone will be used for scheduling videos and other time-based features.
              Detected timezone: <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
            </p>
          </div>
        </Card>

        {/* Default Platforms */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Settings className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Default Platforms</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Select the default platforms for posting videos. These will be pre-selected when creating new video plans.
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
                    className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                      preferences.default_platforms.includes(platform)
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
                    {!isConnected && <span className="ml-2 text-xs">(Not connected)</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Automation Defaults */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Automation Defaults</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto_research"
                checked={preferences.auto_research_default}
                onChange={(e) =>
                  setPreferences({ ...preferences, auto_research_default: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <div className="flex-1">
                <label htmlFor="auto_research" className="text-sm font-medium text-slate-700">
                  Auto-research topics
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Automatically research topics using Perplexity AI when creating video plans.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto_approve"
                checked={preferences.auto_approve_default}
                onChange={(e) =>
                  setPreferences({ ...preferences, auto_approve_default: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <div className="flex-1">
                <label htmlFor="auto_approve" className="text-sm font-medium text-slate-700">
                  Auto-approve scripts
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Automatically approve generated scripts without manual review. Recommended for trusted AI outputs.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Bell className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Notifications</h2>
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
                Enable notifications
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                Receive notifications about video generation status and other important updates.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
