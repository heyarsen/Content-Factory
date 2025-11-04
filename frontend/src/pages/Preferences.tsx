import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { useToast } from '../hooks/useToast'
import { Settings, Globe, Bell, Sparkles } from 'lucide-react'
import api from '../lib/api'

interface Preferences {
  user_id: string
  timezone: string
  default_platforms: string[]
  notifications_enabled: boolean
  auto_research_default: boolean
  auto_approve_default: boolean
}

// Common timezones
const timezones = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

const availablePlatforms = ['instagram', 'youtube', 'tiktok', 'twitter']

export function Preferences() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
  }, [])

  const loadPreferences = async () => {
    try {
      const response = await api.get('/api/preferences')
      if (response.data.preferences) {
        setPreferences(response.data.preferences)
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setLoading(false)
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
              {availablePlatforms.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                    preferences.default_platforms.includes(platform)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {platform}
                  {preferences.default_platforms.includes(platform) && (
                    <span className="ml-2">✓</span>
                  )}
                </button>
              ))}
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
