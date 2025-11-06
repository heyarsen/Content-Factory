import React, { useEffect, useState, useCallback } from 'react'
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
import { Textarea } from '../components/ui/Textarea'
import { Video as VideoIcon, Search, Trash2, RefreshCw, Play, Download, FileText, Share2, MessageSquare, Upload } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import {
  listVideos,
  deleteVideo as deleteVideoRequest,
  retryVideo as retryVideoRequest,
  getVideo,
  refreshVideoStatus,
  getSharableVideoUrl,
  generateDescription,
  type VideoRecord,
  type ListVideosParams,
} from '../lib/videos'

export function Videos() {
  const { addNotification } = useNotifications()
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ListVideosParams['status']>('all')
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [socialDescription, setSocialDescription] = useState('')
  const [completedVideos, setCompletedVideos] = useState<Set<string>>(new Set())

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
    // Poll for status updates on generating videos (more frequently)
    const interval = setInterval(async () => {
      const generating = videos.filter((v) => v.status === 'generating' || v.status === 'pending')
      if (generating.length > 0) {
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
            if (updated.status === 'completed' && !completedVideos.has(video.id)) {
              setCompletedVideos((prev) => new Set(prev).add(video.id))
              addNotification({
                type: 'success',
                title: 'Video Ready!',
                message: `"${updated.topic}" has finished generating and is ready to view.`,
                link: `/videos`,
              })
            }
          } catch (error) {
            console.error('Failed to refresh video status:', error)
          }
        }
      }
    }, 3000) // Poll every 3 seconds for better UX
    return () => clearInterval(interval)
  }, [videos, selectedVideo, completedVideos, addNotification])

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
                  <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-slate-100/70">
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
            setSocialDescription('') // Clear description when modal closes
          }}
          title="Video Details"
          size="lg"
        >
          {loadingVideo ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent"></div>
              <p className="mt-4 text-sm text-slate-500">Loading video details...</p>
            </div>
          ) : selectedVideo ? (
            <div className="space-y-6">
              {/* Video Preview */}
              {selectedVideo.status === 'completed' && selectedVideo.video_url && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary">Video Preview</h3>
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    <video 
                      src={selectedVideo.video_url} 
                      className="w-full rounded-xl" 
                      controls 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.open(selectedVideo.video_url!, '_blank')}
                      leftIcon={<Play className="h-4 w-4" />}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const { share_url } = await getSharableVideoUrl(selectedVideo.id)
                          await navigator.clipboard.writeText(share_url)
                          alert('Sharable URL copied to clipboard!')
                        } catch (error) {
                          console.error('Failed to get sharable URL:', error)
                          alert('Failed to get sharable URL')
                        }
                      }}
                      leftIcon={<Share2 className="h-4 w-4" />}
                    >
                      Share
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
                    >
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        setGeneratingDescription(true)
                        try {
                          const { description } = await generateDescription(
                            selectedVideo.id,
                            selectedVideo.topic,
                            selectedVideo.script || undefined
                          )
                          setSocialDescription(description)
                        } catch (error) {
                          console.error('Failed to generate description:', error)
                          alert('Failed to generate description')
                        } finally {
                          setGeneratingDescription(false)
                        }
                      }}
                      loading={generatingDescription}
                      leftIcon={<MessageSquare className="h-4 w-4" />}
                    >
                      Description
                    </Button>
                  </div>
                  {socialDescription && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Social Media Description</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(socialDescription)
                            alert('Description copied to clipboard!')
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm text-slate-700">{socialDescription}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Generating Status */}
              {(selectedVideo.status === 'generating' || selectedVideo.status === 'pending') && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary">Video Generation Status</h3>
                  <div className="relative overflow-hidden rounded-xl border border-brand-200 bg-brand-50/30 px-8 py-12">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative h-20 w-20">
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500"></div>
                        <VideoIcon className="absolute inset-0 m-auto h-8 w-8 text-brand-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-brand-700">Generating Your Video</p>
                        {selectedVideo.progress !== undefined ? (
                          <div className="mt-4">
                            <div className="h-3 w-64 overflow-hidden rounded-full bg-brand-100">
                              <div 
                                className="h-full bg-brand-500 transition-all duration-300"
                                style={{ width: `${selectedVideo.progress}%` }}
                              />
                            </div>
                            <p className="mt-2 text-sm font-medium text-brand-600">{selectedVideo.progress}% Complete</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-brand-500">This may take a few moments...</p>
                        )}
                        <p className="mt-4 text-xs text-slate-500">We'll notify you when it's ready!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Topic</label>
                  <p className="mt-1 text-sm font-medium text-primary">{selectedVideo.topic}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Style</label>
                  <p className="mt-1 text-sm font-medium text-primary capitalize">{selectedVideo.style}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</label>
                  <p className="mt-1 text-sm font-medium text-primary">{selectedVideo.duration} seconds</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedVideo.status)}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Created</label>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {new Date(selectedVideo.created_at).toLocaleString()}
                  </p>
                </div>
                {selectedVideo.heygen_video_id && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">HeyGen ID</label>
                    <p className="mt-1 text-sm font-mono text-primary">{selectedVideo.heygen_video_id}</p>
                  </div>
                )}
              </div>

              {/* Script */}
              {selectedVideo.script && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-primary">Script</h3>
                  </div>
                  <Textarea
                    value={selectedVideo.script}
                    readOnly
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {/* Error Message */}
              {selectedVideo.status === 'failed' && selectedVideo.error_message && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-rose-700">Error Message</h3>
                  <p className="text-sm text-rose-600">{selectedVideo.error_message}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 border-t border-slate-200 pt-4">
                {selectedVideo.status === 'failed' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      handleRetry(selectedVideo.id)
                      setSelectedVideo(null)
                    }}
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                  >
                    Retry Generation
                  </Button>
                )}
                {selectedVideo.status === 'completed' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Navigate to distribution page with video pre-selected
                      window.location.href = `/distribution?video=${selectedVideo.id}`
                    }}
                    leftIcon={<Upload className="h-4 w-4" />}
                  >
                    Post to Social Media
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    setSelectedVideo(null)
                    setDeleteModal(selectedVideo.id)
                  }}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  className="ml-auto"
                >
                  Delete Video
                </Button>
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

