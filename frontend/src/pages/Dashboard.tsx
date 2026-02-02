import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Video, Calendar, Users, Zap, ArrowRight, Sparkles, ClipboardList } from 'lucide-react'
import api from '../lib/api'

import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { CreditBanner } from '../components/ui/CreditBanner'
import { OnboardingPanel } from '../components/dashboard/OnboardingPanel'



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

interface ActivityItem {
  id: string
  type: 'video' | 'post'
  title: string
  status: string
  timestamp: string
  platform?: string
}

interface NextScheduled {
  id: string
  scheduled_time: string
  platform: string
  status: string
  topic?: string
}

interface PlanHealth {
  totalPlans: number
  activePlans: number
  failedItems: number
  inFlightItems: number
}

export function Dashboard() {
  const { t } = useLanguage()
  useAuth()
  useCreditsContext()
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null)
  const [postStats, setPostStats] = useState<PostStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [nextScheduled, setNextScheduled] = useState<NextScheduled | null>(null)
  const [planHealth, setPlanHealth] = useState<PlanHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()

    // Safety timeout to forcefully clear loading state if API hangs
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Dashboard stats loading timed out')
        setLoading(false)
      }
    }, 5000)

    return () => clearTimeout(timeout)
  }, [])

  const loadStats = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/dashboard/activity'),
      ])

      setVideoStats(statsRes.data.videos)
      setPostStats(statsRes.data.posts)
      setActivity(activityRes.data.activity || [])
      setNextScheduled(activityRes.data.nextScheduled)
      setPlanHealth(activityRes.data.planHealth)
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
        <CreditBanner />
        <OnboardingPanel />

        <section className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-6 sm:p-8 text-white shadow-[0_60px_120px_-70px_rgba(79,70,229,0.9)]">
          <div className="absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{t('common.dashboard')}</p>
              <h1 className="text-3xl font-semibold md:text-4xl">{t('dashboard.title')}</h1>
              <p className="text-sm text-white/80">
                {t('dashboard.description')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 text-sm font-medium">
              <Link to="/quick-create" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto border border-white/20 bg-white/20 text-white backdrop-blur hover:bg-white/30 hover:text-white shadow-lg active:scale-[0.98]">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('dashboard.create_video')}
                </Button>
              </Link>
              <Link to="/planning" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto border border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white active:scale-[0.98]"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {t('dashboard.create_plan')}
                </Button>
              </Link>
              <Link to="/videos" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto border border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20 hover:text-white active:scale-[0.98]"
                >
                  <Video className="mr-2 h-4 w-4" />
                  {t('dashboard.library')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-100/60 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('dashboard.total_videos')}</p>
                <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight truncate">{videoStats?.total || 0}</p>
                <p className="mt-2 text-[10px] sm:text-xs text-slate-400 leading-tight">{t('dashboard.total_videos_desc')}</p>
              </div>
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-[18px] bg-brand-50 text-brand-600 shadow-sm border border-brand-100/50">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('dashboard.completed')}</p>
                  <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight truncate">{videoStats?.completed || 0}</p>
                </div>
                <Badge variant="success" className="shrink-0">{t('dashboard.live_badge') || 'Live'}</Badge>
              </div>
              <p className="mt-4 text-[10px] sm:text-xs text-slate-400 leading-tight">{t('dashboard.completed_desc')}</p>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-100/60 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('dashboard.generating')}</p>
                  <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight truncate">{videoStats?.generating || 0}</p>
                </div>
                <Badge variant="info" className="shrink-0">{t('dashboard.in_flight_badge') || 'In flight'}</Badge>
              </div>
              <p className="mt-4 text-[10px] sm:text-xs text-slate-400 leading-tight">{t('dashboard.generating_desc')}</p>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-100/60 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('dashboard.scheduled_posts')}</p>
                  <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight truncate">{postStats?.pending || 0}</p>
                </div>
                <Calendar className="h-5 w-5 text-amber-500 shrink-0" />
              </div>
              <p className="mt-4 text-[10px] sm:text-xs text-slate-400 leading-tight">
                {postStats?.posted || 0} {t('dashboard.posted_desc')}
              </p>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-8 top-0 h-32 rounded-3xl bg-gradient-to-r from-brand-100/70 via-brand-50/50 to-transparent blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-lg font-semibold text-primary">{t('dashboard.quick_actions')}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {t('dashboard.quick_actions_desc')}
              </p>

              <div className="mt-6 grid gap-4">
                <Link
                  to="/create"
                  className="group flex items-center justify-between rounded-2xl border-2 border-brand-200 bg-gradient-to-r from-brand-50/80 to-indigo-50/60 px-4 py-3 sm:px-5 sm:py-4 transition-all hover:border-brand-300 hover:shadow-[0_18px_45px_-30px_rgba(99,102,241,0.45)] touch-manipulation active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-md">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">{t('dashboard.create_video')}</p>
                      <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500 leading-none truncate">{t('dashboard.create_video_desc')}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-600 transition group-hover:translate-x-0.5 shrink-0" />
                </Link>

                <Link
                  to="/planning"
                  className="group flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-3 sm:px-5 sm:py-4 transition-all hover:border-brand-200 hover:shadow-[0_18px_45px_-30px_rgba(99,102,241,0.45)] touch-manipulation active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-[18px] bg-indigo-50 text-indigo-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">{t('dashboard.create_plan')}</p>
                      <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500 leading-none truncate">{t('dashboard.create_plan_desc')}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-600 transition group-hover:translate-x-0.5 shrink-0" />
                </Link>

                <Link
                  to="/social"
                  className="group flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 sm:px-5 sm:py-4 transition-all hover:border-brand-200 hover:shadow-[0_18px_45px_-30px_rgba(99,102,241,0.45)] touch-manipulation active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-[18px] bg-sky-50 text-sky-500">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">{t('dashboard.connect_social')}</p>
                      <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500 leading-none truncate">{t('dashboard.connect_social_desc')}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-600 transition group-hover:translate-x-0.5 shrink-0" />
                </Link>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-12 top-0 h-28 rounded-3xl bg-gradient-to-r from-slate-200/70 via-slate-100/50 to-transparent blur-3xl" />
            <div className="relative z-10 h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary">{t('dashboard.recent_activity')}</h2>
                <Badge variant="default">{t('dashboard.live_feed')}</Badge>
              </div>
              <div className="mt-5 space-y-4 text-sm text-slate-500">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t('dashboard.next_scheduled')}</p>
                    {nextScheduled ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{nextScheduled.topic || t('dashboard.next_scheduled_fallback')}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(nextScheduled.scheduled_time).toLocaleString()} · {nextScheduled.platform}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">{t('dashboard.no_next_scheduled')}</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t('dashboard.plan_health')}</p>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <p>
                        <span className="font-semibold text-slate-900">{planHealth?.activePlans ?? 0}</span>/{planHealth?.totalPlans ?? 0} {t('dashboard.active_plans')}
                      </p>
                      <p>
                        {planHealth?.inFlightItems ?? 0} {t('dashboard.items_in_flight')} · {planHealth?.failedItems ?? 0} {t('dashboard.items_failed')}
                      </p>
                    </div>
                  </div>
                </div>

                {activity.length > 0 ? (
                  <div className="space-y-3">
                    {activity.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 line-clamp-1">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.type === 'video' ? t('dashboard.activity_video') : t('dashboard.activity_post')}
                            {item.platform ? ` · ${item.platform}` : ''}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-400 whitespace-nowrap">
                          <p className="capitalize">{item.status}</p>
                          <p>{new Date(item.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p>{t('dashboard.no_activity')}</p>
                    <p className="text-xs text-slate-400">{t('dashboard.keep_shipping')}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>
      </div>
    </Layout>
  )
}
