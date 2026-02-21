import { useEffect, useMemo, useState } from 'react'
import { BarChart3, TrendingUp, Users, AlertCircle } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import api from '../lib/api'

interface SocialAnalyticsAccount {
  id: string
  platform: string
  status: string
  platform_account_id?: string | null
}

interface TimeSeriesPoint {
  date?: string
  value?: number
}

interface PlatformAnalytics {
  followers?: number
  impressions?: number
  profileViews?: number
  reach?: number
  reach_timeseries?: TimeSeriesPoint[]
  message?: string
}

export function Analysts() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<Record<string, PlatformAnalytics>>({})

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true)
      setError(null)

      try {
        const accountsRes = await api.get('/api/social/accounts')
        const connectedAccounts: SocialAnalyticsAccount[] = (accountsRes.data?.accounts || [])
          .filter((account: SocialAnalyticsAccount) => account.status === 'connected' && account.platform_account_id)

        if (!connectedAccounts.length) {
          setAnalytics({})
          return
        }

        const profileUsername = connectedAccounts[0].platform_account_id as string
        const uniquePlatforms = Array.from(new Set(connectedAccounts.map((account) => account.platform.toLowerCase())))

        const analyticsRes = await api.get(`/api/social/analytics/${encodeURIComponent(profileUsername)}`, {
          params: {
            platforms: uniquePlatforms.join(','),
          },
        })

        setAnalytics(analyticsRes.data || {})
      } catch (requestError: any) {
        const message = requestError?.response?.data?.error || requestError?.message || 'Failed to load analytics'
        setError(message)
        setAnalytics({})
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  const totals = useMemo<{ followers: number; impressions: number; reach: number }>(() => {
    return Object.values(analytics).reduce<{ followers: number; impressions: number; reach: number }>(
      (acc, item) => ({
        followers: acc.followers + Number(item.followers || 0),
        impressions: acc.impressions + Number(item.impressions || 0),
        reach: acc.reach + Number(item.reach || 0),
      }),
      { followers: 0, impressions: 0, reach: 0 }
    )
  }, [analytics])

  const platformEntries = Object.entries(analytics)

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Insights</p>
          <h1 className="text-3xl font-semibold text-primary">Analytics</h1>
          <p className="text-sm text-slate-500">Live metrics from your connected social accounts.</p>
        </div>

        <Card className="p-5 md:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-24 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-3xl" />
            </div>
          ) : error ? (
            <Card className="border-red-200 bg-red-50/60 p-6">
              <div className="flex items-start gap-3 text-red-700">
                <AlertCircle className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-semibold">Unable to load analytics</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </Card>
          ) : platformEntries.length === 0 ? (
            <Card className="p-6 text-sm text-slate-600">
              No connected social accounts found. Connect your social account to start seeing analytics.
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="flex items-center gap-3 p-5">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Followers</p>
                    <p className="text-xl font-semibold text-primary">{totals.followers.toLocaleString()}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                  <BarChart3 className="h-5 w-5 text-brand-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Impressions</p>
                    <p className="text-xl font-semibold text-primary">{totals.impressions.toLocaleString()}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Reach</p>
                    <p className="text-xl font-semibold text-primary">{totals.reach.toLocaleString()}</p>
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {platformEntries.map(([platform, stats]) => (
                  <Card key={platform} className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold capitalize text-primary">{platform}</h2>
                      {stats.message && <span className="text-xs text-amber-600">{stats.message}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-slate-500">Followers</p>
                        <p className="text-lg font-semibold text-primary">{(stats.followers || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-slate-500">Impressions</p>
                        <p className="text-lg font-semibold text-primary">{(stats.impressions || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-slate-500">Profile Views</p>
                        <p className="text-lg font-semibold text-primary">{(stats.profileViews || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-slate-500">Reach</p>
                        <p className="text-lg font-semibold text-primary">{(stats.reach || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </Layout>
  )
}
