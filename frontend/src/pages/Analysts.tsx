import { useEffect, useMemo, useState } from 'react'
import { BarChart3, TrendingUp, Users, AlertCircle, Eye, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
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

const formatNumber = (value: number | undefined) => Number(value || 0).toLocaleString()

const getTrendDelta = (series: TimeSeriesPoint[] | undefined) => {
  const values = (series || []).map((item) => Number(item.value || 0)).filter((value) => Number.isFinite(value))
  if (values.length < 2) return null

  const previous = values[values.length - 2]
  const current = values[values.length - 1]
  if (previous === 0) {
    return {
      absolute: current,
      percent: current === 0 ? 0 : 100,
      up: current >= previous,
    }
  }

  const absolute = current - previous
  const percent = (absolute / previous) * 100

  return {
    absolute,
    percent,
    up: absolute >= 0,
  }
}

const renderSparklinePath = (points: TimeSeriesPoint[]) => {
  if (!points.length) return ''

  const values = points.map((point) => Number(point.value || 0))
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
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

  const platformEntries = useMemo(() => Object.entries(analytics), [analytics])

  const totals = useMemo(() => {
    return platformEntries.reduce(
      (acc, [, item]) => ({
        followers: acc.followers + Number(item.followers || 0),
        impressions: acc.impressions + Number(item.impressions || 0),
        reach: acc.reach + Number(item.reach || 0),
        profileViews: acc.profileViews + Number(item.profileViews || 0),
      }),
      { followers: 0, impressions: 0, reach: 0, profileViews: 0 }
    )
  }, [platformEntries])

  const aggregateReachSeries = useMemo(() => {
    const buckets = new Map<string, number>()

    platformEntries.forEach(([, stats]) => {
      ;(stats.reach_timeseries || []).forEach((point) => {
        const date = point.date || 'Unknown'
        buckets.set(date, (buckets.get(date) || 0) + Number(point.value || 0))
      })
    })

    return Array.from(buckets.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [platformEntries])

  const overallTrend = useMemo(() => getTrendDelta(aggregateReachSeries), [aggregateReachSeries])

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Insights</p>
          <h1 className="text-3xl font-semibold text-primary">Analytics</h1>
          <p className="text-sm text-slate-500">Live cross-platform intelligence powered by your Upload-Post analytics data.</p>
        </div>

        <Card className="p-5 md:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-24 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-3xl" />
              <Skeleton className="h-52 rounded-3xl" />
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
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="flex items-center gap-3 p-5">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Followers</p>
                    <p className="text-xl font-semibold text-primary">{formatNumber(totals.followers)}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                  <BarChart3 className="h-5 w-5 text-brand-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Impressions</p>
                    <p className="text-xl font-semibold text-primary">{formatNumber(totals.impressions)}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Reach</p>
                    <p className="text-xl font-semibold text-primary">{formatNumber(totals.reach)}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-5">
                  <Eye className="h-5 w-5 text-fuchsia-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Profile views</p>
                    <p className="text-xl font-semibold text-primary">{formatNumber(totals.profileViews)}</p>
                  </div>
                </Card>
              </div>

              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">Reach trend snapshot</h2>
                    <p className="text-sm text-slate-500">Combined reach over time from all connected channels.</p>
                  </div>
                  {overallTrend && (
                    <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${overallTrend.up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {overallTrend.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {overallTrend.percent.toFixed(1)}% vs previous point
                    </div>
                  )}
                </div>

                {aggregateReachSeries.length > 1 ? (
                  <div className="space-y-3">
                    <div className="h-44 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                        <path d={renderSparklinePath(aggregateReachSeries)} fill="none" stroke="rgb(79,70,229)" strokeWidth="2.5" />
                      </svg>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 md:grid-cols-4">
                      {aggregateReachSeries.slice(-4).map((point) => (
                        <div key={point.date} className="rounded-xl bg-slate-50 p-3">
                          <p className="truncate font-medium text-slate-700">{point.date}</p>
                          <p>{formatNumber(point.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    Not enough time-series data yet to render a trend. Keep posting and check back soon.
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-primary">Platform breakdown</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-2 py-3">Platform</th>
                        <th className="px-2 py-3">Followers</th>
                        <th className="px-2 py-3">Reach</th>
                        <th className="px-2 py-3">Impressions</th>
                        <th className="px-2 py-3">Profile views</th>
                        <th className="px-2 py-3">Reach/Follower</th>
                        <th className="px-2 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformEntries.map(([platform, stats]) => {
                        const followers = Number(stats.followers || 0)
                        const reach = Number(stats.reach || 0)
                        const ratio = followers > 0 ? (reach / followers).toFixed(2) : '0.00'

                        return (
                          <tr key={platform} className="border-b border-slate-100 text-slate-700">
                            <td className="px-2 py-3 font-medium capitalize text-slate-900">{platform}</td>
                            <td className="px-2 py-3">{formatNumber(stats.followers)}</td>
                            <td className="px-2 py-3">{formatNumber(stats.reach)}</td>
                            <td className="px-2 py-3">{formatNumber(stats.impressions)}</td>
                            <td className="px-2 py-3">{formatNumber(stats.profileViews)}</td>
                            <td className="px-2 py-3">{ratio}</td>
                            <td className="px-2 py-3 text-xs">
                              {stats.message ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{stats.message}</span>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Synced</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
