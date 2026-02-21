import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BarChart3, TrendingUp, Users, AlertCircle, Loader2, Search, Flame } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
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

interface TrendItem {
  platform: 'tiktok' | 'instagram_reels' | 'youtube_shorts'
  trend: string
  videoTitle: string
  creator: string
  videoUrl: string
  summary: string
  contentIdea: string
  viewCount: string
  publishedAt: string
  observedAt: string
}

const PLATFORM_LABELS: Record<TrendItem['platform'], string> = {
  tiktok: 'TikTok',
  instagram_reels: 'Instagram Reels',
  youtube_shorts: 'YouTube Shorts',
}

export function Analysts() {
  const [activeTab, setActiveTab] = useState<'trend-searcher' | 'analytics'>('trend-searcher')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<Record<string, PlatformAnalytics>>({})
  const [trendQuery, setTrendQuery] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<TrendItem['platform'][]>(['tiktok', 'instagram_reels', 'youtube_shorts'])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [trends, setTrends] = useState<TrendItem[]>([])

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

  const searchTrends = async (event?: FormEvent) => {
    event?.preventDefault()
    setTrendLoading(true)
    setTrendError(null)

    try {
      const response = await api.post('/api/trends/search', {
        query: trendQuery,
        limit: 9,
        platforms: selectedPlatforms,
      })

      setTrends(response.data?.trends || [])
    } catch (requestError: any) {
      const message = requestError?.response?.data?.error || requestError?.message || 'Failed to load trends'
      setTrendError(message)
      setTrends([])
    } finally {
      setTrendLoading(false)
    }
  }

  useEffect(() => {
    searchTrends()
  }, [selectedPlatforms.join(',')])

  useEffect(() => {
    const connectedTrendPlatforms = Object.keys(analytics)
      .map((platform) => platform.toLowerCase())
      .filter((platform): platform is TrendItem['platform'] => ['tiktok', 'instagram_reels', 'youtube_shorts'].includes(platform))

    if (connectedTrendPlatforms.length) {
      setSelectedPlatforms(Array.from(new Set(connectedTrendPlatforms)))
    }
  }, [analytics])

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
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setActiveTab('trend-searcher')}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === 'trend-searcher' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                Trend Searcher
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === 'analytics' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                Analytics
              </button>
            </div>
            <p className="text-xs text-slate-500">Uses your connected integrations to find popular videos from the last 30 days.</p>
          </div>

          {activeTab === 'trend-searcher' && (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-primary">TrendSearcher</h2>
                  <p className="text-sm text-slate-500">Search popular short-form videos by topic in the most recent 30 days.</p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {(Object.keys(PLATFORM_LABELS) as TrendItem['platform'][]).map((platform) => {
                  const isActive = selectedPlatforms.includes(platform)
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => {
                        setSelectedPlatforms((prev) => {
                          if (prev.includes(platform)) {
                            return prev.length === 1 ? prev : prev.filter((item) => item !== platform)
                          }
                          return [...prev, platform]
                        })
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        isActive ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {PLATFORM_LABELS[platform]}
                    </button>
                  )
                })}
              </div>

              <form onSubmit={searchTrends} className="mb-5 flex flex-col gap-3 sm:flex-row">
                <Input
                  value={trendQuery}
                  onChange={(event) => setTrendQuery(event.target.value)}
                  placeholder="Choose a topic (e.g. ai content, fitness, faceless channels)"
                  className="sm:flex-1"
                />
                <Button type="submit" disabled={trendLoading} className="inline-flex items-center justify-center gap-2">
                  {trendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Check trends
                </Button>
              </form>

              {trendError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {trendError}
                </div>
              )}

              {trendLoading ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-40 rounded-2xl" />
                  ))}
                </div>
              ) : trends.length === 0 ? (
                <p className="text-sm text-slate-500">No trends yet. Try another query.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {trends.map((trend, index) => (
                    <Card key={`${trend.platform}-${trend.trend}-${index}`} className="h-full p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{PLATFORM_LABELS[trend.platform]}</p>
                        <p className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                          <Flame className="h-3 w-3" /> {trend.viewCount || 'Popular'}
                        </p>
                      </div>
                      <h3 className="mt-1 text-base font-semibold text-primary">{trend.trend}</h3>
                      <p className="mt-2 text-sm text-slate-600">{trend.summary}</p>
                      <div className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                        <p className="font-semibold text-primary">Popular video:</p>
                        <p>{trend.videoTitle || 'Top-performing video format in this topic'}</p>
                        <p className="mt-1 text-xs text-slate-500">{trend.creator}</p>
                        {trend.videoUrl && (
                          <a className="mt-1 inline-block text-xs font-semibold text-brand-600 hover:underline" href={trend.videoUrl} target="_blank" rel="noreferrer">
                            Open example
                          </a>
                        )}
                      </div>
                      <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                        <span className="font-semibold text-primary">Idea:</span> {trend.contentIdea}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'analytics' && (
            <>
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
            </>
          )}
        </Card>
      </div>
    </Layout>
  )
}
