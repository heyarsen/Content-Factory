import { FormEvent, useEffect, useState } from 'react'
import { Loader2, Search, Flame } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import api from '../lib/api'

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

export function TrendSearcher() {
  const [trendQuery, setTrendQuery] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<TrendItem['platform'][]>(['tiktok', 'instagram_reels', 'youtube_shorts'])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [trends, setTrends] = useState<TrendItem[]>([])

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

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Insights</p>
          <h1 className="text-3xl font-semibold text-primary">Trend Searcher</h1>
          <p className="text-sm text-slate-500">Find recent short-form trends, powered by YouTube Data API and connected trend providers.</p>
        </div>

        <Card className="p-5 md:p-6">
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
        </Card>
      </div>
    </Layout>
  )
}
