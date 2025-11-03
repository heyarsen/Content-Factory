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
import { Calendar, X, Instagram, Youtube, Facebook, Users } from 'lucide-react'
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

  useEffect(() => {
    loadPosts()
    loadVideos()
  }, [statusFilter])

  useEffect(() => {
    // Poll for status updates
    const interval = setInterval(() => {
      const pending = posts.filter((p) => p.status === 'pending')
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
      setPosts(posts.filter((p) => p.id !== id))
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
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-28 rounded-[28px]" />
          <Skeleton className="h-20 rounded-3xl" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
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
          <div className="space-y-4">
            {posts.map((post) => {
              const Icon = platformIcons[post.platform]
              return (
                <Card key={post.id} hover className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-1 items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-primary">
                            {platformNames[post.platform]}
                          </h3>
                          {getStatusBadge(post.status)}
                        </div>
                        <p className="text-sm text-slate-500">{post.videos.topic}</p>
                        <div className="space-y-1 text-xs text-slate-400">
                          {post.scheduled_time && (
                            <p>Scheduled - {new Date(post.scheduled_time).toLocaleString()}</p>
                          )}
                          {post.posted_at && (
                            <p>Posted - {new Date(post.posted_at).toLocaleString()}</p>
                          )}
                        </div>
                        {post.error_message && (
                          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-2 text-xs text-rose-600">
                            {post.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                    {post.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border border-white/60 bg-white/70 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => setCancelModal(post.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-t border-white/60 pt-4 text-[11px] uppercase tracking-wide text-slate-400">
                    <span>ID - {post.id.slice(0, 8)}</span>
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-300" />
                    <span>{post.status}</span>
                  </div>
                </Card>
              )
            })}
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

