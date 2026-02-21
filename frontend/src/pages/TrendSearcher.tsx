import { FormEvent, useEffect, useRef, useState } from 'react'
import { Loader2, Search, Flame } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import api from '../lib/api'

interface TrendItem {
  platform: 'youtube_shorts'
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

export function TrendSearcher() {
  const [trendQuery, setTrendQuery] = useState('')
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [trends, setTrends] = useState<TrendItem[]>([])
  const latestSearchRequestId = useRef(0)

  const searchTrends = async (event?: FormEvent) => {
    event?.preventDefault()
    const requestId = latestSearchRequestId.current + 1
    latestSearchRequestId.current = requestId

    setTrendLoading(true)
    setTrendError(null)

    try {
      const response = await api.post('/api/trends/search', {
        query: trendQuery,
        limit: 9,
      })

      if (latestSearchRequestId.current === requestId) {
        setTrends(response.data?.trends || [])
      }
    } catch (requestError: any) {
      const message = requestError?.response?.data?.error || requestError?.message || 'Failed to load trends'
      if (latestSearchRequestId.current === requestId) {
        setTrendError(message)
        setTrends([])
      }
    } finally {
      if (latestSearchRequestId.current === requestId) {
        setTrendLoading(false)
      }
    }
  }

  useEffect(() => {
    searchTrends()
  }, [])

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Insights</p>
          <h1 className="text-3xl font-semibold text-primary">Trend Searcher</h1>
          <p className="text-sm text-slate-500">Find viral YouTube Shorts only (100K+ views, published within 30 days) so you can turn proven trends into new video ideas.</p>
        </div>

        <Card className="p-5 md:p-6">
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
            <p className="text-sm text-slate-500">No viral matches found yet (100K+ views in last 30 days). Try another topic.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {trends.map((trend, index) => (
                <Card key={`${trend.platform}-${trend.trend}-${index}`} className="h-full p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Trending format</p>
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
