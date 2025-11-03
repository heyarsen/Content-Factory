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
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Scheduled Posts</h1>
            <p className="text-sm text-gray-600 mt-2">Manage your scheduled social media posts</p>
          </div>
          <Button onClick={() => setScheduleModal(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Post
          </Button>
        </div>

        <Select
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'pending', label: 'Pending' },
            { value: 'posted', label: 'Posted' },
            { value: 'failed', label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />

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
                <Card key={post.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <Icon className="w-6 h-6 text-purple-600 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-sm text-primary">
                            {platformNames[post.platform]}
                          </h3>
                          {getStatusBadge(post.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{post.videos.topic}</p>
                        {post.scheduled_time && (
                          <p className="text-xs text-gray-500">
                            Scheduled: {new Date(post.scheduled_time).toLocaleString()}
                          </p>
                        )}
                        {post.posted_at && (
                          <p className="text-xs text-gray-500">
                            Posted: {new Date(post.posted_at).toLocaleString()}
                          </p>
                        )}
                        {post.error_message && (
                          <p className="text-xs text-red-600 mt-1">{post.error_message}</p>
                        )}
                      </div>
                    </div>
                    {post.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelModal(post.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
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
          <div className="space-y-4">
            <Select
              label="Select Video"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Platforms
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
                      className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Input
              type="datetime-local"
              label="Schedule Time (Optional)"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />

            <Textarea
              label="Caption (Optional)"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption for your post..."
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="secondary" onClick={() => setScheduleModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSchedule} loading={scheduling}>
                Schedule Post
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
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to cancel this scheduled post?
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setCancelModal(null)}>
              No, Keep It
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelModal && handleCancel(cancelModal)}
              loading={cancelling}
            >
              Cancel Post
            </Button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}

