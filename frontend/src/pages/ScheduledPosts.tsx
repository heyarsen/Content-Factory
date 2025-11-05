import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Calendar, Instagram, Youtube, Facebook, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../lib/api'

interface Post {
  id: string
  video_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  scheduled_time: string | null
  status: 'pending' | 'posted' | 'failed' | 'cancelled'
  posted_at: string | null
  error_message: string | null
  videos: {
    topic: string
    video_url: string | null
  }
}

const platformIcons = {
  instagram: Instagram,
  tiktok: Users,
  youtube: Youtube,
  facebook: Facebook,
}

const platformNames = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
}

export function ScheduledPosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [scheduleModal, setScheduleModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scheduledTime, setScheduledTime] = useState('')
  const [caption, setCaption] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    loadPosts()
    loadVideos()
  }, [statusFilter])

  useEffect(() => {
    // Poll for status updates
    const interval = setInterval(() => {
      const pending = posts.filter((p: Post) => p.status === 'pending')
      if (pending.length > 0) {
        loadPosts()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [posts])

  const loadPosts = async () => {
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter

      const response = await api.get('/api/posts', { params })
      setPosts(response.data.posts || [])
    } catch (error) {
      console.error('Failed to load posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVideos = async () => {
    try {
      const response = await api.get('/api/videos', { params: { status: 'completed' } })
      setVideos(response.data.videos || [])
    } catch (error) {
      console.error('Failed to load videos:', error)
    }
  }

  const handleSchedule = async () => {
    if (!selectedVideo || selectedPlatforms.length === 0) {
      alert('Please select a video and at least one platform')
      return
    }

    setScheduling(true)
    try {
      await api.post('/api/posts/schedule', {
        video_id: selectedVideo,
        platforms: selectedPlatforms,
        scheduled_time: scheduledTime || null,
        caption: caption || undefined,
      })
      setScheduleModal(false)
      setSelectedVideo('')
      setSelectedPlatforms([])
      setScheduledTime('')
      setCaption('')
      loadPosts()
    } catch (error: any) {
      console.error('Failed to schedule post:', error)
      alert(error.response?.data?.error || 'Failed to schedule post')
    } finally {
      setScheduling(false)
    }
  }

  const handleCancel = async (id: string) => {
    setCancelling(true)
    try {
      await api.delete(`/api/posts/${id}`)
      setPosts(posts.filter((p: Post) => p.id !== id))
      setCancelModal(null)
    } catch (error) {
      console.error('Failed to cancel post:', error)
    } finally {
      setCancelling(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
      posted: 'success',
      pending: 'warning',
      failed: 'error',
      cancelled: 'default',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev: string[]) =>
      prev.includes(platform)
        ? prev.filter((p: string) => p !== platform)
        : [...prev, platform]
    )
  }

  // Group posts by date
  const postsByDate: Record<string, Post[]> = {}
  posts.forEach((post: Post) => {
    const dateKey = post.scheduled_time
      ? new Date(post.scheduled_time).toISOString().split('T')[0]
      : post.posted_at
      ? new Date(post.posted_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    if (!postsByDate[dateKey]) {
      postsByDate[dateKey] = []
    }
    postsByDate[dateKey].push(post)
  })

  // Calendar utilities
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const getPostsForDate = (date: Date): Post[] => {
    const dateKey = date.toISOString().split('T')[0]
    return postsByDate[dateKey] || []
  }

  const formatDateKey = (day: number): string => {
    const date = new Date(year, month, day)
    return date.toISOString().split('T')[0]
  }

  const selectedDatePosts = selectedDate ? postsByDate[selectedDate] || [] : []

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
      <div className="space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h1 className="text-3xl font-semibold text-primary">Scheduled posts</h1>
            <p className="text-sm text-slate-500">Activate multi-channel distribution and keep audiences warm.</p>
          </div>
          <Button onClick={() => setScheduleModal(true)} className="shadow-[0_20px_45px_-25px_rgba(99,102,241,0.5)]">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule post
          </Button>
        </div>

        <Card className="max-w-sm border-dashed border-white/40">
          <Select
            options={[
              { value: 'all', label: 'All status' },
              { value: 'pending', label: 'Pending' },
              { value: 'posted', label: 'Posted' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </Card>

        {posts.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-16 h-16" />}
            title="No scheduled posts"
            description="Schedule your completed videos to be posted on social media."
            action={
              <Button onClick={() => setScheduleModal(true)}>Schedule Post</Button>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar */}
            <Card className="lg:col-span-2 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-primary">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={previousMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                    className="h-8 px-3"
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={nextMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells for days before month starts */}
                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Calendar days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateKey = formatDateKey(day)
                  const dayPosts = getPostsForDate(new Date(year, month, day))
                  const isToday = dateKey === new Date().toISOString().split('T')[0]
                  const isSelected = selectedDate === dateKey

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                      className={`aspect-square rounded-xl border-2 p-2 text-left transition ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50'
                          : isToday
                          ? 'border-brand-300 bg-brand-50/50'
                          : dayPosts.length > 0
                          ? 'border-blue-200 bg-blue-50/50 hover:border-blue-300'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${isToday ? 'text-brand-600' : 'text-slate-700'}`}>
                        {day}
                      </div>
                      {dayPosts.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {dayPosts.slice(0, 2).map((post) => (
                            <div
                              key={post.id}
                              className="h-1.5 w-1.5 rounded-full bg-brand-500"
                              title={platformNames[post.platform]}
                            />
                          ))}
                          {dayPosts.length > 2 && (
                            <div className="text-[10px] text-slate-500">+{dayPosts.length - 2}</div>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Selected Date Posts */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-primary">
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Select a date'}
              </h3>
              {selectedDatePosts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {selectedDate ? 'No posts scheduled for this date' : 'Click on a date to see scheduled posts'}
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDatePosts.map((post) => {
                    const Icon = platformIcons[post.platform]
                    return (
                      <div
                        key={post.id}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-semibold text-primary">
                            {platformNames[post.platform]}
                          </span>
                          {getStatusBadge(post.status)}
                        </div>
                        <p className="mb-2 text-xs text-slate-600">{post.videos.topic}</p>
                        {post.scheduled_time && (
                          <p className="text-[10px] text-slate-400">
                            {new Date(post.scheduled_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {post.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-6 text-xs text-red-600 hover:bg-red-50"
                            onClick={() => setCancelModal(post.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        <Modal
          isOpen={scheduleModal}
          onClose={() => setScheduleModal(false)}
          title="Schedule Post"
          size="lg"
        >
          <div className="space-y-5">
            <Select
              label="Select video"
              options={[
                { value: '', label: 'Choose a video...' },
                ...videos.map((v) => ({
                  value: v.id,
                  label: v.topic,
                })),
              ]}
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(e.target.value)}
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-primary">
                Select platforms
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(platformNames).map(([key, name]) => {
                  const Icon = platformIcons[key as keyof typeof platformIcons]
                  const isSelected = selectedPlatforms.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlatform(key)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        isSelected
                          ? 'border-brand-300 bg-brand-50 text-brand-600 shadow-[0_18px_45px_-30px_rgba(99,102,241,0.45)]'
                          : 'border-white/60 bg-white/70 text-slate-500 hover:border-brand-200 hover:text-brand-600'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Input
              type="datetime-local"
              label="Schedule time (optional)"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />

            <Textarea
              label="Caption (optional)"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption for your post..."
            />

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
                onClick={() => setScheduleModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSchedule} loading={scheduling}>
                Schedule post
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={cancelModal !== null}
          onClose={() => setCancelModal(null)}
          title="Cancel Post"
          size="sm"
        >
          <p className="mb-4 text-sm text-slate-500">
            Are you sure you want to cancel this scheduled post?
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
              onClick={() => setCancelModal(null)}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelModal && handleCancel(cancelModal)}
              loading={cancelling}
            >
              Cancel post
            </Button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}

