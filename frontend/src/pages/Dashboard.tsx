import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Video, Plus, Calendar, Users } from 'lucide-react'
import api from '../lib/api'

interface VideoStats {
  total: number
  completed: number
  generating: number
  failed: number
}

interface PostStats {
  pending: number
  posted: number
}

export function Dashboard() {
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null)
  const [postStats, setPostStats] = useState<PostStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [videosRes, postsRes] = await Promise.all([
        api.get('/api/videos'),
        api.get('/api/posts'),
      ])

      const videos = videosRes.data.videos || []
      const posts = postsRes.data.posts || []

      setVideoStats({
        total: videos.length,
        completed: videos.filter((v: any) => v.status === 'completed').length,
        generating: videos.filter((v: any) => v.status === 'generating').length,
        failed: videos.filter((v: any) => v.status === 'failed').length,
      })

      setPostStats({
        pending: posts.filter((p: any) => p.status === 'pending').length,
        posted: posts.filter((p: any) => p.status === 'posted').length,
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-48 rounded-[32px]" />
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-8 text-white shadow-[0_60px_120px_-70px_rgba(79,70,229,0.9)]">
          <div className="absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Command center</p>
              <h1 className="text-3xl font-semibold md:text-4xl">Creator Studio Dashboard</h1>
              <p className="text-sm text-white/80">
                Monitor generation progress, orchestrate your pipelines, and keep distribution running smoothly
                across every channel.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <Link to="/videos">
                <Button className="border border-white/20 bg-white/15 text-white backdrop-blur hover:bg-white/25 hover:text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate video
                </Button>
              </Link>
              <Link to="/videos">
                <Button
                  variant="ghost"
                  className="border border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20 hover:text-white"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Library
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total videos</p>
                <p className="mt-3 text-4xl font-semibold text-primary">{videoStats?.total || 0}</p>
                <p className="mt-2 text-xs text-slate-400">Across all styles and formats</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Completed</p>
                  <p className="mt-3 text-4xl font-semibold text-primary">{videoStats?.completed || 0}</p>
                </div>
                <Badge variant="success">Live</Badge>
              </div>
              <p className="mt-4 text-xs text-slate-400">Ready to publish or distribute</p>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-100/60 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Generating</p>
                  <p className="mt-3 text-4xl font-semibold text-primary">{videoStats?.generating || 0}</p>
                </div>
                <Badge variant="info">In flight</Badge>
              </div>
              <p className="mt-4 text-xs text-slate-400">AI renderings actively producing assets</p>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-100/60 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Scheduled posts</p>
                  <p className="mt-3 text-4xl font-semibold text-primary">{postStats?.pending || 0}</p>
                </div>
                <Calendar className="h-5 w-5 text-amber-500" />
              </div>
              <p className="mt-4 text-xs text-slate-400">
                {postStats?.posted || 0} published automatically last cycle
              </p>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-8 top-0 h-32 rounded-3xl bg-gradient-to-r from-brand-100/70 via-brand-50/50 to-transparent blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-lg font-semibold text-primary">Quick orchestration</h2>
              <p className="mt-2 text-sm text-slate-500">
                Launch new creative, sync destinations, or orchestrate your campaign pipelines without leaving the
                canvas.
              </p>

              <div className="mt-6 grid gap-4">
                <Link
                  to="/videos"
                  className="group flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-5 py-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_45px_-30px_rgba(99,102,241,0.45)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Generate new video</p>
                      <p className="text-xs text-slate-400">Craft on-brand assets in minutes</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">Launch {'->'}</span>
                </Link>

                <Link
                  to="/distribution"
                  className="group flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-5 py-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_45px_-30px_rgba(99,102,241,0.45)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Distribution</p>
                      <p className="text-xs text-slate-400">Connect accounts and schedule posts</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">Manage {'->'}</span>
                </Link>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-12 top-0 h-28 rounded-3xl bg-gradient-to-r from-slate-200/70 via-slate-100/50 to-transparent blur-3xl" />
            <div className="relative z-10 h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary">Recent activity</h2>
                <Badge variant="default">Live feed</Badge>
              </div>
              <div className="mt-6 space-y-4 text-sm text-slate-500">
                <p>No new automation alerts in the last 24 hours.</p>
                <p className="text-xs text-slate-400">Keep shipping! Activity will populate here as audiences engage.</p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </Layout>
  )
}

