import { useEffect, useState, useCallback } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { GenerateVideoModal } from '../components/videos/GenerateVideoModal'
import { Video as VideoIcon, Search, Trash2, RefreshCw, Play, Download, Plus } from 'lucide-react'
import {
  listVideos,
  deleteVideo as deleteVideoRequest,
  retryVideo as retryVideoRequest,
  type VideoRecord,
  type ListVideosParams,
} from '../lib/videos'

export function Videos() {
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ListVideosParams['status']>('all')
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)

  const loadVideos = useCallback(async () => {
    try {
      const videos = await listVideos({
        search: search || undefined,
        status: statusFilter,
      })
      setVideos(videos)
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
      await deleteVideoRequest(id)
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
      await retryVideoRequest(id)
      loadVideos()
    } catch (error) {
      console.error('Failed to retry video:', error)
    }
  }

  const getStatusBadge = (status: VideoRecord['status']) => {
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
        <div className="space-y-8">
          <Skeleton className="h-32 rounded-[28px]" />
          <Skeleton className="h-24 rounded-3xl" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-3xl" />
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Library</p>
            <h1 className="text-3xl font-semibold text-primary">Video library</h1>
            <p className="text-sm text-slate-500">Search, filter, and orchestrate your AI-generated stories.</p>
          </div>
          <Button onClick={() => setGenerateModalOpen(true)} className="shadow-[0_20px_45px_-25px_rgba(99,102,241,0.6)]">
            <Plus className="mr-2 h-4 w-4" />
            Generate new video
          </Button>
        </div>

        <Card className="border-dashed border-white/40">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <Input
                placeholder="Search videos by topic or style..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11"
              />
            </div>
            <Select
              options={[
                { value: 'all', label: 'All status' },
                { value: 'pending', label: 'Pending' },
                { value: 'generating', label: 'Generating' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
              ]}
              value={statusFilter ?? 'all'}
              onChange={(e) => setStatusFilter(e.target.value as ListVideosParams['status'])}
              className="w-full md:w-56"
            />
          </div>
        </Card>

        {videos.length === 0 ? (
          <EmptyState
            icon={<VideoIcon className="w-16 h-16" />}
            title="No videos found"
            description="Get started by generating your first AI-powered video."
            action={
              <Button onClick={() => setGenerateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Generate Video
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <Card key={video.id} hover className="flex h-full flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{video.style}</p>
                    <h3 className="text-lg font-semibold leading-tight text-primary line-clamp-2">
                      {video.topic}
                    </h3>
                    <p className="text-xs text-slate-400">{new Date(video.created_at).toLocaleString()}</p>
                  </div>
                  {getStatusBadge(video.status)}
                </div>

                {video.status === 'completed' && video.video_url && (
                  <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-slate-100/70">
                    <video src={video.video_url} className="h-full w-full rounded-2xl object-cover" controls />
                  </div>
                )}

                {video.status === 'failed' && video.error_message && (
                  <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-xs text-rose-600">
                    {video.error_message}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2 border-t border-white/60 pt-4 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-300" />
                    <span>{video.duration}s runtime</span>
                  </div>
                  <span className="ml-auto text-slate-300">ID - {video.id.slice(0, 6)}</span>
                </div>

                <div className="flex items-center gap-2">
                  {video.status === 'completed' && video.video_url && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border border-white/60 bg-white/70 text-brand-600 hover:border-brand-200 hover:bg-white"
                        onClick={() => window.open(video.video_url!, '_blank')}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border border-white/60 bg-white/70 text-brand-600 hover:border-brand-200 hover:bg-white"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = video.video_url!
                          link.download = `${video.topic}.mp4`
                          link.click()
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </>
                  )}
                  {video.status === 'failed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-white/60 bg-white/70 text-amber-500 hover:border-amber-200 hover:bg-white"
                      onClick={() => handleRetry(video.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto border border-rose-100 bg-rose-50/70 text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                    onClick={() => setDeleteModal(video.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
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

        <GenerateVideoModal
          isOpen={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          onSuccess={() => {
            loadVideos()
          }}
        />
      </div>
    </Layout>
  )
}

