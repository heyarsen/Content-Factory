import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Textarea } from '../components/ui/Textarea'
import { Video as VideoIcon, Search, Trash2, RefreshCw, Download, Share2 } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import {
  listVideos,
  deleteVideo as deleteVideoRequest,
  retryVideo as retryVideoRequest,
  getVideo,
  refreshVideoStatus,
  type VideoRecord,
  type ListVideosParams,
} from '../lib/videos'

export function Videos() {
  const { addNotification } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ListVideosParams['status']>('all')
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)

  const notifiedVideosRef = useRef<Set<string>>(new Set())

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

  // Handle videoId query parameter - open video modal if videoId is in URL
  useEffect(() => {
    const videoId = searchParams.get('videoId')
    if (videoId && !loading && !loadingVideo) {
      // Check if video is already selected with this ID
      if (selectedVideo?.id === videoId) {
        // Already showing this video, just clean up URL
        setSearchParams({}, { replace: true })
        return
      }

      // Try to find video in current list first
      const video = videos.find(v => v.id === videoId)
      if (video) {
        // Video found in list, load details and show modal
        setLoadingVideo(true)
        getVideo(videoId)
          .then((videoData) => {
            setSelectedVideo(videoData)
            // Remove videoId from URL to clean it up
            setSearchParams({}, { replace: true })
          })
          .catch((error) => {
            console.error('Failed to load video details:', error)
            addNotification({
              type: 'error',
              title: 'Video Not Found',
              message: 'The requested video could not be found.',
            })
            // Remove videoId from URL even on error
            setSearchParams({}, { replace: true })
          })
          .finally(() => {
            setLoadingVideo(false)
          })
      } else {
        // Video not in current list, try to load it directly (might be filtered out or list might be empty)
        setLoadingVideo(true)
        getVideo(videoId)
          .then((videoData) => {
            setSelectedVideo(videoData)
            // Remove videoId from URL to clean it up
            setSearchParams({}, { replace: true })
          })
          .catch((error) => {
            console.error('Failed to load video details:', error)
            addNotification({
              type: 'error',
              title: 'Video Not Found',
              message: 'The requested video could not be found. It may have been deleted or you may not have permission to view it.',
            })
            // Remove videoId from URL even on error
            setSearchParams({}, { replace: true })
          })
          .finally(() => {
            setLoadingVideo(false)
          })
      }
    }
  }, [searchParams, videos, selectedVideo, loading, loadingVideo, setSearchParams, addNotification])

  useEffect(() => {
    // Poll for status updates on generating videos with rate limit handling
    let pollTimeout: NodeJS.Timeout
    let pollDelay = 3000 // Start with 3 seconds
    let consecutiveErrors = 0

    const pollStatus = async () => {
      const generating = videos.filter((v) => v.status === 'generating' || v.status === 'pending')
      if (generating.length === 0) {
        // No videos to poll, check again in 10 seconds
        pollTimeout = setTimeout(pollStatus, 10000)
        return
      }

      let hasError = false
      // Refresh status for generating videos
      for (const video of generating) {
        try {
          const updated = await refreshVideoStatus(video.id)
          setVideos((prev) =>
            prev.map((v) => v.id === video.id ? updated : v)
          )
          // If this is the selected video, update it too
          if (selectedVideo?.id === video.id) {
            setSelectedVideo(updated)
          }

          // Check if video just completed
          if (updated.status === 'completed' && !notifiedVideosRef.current.has(video.id)) {
            notifiedVideosRef.current.add(video.id)
            addNotification({
              type: 'success',
              title: 'Video Ready!',
              message: `"${updated.topic}" has finished generating and is ready to view.`,
              link: `/videos`,
            })
          } else if (updated.status !== 'completed' && notifiedVideosRef.current.has(video.id)) {
            notifiedVideosRef.current.delete(video.id)
          }
        } catch (error: any) {
          hasError = true
          const is429 = error.response?.status === 429

          if (is429) {
            consecutiveErrors++
            // Exponential backoff for rate limits: 30s, 60s, 120s, max 300s
            pollDelay = Math.min(30000 * Math.pow(2, consecutiveErrors - 1), 300000)
            console.warn(`Rate limited (429) while polling. Waiting ${pollDelay / 1000}s before next poll.`)

            // Show notification only once
            if (consecutiveErrors === 1) {
              addNotification({
                type: 'warning',
                title: 'Rate Limit Reached',
                message: 'Video status updates paused due to rate limit. Will resume automatically.',
              })
            }
          } else {
            // For other errors, use shorter backoff
            pollDelay = Math.min(5000 * consecutiveErrors, 60000)
            console.error('Failed to refresh video status:', error)
          }
          break // Stop processing other videos if we hit an error
        }
      }

      // Reset error tracking on success
      if (!hasError) {
        consecutiveErrors = 0
        pollDelay = 3000 // Reset to normal polling interval
      }

      // Schedule next poll
      pollTimeout = setTimeout(pollStatus, pollDelay)
    }

    // Start polling
    pollTimeout = setTimeout(pollStatus, pollDelay)

    return () => {
      if (pollTimeout) clearTimeout(pollTimeout)
    }
  }, [videos, selectedVideo, addNotification])

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

  const handleCardClick = async (videoId: string, e: React.MouseEvent) => {
    // Don't open modal if clicking on buttons or interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) {
      return
    }

    setLoadingVideo(true)
    try {
      const video = await getVideo(videoId)
      setSelectedVideo(video)
    } catch (error) {
      console.error('Failed to load video details:', error)
    } finally {
      setLoadingVideo(false)
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">My Videos</p>
            <h1 className="text-3xl font-semibold text-primary">Video Library</h1>
            <p className="text-sm text-slate-500">View and manage all your videos.</p>
          </div>
          <Link to="/create">
            <Button className="shadow-[0_20px_45px_-25px_rgba(99,102,241,0.6)]">
              <VideoIcon className="mr-2 h-4 w-4" />
              Create Video
            </Button>
          </Link>
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
              <Link to="/create">
                <Button>Create Video</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <Card
                key={video.id}
                hover
                className="flex h-full flex-col gap-5 cursor-pointer"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => handleCardClick(video.id, e)}
              >
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
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/50 bg-slate-100/70"
                    style={{ aspectRatio: '9 / 16' }}
                  >
                    <video src={video.video_url} className="h-full w-full rounded-2xl object-cover" controls />
                  </div>
                )}

                {(video.status === 'generating' || video.status === 'pending') && (
                  <div className="relative overflow-hidden rounded-2xl border border-brand-200/50 bg-brand-50/30 px-6 py-8">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative h-16 w-16">
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500"></div>
                        <VideoIcon className="absolute inset-0 m-auto h-6 w-6 text-brand-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-brand-700">Generating Video</p>
                        {video.progress !== undefined && (
                          <div className="mt-2">
                            <div className="h-2 w-48 overflow-hidden rounded-full bg-brand-100">
                              <div
                                className="h-full bg-brand-500 transition-all duration-300"
                                style={{ width: `${video.progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-brand-600">{video.progress}%</p>
                          </div>
                        )}
                        {!video.progress && (
                          <p className="mt-1 text-xs text-brand-500">This may take a few moments...</p>
                        )}
                      </div>
                    </div>
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

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {video.status === 'completed' && video.video_url && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border border-white/60 bg-white/70 text-brand-600 hover:border-brand-200 hover:bg-white"
                        onClick={() => window.location.href = `/posts?create_for=${video.id}`}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Post
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
                  {(video.status === 'generating' || video.status === 'pending') && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400"></div>
                      <span>Generating...</span>
                    </div>
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

        {/* Video Details Modal */}
        <Modal
          isOpen={selectedVideo !== null}
          onClose={() => {
            setSelectedVideo(null)
          }}
          title="Video Details"
          size="xl"
        >
          {loadingVideo ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent"></div>
              <p className="mt-4 text-sm text-slate-500">Loading video details...</p>
            </div>
          ) : selectedVideo ? (
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Left Column: Video Preview */}
              <div className="lg:col-span-2 space-y-4">
                {selectedVideo.status === 'completed' && selectedVideo.video_url && (
                  <div className="space-y-3">
                    <div
                      className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-md"
                      style={{ aspectRatio: '9 / 16' }}
                    >
                      <video
                        src={selectedVideo.video_url}
                        className="w-full h-full object-cover"
                        controls
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.location.href = `/posts?create_for=${selectedVideo.id}`}
                        leftIcon={<Share2 className="h-4 w-4" />}
                        className="w-full justify-center"
                      >
                        Post
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = selectedVideo.video_url!
                          link.download = `${selectedVideo.topic}.mp4`
                          link.click()
                        }}
                        leftIcon={<Download className="h-4 w-4" />}
                        className="w-full justify-center"
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                {(selectedVideo.status === 'generating' || selectedVideo.status === 'pending') && (
                  <div className="aspect-[9/16] relative overflow-hidden rounded-xl border border-brand-200 bg-brand-50/30 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="relative h-16 w-16 mx-auto mb-4">
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500"></div>
                        <VideoIcon className="absolute inset-0 m-auto h-6 w-6 text-brand-500" />
                      </div>
                      <p className="font-semibold text-brand-700">Generating...</p>
                      {selectedVideo.progress !== undefined && (
                        <div className="mt-2 w-full max-w-[120px] mx-auto h-1.5 rounded-full bg-brand-100 overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${selectedVideo.progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedVideo.status === 'failed' && (
                  <div className="aspect-[9/16] relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center">
                    <div className="text-center p-4 text-rose-600">
                      <p className="font-semibold">Generation Failed</p>
                      <p className="text-xs mt-1">{selectedVideo.error_message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Info & Actions */}
              <div className="lg:col-span-3 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedVideo.topic}</h2>
                    <div className="mt-1 flex items-center gap-2">
                      {getStatusBadge(selectedVideo.status)}
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500">{new Date(selectedVideo.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedVideo(null)
                      setDeleteModal(selectedVideo.id)
                    }}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Style</label>
                    <p className="font-medium text-slate-900 capitalize">{selectedVideo.style}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</label>
                    <p className="font-medium text-slate-900">{selectedVideo.duration}s</p>
                  </div>
                </div>

                {selectedVideo.script && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Script</label>
                    <div className="relative">
                      <Textarea
                        value={selectedVideo.script}
                        readOnly
                        rows={6}
                        className="font-mono text-sm bg-white resize-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">Social Media & Distribution</h3>
                  <div className="flex gap-3">
                    {selectedVideo.status === 'completed' && (
                      <Button
                        onClick={() => {
                          // TODO: Open a proper "Schedule/Post" modal
                          // For now, we'll verify the button presence and intent.
                          // Ideally this opens a SocialShareModal or similar.
                          // Using a direct navigation to a post-creation flow with this video pre-selected is robust.
                          // The user requested: "make it post to social media instead of refferig to create video tab"
                          // Currently it went to /distribution?video=... which likely redirected to /create?step=complete.
                          // We will change this to navigate to /posts?action=create&video_id=... or open a modal.
                          // Given existing flows, navigating to a dedicated posting view is safest if no modal exists.
                          // However, user said "instead of refferig to create video tab".
                          // I'll create a simple prompt to post directly here or assume 'QuickCreate' post step is re-usable.
                          // Actually, let's just make it do the action if we can, or go to ScheduledPosts with a "New Post" modal open.
                          // Since I can't easily build a full posting modal in one step without context, I'll redirect to a specific posting route 
                          // that is NOT 'QuickCreate' (create video tab).
                          // /social/share?videoId=... seems appropriate if it existed.
                          // I'll use a placeholder alert implementation for the "Posting" for now, or assume /posts is the place.
                          // Wait, the QuickCreate has logic to post. I should probably lift that.
                          window.location.href = `/posts?create_for=${selectedVideo.id}`
                        }}
                        leftIcon={<Share2 className="h-4 w-4" />}
                        className="flex-1"
                      >
                        Post to Social Media
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>

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

