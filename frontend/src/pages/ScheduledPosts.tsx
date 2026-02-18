import { useEffect, useMemo, useRef, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Facebook,
  Instagram,
  List,
  RefreshCw,
  TimerReset,
  Users,
  Youtube,
} from 'lucide-react'
import { CreditBanner } from '../components/ui/CreditBanner'

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook'
type ApprovalState = 'creator' | 'reviewer' | 'approver' | 'approved'
type ViewMode = 'month' | 'week' | 'list'

interface Post {
  id: string
  video_id: string
  platform: Platform
  scheduled_time: string | null
  status: 'pending' | 'posted' | 'failed' | 'cancelled' | 'draft'
  posted_at: string | null
  error_message: string | null
  caption?: string | null
  media_url?: string | null
  hashtags?: string[] | null
  videos: {
    topic: string
    video_url: string | null
  }
}

interface VariantDraft {
  caption: string
  mediaUrl: string
  hashtags: string
}

interface Campaign {
  id: string
  videoId: string
  topic: string
  posts: Post[]
  variants: Record<Platform, VariantDraft>
}

const platformIcons: Record<Platform, any> = {
  instagram: Instagram,
  tiktok: Users,
  youtube: Youtube,
  facebook: Facebook,
}

const platformNames: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
}

const emptyVariant = (): VariantDraft => ({ caption: '', mediaUrl: '', hashtags: '' })

const bestTimeSuggestions: Record<Platform, string[]> = {
  instagram: ['09:30', '12:30', '18:30'],
  tiktok: ['11:00', '15:00', '20:00'],
  youtube: ['10:00', '14:00', '19:00'],
  facebook: ['08:30', '13:00', '17:30'],
}

const normalizeStatus = (status: Post['status']): 'draft' | 'scheduled' | 'published' | 'failed' => {
  if (status === 'draft') return 'draft'
  if (status === 'posted') return 'published'
  if (status === 'failed') return 'failed'
  return 'scheduled'
}

const formatDateKey = (date: Date) => date.toISOString().split('T')[0]

