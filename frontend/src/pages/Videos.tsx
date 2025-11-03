import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Video, Search, Trash2, RefreshCw, Play, Download } from 'lucide-react'
import api from '../lib/api'

interface VideoItem {
  id: string
  topic: string
  style: string
  duration: number
  status: 'pending' | 'generating' | 'completed' | 'failed'
  video_url: string | null
  error_message: string | null
  created_at: string
}

export function Videos() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadVideos = useCallback(async () => {
    try {
      const params: any = {}
      if (search) params.search = search
      if (statusFilter !== 'all') params.status = statusFilter

      const response = await api.get('/api/videos', { params })
      setVideos(response.data.videos || [])
    } catch (error) {
      console.error('Failed to load videos:', error)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  useEffect(() => {
    // Poll for status updates on generating videos
    const interval = setInterval(() => {
      const generating = videos.filter((v) => v.status === 'generating' || v.status === 'pending')
      if (generating.length > 0) {
        loadVideos()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [videos, loadVideos])

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await api.delete(`/api/videos/${id}`)
      setVideos(videos.filter((v) => v.id !== id))
      setDeleteModal(null)
    } catch (error) {
      console.error('Failed to delete video:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleRetry = async (id: string) => {
    try {
      await api.post(`/api/videos/${id}/retry`)
      loadVideos()
    } catch (error) {
      console.error('Failed to retry video:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
      completed: 'success',
      generating: 'info',
      pending: 'warning',
      failed: 'error',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
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
          <h1 className="text-2xl font-bold text-primary">Videos</h1>
          <Link to="/generate">
            <Button>Generate New Video</Button>
          </Link>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search videos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'generating', label: 'Generating' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
          />
        </div>

        {videos.length === 0 ? (
          <EmptyState
            icon={<Video className="w-16 h-16" />}
            title="No videos found"
            description="Get started by generating your first AI-powered video."
            action={
              <Link to="/generate">
                <Button>Generate Video</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card key={video.id} hover>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-sm text-primary line-clamp-2">{video.topic}</h3>
                    {getStatusBadge(video.status)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{video.style}</span>
                    <span>{video.duration}s</span>
                  </div>

                  {video.status === 'completed' && video.video_url && (
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <video src={video.video_url} className="w-full h-full object-cover" controls />
                    </div>
                  )}

                  {video.status === 'failed' && video.error_message && (
                    <p className="text-xs text-red-600">{video.error_message}</p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                    {video.status === 'completed' && video.video_url && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(video.video_url!, '_blank')}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = video.video_url!
                            link.download = `${video.topic}.mp4`
                            link.click()
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {video.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(video.id)}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteModal(video.id)}
                      className="ml-auto text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          isOpen={deleteModal !== null}
          onClose={() => setDeleteModal(null)}
          title="Delete Video"
          size="sm"
        >
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this video? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteModal && handleDelete(deleteModal)}
              loading={deleting}
            >
              Delete
            </Button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}