export function ScheduledPosts() {
  useLanguage()
  const { user } = useAuth()
  const { credits, unlimited } = useCreditsContext()
  const hasSubscription = (user?.hasActiveSubscription || user?.role === 'admin') || false
  const safeCanCreate = hasSubscription || (credits !== null && credits > 0) || unlimited

  const [posts, setPosts] = useState<Post[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  const [scheduleModal, setScheduleModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [scheduledTime, setScheduledTime] = useState('')
  const [variantDrafts, setVariantDrafts] = useState<Record<Platform, VariantDraft>>({
    instagram: emptyVariant(),
    tiktok: emptyVariant(),
    youtube: emptyVariant(),
    facebook: emptyVariant(),
  })
  const [scheduling, setScheduling] = useState(false)

  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const [retryModalPost, setRetryModalPost] = useState<Post | null>(null)
  const [retryTime, setRetryTime] = useState('')
  const [retryCaption, setRetryCaption] = useState('')
  const [retrying, setRetrying] = useState(false)

  const [approvalByCampaign, setApprovalByCampaign] = useState<Record<string, ApprovalState>>({})
  const [autoRescheduleMissed, setAutoRescheduleMissed] = useState(true)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(() => formatDateKey(new Date()))

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    loadPosts()
    loadVideos()

    const timeout = setTimeout(() => {
      if (loading && mountedRef.current) setLoading(false)
    }, 10000)

    return () => clearTimeout(timeout)
  }, [statusFilter])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!mountedRef.current) return
      if (posts.some((p) => p.status === 'pending')) loadPosts()
    }, 10000)
    return () => clearInterval(interval)
  }, [posts])

  const loadPosts = async () => {
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      const response = await api.get('/api/posts', { params })
      if (mountedRef.current) setPosts(response.data.posts || [])
    } catch (error) {
      console.error('Failed to load posts:', error)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const loadVideos = async () => {
    try {
      const response = await api.get('/api/videos', { params: { status: 'completed' } })
      if (mountedRef.current) setVideos(response.data.videos || [])
    } catch (error) {
      console.error('Failed to load videos:', error)
    }
  }

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (platformFilter !== 'all' && post.platform !== platformFilter) return false
      if (statusFilter === 'all') return true
      return post.status === statusFilter
    })
  }, [posts, platformFilter, statusFilter])

  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {}
    filteredPosts.forEach((post) => {
      const dateKey = post.scheduled_time
        ? formatDateKey(new Date(post.scheduled_time))
        : post.posted_at
          ? formatDateKey(new Date(post.posted_at))
          : formatDateKey(new Date())
      grouped[dateKey] = [...(grouped[dateKey] || []), post]
    })
    return grouped
  }, [filteredPosts])

  const campaigns = useMemo<Campaign[]>(() => {
    const grouped = new Map<string, Campaign>()
    filteredPosts.forEach((post) => {
      if (!grouped.has(post.video_id)) {
        grouped.set(post.video_id, {
          id: `campaign-${post.video_id}`,
          videoId: post.video_id,
          topic: post.videos?.topic || 'Untitled campaign',
          posts: [],
          variants: {
            instagram: emptyVariant(),
            tiktok: emptyVariant(),
            youtube: emptyVariant(),
            facebook: emptyVariant(),
          },
        })
      }
      const campaign = grouped.get(post.video_id)!
      campaign.posts.push(post)
      campaign.variants[post.platform] = {
        caption: post.caption || '',
        mediaUrl: post.media_url || post.videos?.video_url || '',
        hashtags: Array.isArray(post.hashtags) ? post.hashtags.join(' ') : '',
      }
    })
    return Array.from(grouped.values())
  }, [filteredPosts])

  const getStatusBadge = (status: Post['status']) => {
    const normalized = normalizeStatus(status)
    const variants: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
      draft: 'default',
      scheduled: 'warning',
      published: 'success',
      failed: 'error',
    }
    return <Badge variant={variants[normalized]}>{normalized}</Badge>
  }

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]))
  }

  const getSuggestionDateTime = (platform: Platform, baseDate: Date = new Date()) => {
    const suggestion = bestTimeSuggestions[platform][0]
    const [hours, minutes] = suggestion.split(':').map(Number)
    const dt = new Date(baseDate)
    dt.setHours(hours, minutes, 0, 0)
    if (dt.getTime() < Date.now()) dt.setDate(dt.getDate() + 1)
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const handleSchedule = async () => {
    if (!selectedVideo || selectedPlatforms.length === 0) {
      alert('Please select a video and at least one platform')
      return
    }

    setScheduling(true)
    try {
      for (const platform of selectedPlatforms) {
        const variant = variantDrafts[platform]
        const resolvedTime = scheduledTime || getSuggestionDateTime(platform)
        const hashtags = variant.hashtags
          .split(' ')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .join(' ')

        await api.post('/api/posts/schedule', {
          video_id: selectedVideo,
          platforms: [platform],
          scheduled_time: resolvedTime,
          caption: [variant.caption, hashtags].filter(Boolean).join(' ').trim() || undefined,
        })
      }

      if (mountedRef.current) {
        setScheduleModal(false)
        setSelectedVideo('')
        setSelectedPlatforms([])
        setScheduledTime('')
        setVariantDrafts({
          instagram: emptyVariant(),
          tiktok: emptyVariant(),
          youtube: emptyVariant(),
          facebook: emptyVariant(),
        })
        loadPosts()
      }
    } catch (error: any) {
      console.error('Failed to schedule post:', error)
      alert(error.response?.data?.error || 'Failed to schedule post')
    } finally {
      if (mountedRef.current) setScheduling(false)
    }
  }

  const handleCancel = async (id: string) => {
    setCancelling(true)
    try {
      await api.delete(`/api/posts/${id}`)
      if (mountedRef.current) {
        setPosts((prev) => prev.filter((p) => p.id !== id))
        setCancelModal(null)
      }
    } catch (error) {
      console.error('Failed to cancel post:', error)
    } finally {
      if (mountedRef.current) setCancelling(false)
    }
  }

  const handleAutoReschedule = async (post: Post) => {
    if (!autoRescheduleMissed || !post.scheduled_time) return
    try {
      const nextSlot = getSuggestionDateTime(post.platform, new Date(post.scheduled_time))
      await api.post('/api/posts/schedule', {
        video_id: post.video_id,
        platforms: [post.platform],
        scheduled_time: nextSlot,
        caption: post.caption || undefined,
      })
      await api.delete(`/api/posts/${post.id}`)
      loadPosts()
    } catch (error) {
      console.error('Failed to auto-reschedule missed post:', error)
    }
  }

  const missedPosts = filteredPosts.filter(
    (post) => post.status === 'pending' && post.scheduled_time && new Date(post.scheduled_time).getTime() < Date.now(),
  )

  useEffect(() => {
    if (!autoRescheduleMissed) return
    missedPosts.forEach((post) => {
      handleAutoReschedule(post)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRescheduleMissed, missedPosts.length])

  const openRetryModal = (post: Post) => {
    setRetryModalPost(post)
    setRetryCaption(post.caption || '')
    setRetryTime(getSuggestionDateTime(post.platform))
  }

  const handleRetryPost = async () => {
    if (!retryModalPost) return
    setRetrying(true)
    try {
      await api.post('/api/posts/schedule', {
        video_id: retryModalPost.video_id,
        platforms: [retryModalPost.platform],
        scheduled_time: retryTime,
        caption: retryCaption || undefined,
      })
      setRetryModalPost(null)
      loadPosts()
    } catch (error) {
      console.error('Retry scheduling failed:', error)
      alert('Failed to retry post')
    } finally {
      setRetrying(false)
    }
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  const selectedDatePosts = selectedDate ? postsByDate[selectedDate] || [] : []
  const upcomingQueue = [...filteredPosts]
    .filter((p) => p.status === 'pending' && p.scheduled_time)
    .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime())

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-28 rounded-[28px]" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h1 className="text-3xl font-semibold text-primary">Calendar & Scheduling</h1>
            <p className="text-sm text-slate-500">Manage drafts, approvals, queue timing, and publishing retries.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Card className="border-dashed border-white/40 p-0 min-w-[170px]">
              <Select
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'pending', label: 'Scheduled' },
                  { value: 'posted', label: 'Published' },
                  { value: 'failed', label: 'Failed' },
                ]}
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              />
            </Card>
            <Card className="border-dashed border-white/40 p-0 min-w-[170px]">
              <Select
                options={[
                  { value: 'all', label: 'All platforms' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'tiktok', label: 'TikTok' },
                  { value: 'youtube', label: 'YouTube' },
                  { value: 'facebook', label: 'Facebook' },
                ]}
                value={platformFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlatformFilter(e.target.value)}
              />
            </Card>
            <Button
              onClick={() => {
                setScheduledTime('')
                setScheduleModal(true)
              }}
              className="shadow-[0_20px_45px_-25px_rgba(99,102,241,0.5)]"
              disabled={!safeCanCreate}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {safeCanCreate ? 'Create campaign' : 'Upgrade to schedule'}
            </Button>
          </div>
        </div>

        <CreditBanner />

        <div className="grid gap-3 sm:grid-cols-3">
          {(['month', 'week', 'list'] as ViewMode[]).map((mode) => (
            <Button key={mode} variant={viewMode === mode ? 'primary' : 'ghost'} onClick={() => setViewMode(mode)}>
              {mode === 'month' ? <Calendar className="mr-2 h-4 w-4" /> : mode === 'week' ? <Clock3 className="mr-2 h-4 w-4" /> : <List className="mr-2 h-4 w-4" />}
              {mode[0].toUpperCase() + mode.slice(1)} view
            </Button>
          ))}
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-primary">
                {viewMode === 'list'
                  ? 'All scheduled activity'
                  : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              {viewMode !== 'list' && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 px-3">
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {viewMode === 'list' ? (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const Icon = platformIcons[post.platform]
                  return (
                    <div key={post.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-semibold text-primary">{platformNames[post.platform]}</span>
                          {getStatusBadge(post.status)}
                        </div>
                        <span className="text-xs text-slate-500">{post.scheduled_time ? new Date(post.scheduled_time).toLocaleString() : 'No schedule'}</span>
                      </div>
                      <p className="text-xs text-slate-600">{post.videos?.topic}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 py-2">{day}</div>
                ))}

                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateObj = new Date(year, month, day)
                  const dateKey = formatDateKey(dateObj)
                  const dayPosts = postsByDate[dateKey] || []
                  const isToday = dateKey === formatDateKey(new Date())
                  const isSelected = selectedDate === dateKey
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                      className={`aspect-square rounded-lg sm:rounded-xl border-2 p-1 sm:p-2 text-left transition ${isSelected
                        ? 'border-brand-500 bg-brand-50'
                        : isToday
                          ? 'border-brand-300 bg-brand-50/50'
                          : dayPosts.length > 0
                            ? 'border-blue-200 bg-blue-50/50 hover:border-blue-300'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div className={`text-sm font-semibold ${isToday ? 'text-brand-600' : 'text-slate-700'}`}>{day}</div>
                      {dayPosts.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {dayPosts.slice(0, 3).map((post) => (
                            <div key={post.id} className={`h-1.5 w-1.5 rounded-full ${normalizeStatus(post.status) === 'failed' ? 'bg-red-500' : 'bg-brand-500'}`} title={platformNames[post.platform]} />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-semibold text-primary">{selectedDate ? new Date(selectedDate).toDateString() : 'Queue details'}</h3>
            {selectedDatePosts.length === 0 ? <p className="text-sm text-slate-500">No items for selected day.</p> : selectedDatePosts.map((post) => {
              const Icon = platformIcons[post.platform]
              return (
                <div key={post.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-primary">{platformNames[post.platform]}</span>
                    {getStatusBadge(post.status)}
                  </div>
                  <p className="mb-2 text-xs text-slate-600">{post.videos.topic}</p>
                  {post.status === 'failed' && (
                    <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{post.error_message || 'Publish failed'}</div>
                  )}
                  <div className="flex gap-2">
                    {post.status === 'pending' && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCancelModal(post.id)}>Cancel</Button>}
                    {post.status === 'failed' && <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => openRetryModal(post)}>Retry / Edit</Button>}
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">Queue management</h3>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={autoRescheduleMissed} onChange={(e) => setAutoRescheduleMissed(e.target.checked)} />
                Auto-reschedule missed slots
              </label>
            </div>
            {upcomingQueue.length === 0 ? <p className="text-sm text-slate-500">No queued posts.</p> : upcomingQueue.slice(0, 6).map((post) => (
              <div key={post.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-primary">{post.videos.topic}</div>
                  <Badge variant="warning">scheduled</Badge>
                </div>
                <p className="text-xs text-slate-600">{platformNames[post.platform]} • {new Date(post.scheduled_time || '').toLocaleString()}</p>
                <p className="mt-1 text-xs text-brand-600">Best-time suggestion: {bestTimeSuggestions[post.platform].join(' / ')}</p>
              </div>
            ))}
            {missedPosts.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
                <TimerReset className="h-4 w-4" />
                {missedPosts.length} missed slot(s) detected {autoRescheduleMissed ? 'and rescheduling is enabled.' : '— enable auto-rescheduling to move them.'}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-lg font-semibold text-primary">Campaign approvals & handoff</h3>
            {campaigns.length === 0 ? <p className="text-sm text-slate-500">No campaigns available.</p> : campaigns.slice(0, 5).map((campaign) => {
              const state = approvalByCampaign[campaign.id] || 'creator'
              return (
                <div key={campaign.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary">{campaign.topic}</p>
                      <p className="text-xs text-slate-500">{campaign.posts.length} platform variant(s)</p>
                    </div>
                    <Badge variant={state === 'approved' ? 'success' : 'warning'}>{state}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(Object.keys(campaign.variants) as Platform[]).map((platform) => (
                      <div key={platform} className="rounded-lg border border-slate-100 p-2">
                        <p className="font-semibold">{platformNames[platform]}</p>
                        <p className="truncate text-slate-500">{campaign.variants[platform].caption || 'No caption variant yet'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setApprovalByCampaign((prev) => ({ ...prev, [campaign.id]: 'creator' }))}>Creator</Button>
                    <Button size="sm" variant="ghost" onClick={() => setApprovalByCampaign((prev) => ({ ...prev, [campaign.id]: 'reviewer' }))}>Reviewer</Button>
                    <Button size="sm" variant="ghost" onClick={() => setApprovalByCampaign((prev) => ({ ...prev, [campaign.id]: 'approver' }))}>Approver</Button>
                    <Button size="sm" variant="secondary" onClick={() => setApprovalByCampaign((prev) => ({ ...prev, [campaign.id]: 'approved' }))}>Approve</Button>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

        <Modal isOpen={scheduleModal} onClose={() => setScheduleModal(false)} title="Create campaign" size="lg">
          <div className="space-y-5">
            <Select
              label="Select video"
              options={[{ value: '', label: 'Choose a video...' }, ...videos.map((v: any) => ({ value: v.id, label: v.topic }))]}
              value={selectedVideo}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedVideo(e.target.value)}
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-primary">Platforms</label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(platformNames) as Platform[]).map((key) => {
                  const Icon = platformIcons[key]
                  const isSelected = selectedPlatforms.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlatform(key)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${isSelected ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-white/60 bg-white/70 text-slate-500'}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{platformNames[key]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Input type="datetime-local" label="Schedule time (optional)" value={scheduledTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledTime(e.target.value)} />

            {selectedPlatforms.map((platform) => (
              <div key={platform} className="rounded-xl border border-slate-200 p-3 space-y-3">
                <p className="text-sm font-semibold text-primary">{platformNames[platform]} variant</p>
                <Textarea
                  label="Caption"
                  rows={2}
                  value={variantDrafts[platform].caption}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setVariantDrafts((prev) => ({ ...prev, [platform]: { ...prev[platform], caption: e.target.value } }))}
                />
                <Input
                  label="Media URL override"
                  value={variantDrafts[platform].mediaUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setVariantDrafts((prev) => ({ ...prev, [platform]: { ...prev[platform], mediaUrl: e.target.value } }))}
                  placeholder="Optional per-platform media URL"
                />
                <Input
                  label="Hashtags"
                  value={variantDrafts[platform].hashtags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setVariantDrafts((prev) => ({ ...prev, [platform]: { ...prev[platform], hashtags: e.target.value } }))}
                  placeholder="#launch #weeklyupdate"
                />
                <p className="text-xs text-brand-600">Best-time suggestion: {bestTimeSuggestions[platform].join(' / ')}</p>
              </div>
            ))}

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" className="border border-white/60 bg-white/70 text-slate-500" onClick={() => setScheduleModal(false)}>Cancel</Button>
              <Button onClick={handleSchedule} loading={scheduling}>Create & schedule</Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={retryModalPost !== null} onClose={() => setRetryModalPost(null)} title="Retry failed publish" size="md">
          <div className="space-y-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>{retryModalPost?.error_message || 'Publishing failed. You can edit and retry.'}</span>
            </div>
            <Input type="datetime-local" label="Retry at" value={retryTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetryTime(e.target.value)} />
            <Textarea label="Edit caption before retry" rows={3} value={retryCaption} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRetryCaption(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRetryModalPost(null)}>Close</Button>
              <Button variant="secondary" onClick={handleRetryPost} loading={retrying}><RefreshCw className="h-4 w-4 mr-2" />Retry publish</Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={cancelModal !== null} onClose={() => setCancelModal(null)} title="Cancel Post" size="sm">
          <p className="mb-4 text-sm text-slate-500">Are you sure you want to cancel this scheduled post?</p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" className="border border-white/60 bg-white/70 text-slate-500" onClick={() => setCancelModal(null)}>Keep it</Button>
            <Button variant="danger" onClick={() => cancelModal && handleCancel(cancelModal)} loading={cancelling}>Cancel post</Button>
          </div>
        </Modal>

        <Card className="p-4 text-xs text-slate-500 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
          Status badges map to lifecycle states: draft, scheduled, published, and failed across calendar, queue, and campaign cards.
        </Card>
      </div>
    </Layout>
  )
}
