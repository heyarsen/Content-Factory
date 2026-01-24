import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { Calendar, X, Instagram, Youtube, Facebook, Users, Link2 } from 'lucide-react'
import api from '../lib/api'

interface SocialAccount {
  id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  connected_at: string
}

interface Post {
  id: string
  video_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  scheduled_time: string | null
  status: 'pending' | 'posted' | 'failed' | 'cancelled'
  posted_at: string | null
  error_message: string | null
  upload_post_id: string | null
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

export function Distribution() {
  // Social Accounts state
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<SocialAccount['platform'] | null>(null)
  const [disconnectModal, setDisconnectModal] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectPortal, setConnectPortal] = useState<{
    platform: SocialAccount['platform']
    url: string
    duration?: string
    redirectUrl?: string
    message?: string
    embedDisabled?: boolean
  } | null>(null)
  const [portalLoadFailed, setPortalLoadFailed] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // Scheduled Posts state
  const [posts, setPosts] = useState<Post[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [scheduleModal, setScheduleModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scheduledTime, setScheduledTime] = useState('')
  const [caption, setCaption] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Load social accounts
  const loadAccounts = useCallback(async () => {
    try {
      const response = await api.get('/api/social/accounts')
      setAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  // Load scheduled posts
  const loadPosts = async () => {
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter

      const response = await api.get('/api/posts', { params })
      setPosts(response.data.posts || [])
    } catch (error) {
      console.error('Failed to load posts:', error)
    } finally {
      setPostsLoading(false)
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

  useEffect(() => {
    loadAccounts()
    loadPosts()
    loadVideos()
  }, [loadAccounts, statusFilter])

  // Poll for pending posts to update their status
  useEffect(() => {
    const pendingPosts = posts.filter(p => p.status === 'pending' && p.upload_post_id)
    if (pendingPosts.length === 0) return

    const pollInterval = setInterval(() => {
      // Refresh posts to get updated status
      loadPosts()
    }, 15000) // Poll every 15 seconds

    return () => clearInterval(pollInterval)
  }, [posts, loadPosts])

  useEffect(() => {
    const connectedPlatform = searchParams.get('connected') as SocialAccount['platform'] | null

    if (connectedPlatform) {
      const platformLabel = platformNames[connectedPlatform] || connectedPlatform
      alert(`Success! ${platformLabel} connected successfully.`)

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('connected')
      setSearchParams(nextParams, { replace: true })

      loadAccounts()
    }
  }, [searchParams, setSearchParams, loadAccounts])

  useEffect(() => {
    if (connectPortal) {
      setPortalLoadFailed(connectPortal.embedDisabled ?? false)
      setCopiedLink(false)
    }
  }, [connectPortal])

  useEffect(() => {
    if (!copiedLink) return
    const timeout = setTimeout(() => setCopiedLink(false), 2000)
    return () => clearTimeout(timeout)
  }, [copiedLink])

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

  // Social Accounts handlers
  const handleCopyPortalLink = useCallback(async () => {
    if (!connectPortal) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(connectPortal.url)
        setCopiedLink(true)
        return
      }
      throw new Error('Clipboard API not available')
    } catch (error) {
      console.warn('Clipboard copy failed, falling back to manual copy.', error)
      setCopiedLink(false)
      const manualCopy = window.prompt('Copy the connection URL below:', connectPortal.url)
      if (manualCopy === null) {
        // User cancelled prompt; nothing else to do
      }
    }
  }, [connectPortal])

  const tryOpenPortalWindow = useCallback((url: string) => {
    if (typeof window === 'undefined') return false

    try {
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (newWindow) {
        newWindow.focus?.()
        return true
      }
    } catch (error) {
      console.error('Failed to open Upload-Post portal window:', error)
    }

    return false
  }, [])

  const handleConnect = async (platform: SocialAccount['platform']) => {
    setConnectingPlatform(platform)
    setConnectPortal(null)
    setPortalLoadFailed(false)
    setCopiedLink(false)
    try {
      const response = await api.post('/api/social/connect', { platform })
      const { accessUrl, uploadPostUsername, message, duration, redirectUrl } = response.data as {
        accessUrl?: string
        uploadPostUsername?: string
        message?: string
        duration?: string
        redirectUrl?: string
      }

      const platformLabel = platformNames[platform] || platform

      localStorage.removeItem(`uploadpost_jwt_${platform}`)
      localStorage.removeItem(`uploadpost_userid_${platform}`)

      if (uploadPostUsername) {
        localStorage.setItem(`uploadpost_username_${platform}`, uploadPostUsername)
      }

      if (redirectUrl) {
        localStorage.setItem(`uploadpost_redirect_url_${platform}`, redirectUrl)
      }

      const buildPlatformUrl = (baseUrl: string) => {
        try {
          const url = new URL(baseUrl)
          if (!url.searchParams.has('platform')) {
            url.searchParams.set('platform', platform)
          }
          return url.toString()
        } catch (error) {
          const separator = baseUrl.includes('?') ? '&' : '?'
          return `${baseUrl}${separator}platform=${platform}`
        }
      }

      const defaultMessage = message || `Account linking initiated for ${platformLabel}.`

      if (accessUrl) {
        const resolvedAccessUrl = buildPlatformUrl(accessUrl)
        localStorage.setItem(`uploadpost_access_url_${platform}`, resolvedAccessUrl)
        const autoOpened = tryOpenPortalWindow(resolvedAccessUrl)

        if (!autoOpened) {
          setConnectPortal({
            platform,
            url: resolvedAccessUrl,
            duration,
            redirectUrl,
            message: `${defaultMessage} We couldn't automatically open the Upload-Post portal. Use the link below to continue.`,
            embedDisabled: true,
          })
        }
      } else {
        const fallbackBaseUrl = buildPlatformUrl('https://connect.upload-post.com')
        localStorage.setItem(`uploadpost_access_url_${platform}`, fallbackBaseUrl)
        const fallbackOpened = tryOpenPortalWindow(fallbackBaseUrl)

        if (!fallbackOpened) {
          const fallbackParts = [
            `${defaultMessage} We couldn't automatically open the Upload-Post portal.`,
          ]

          if (duration) {
            fallbackParts.push(`Link valid for ${duration}.`)
          }

          fallbackParts.push(`Use the button below or visit ${fallbackBaseUrl} to continue linking.`)

          if (redirectUrl) {
            fallbackParts.push(
              `Once finished you will be redirected automatically. If that does not happen, revisit: ${redirectUrl}`
            )
          }

          setConnectPortal({
            platform,
            url: fallbackBaseUrl,
            duration,
            redirectUrl,
            message: fallbackParts.join(' '),
            embedDisabled: true,
          })
        }
      }

      loadAccounts()
    } catch (error: any) {
      console.error('Failed to connect:', error)
      const errorMessage = error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Failed to initiate connection'
      console.error('Error details:', {
        message: errorMessage,
        fullResponse: error.response?.data,
        status: error.response?.status,
      })
      alert(errorMessage)
    } finally {
      setConnectingPlatform(null)
    }
  }

  const handleDisconnect = async (id: string) => {
    setDisconnecting(true)
    try {
      await api.delete(`/api/social/accounts/${id}`)
      setAccounts(accounts.filter((a) => a.id !== id))
      setDisconnectModal(null)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  // Scheduled Posts handlers
  const handleSchedule = async () => {
    if (!selectedVideo || selectedPlatforms.length === 0) {
      alert('Please select a video and at least one platform')
      return
    }

    setScheduling(true)
    try {
      const response = await api.post('/api/posts/schedule', {
        video_id: selectedVideo,
        platforms: selectedPlatforms,
        scheduled_time: scheduledTime || null,
        caption: caption || undefined,
      })

      // Check if any posts failed
      const posts = response.data.posts || []
      const failedPosts = posts.filter((p: any) => p.status === 'failed')

      if (failedPosts.length > 0) {
        const errorMessages = failedPosts.map((p: any) => {
          const platform = p.platform as keyof typeof platformNames
          return `${platformNames[platform] || p.platform}: ${p.error_message || 'Unknown error'}`
        }).join('\n')
        alert(`Some posts failed:\n${errorMessages}`)
      } else {
        // Success - show success message
        alert(`Successfully scheduled post${posts.length > 1 ? 's' : ''} to ${posts.map((p: any) => {
          const platform = p.platform as keyof typeof platformNames
          return platformNames[platform] || p.platform
        }).join(', ')}`)
      }

      setScheduleModal(false)
      setSelectedVideo('')
      setSelectedPlatforms([])
      setScheduledTime('')
      setCaption('')
      loadPosts()
    } catch (error: any) {
      console.error('Failed to schedule post:', error)
      const errorMessage = error.response?.data?.error || 'Failed to schedule post'
      alert(errorMessage)
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
      connected: 'success',
      disconnected: 'default',
      error: 'error',
      pending: 'default',
      posted: 'success',
      failed: 'error',
      cancelled: 'default',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const allPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook'] as const
  const connectedPlatforms = accounts
    .filter((a) => a.status === 'connected')
    .map((a) => a.platform)
  const availablePlatforms = allPlatforms.filter((p) => !connectedPlatforms.includes(p))

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Distribution</p>
          <h1 className="text-3xl font-semibold text-primary">Distribution</h1>
          <p className="text-sm text-slate-500">
            Connect social media accounts and schedule posts to distribute your videos automatically.
          </p>
        </div>

        {/* Social Accounts Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-primary">Social Accounts</h2>
              <p className="text-sm text-slate-500">Connect channels to push finished videos live automatically.</p>
            </div>
          </div>

          {accountsLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-3xl" />
              ))}
            </div>
          ) : accounts.length === 0 && availablePlatforms.length === 0 ? (
            <EmptyState
              icon={<Users className="w-16 h-16" />}
              title="No social accounts connected"
              description="Connect your social media accounts to start posting your videos automatically."
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {allPlatforms.map((platform) => {
                const account = accounts.find((a) => a.platform === platform)
                const Icon = platformIcons[platform]
                const isConnected = account?.status === 'connected'

                return (
                  <Card key={platform} hover className="flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-primary">{platformNames[platform]}</h3>
                          {account && getStatusBadge(account.status)}
                        </div>
                      </div>
                      {isConnected && (
                        <span className="text-xs font-medium uppercase tracking-wide text-emerald-500/80">Synced</span>
                      )}
                    </div>

                    {account?.status === 'pending' && (
                      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-600">
                        Finish linking in the connection portal. If you closed it, click Connect again to reopen or use the saved link.
                      </div>
                    )}

                    {isConnected && account && (
                      <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs text-slate-500">
                        Connected on {new Date(account.connected_at).toLocaleDateString()}.
                      </div>
                    )}

                    <div className="mt-auto">
                      {isConnected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDisconnectModal(account!.id)}
                          className="w-full border border-rose-200 bg-rose-50/70 text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleConnect(platform)}
                          loading={connectingPlatform === platform}
                          className="w-full"
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Scheduled Posts Section */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-primary">Scheduled Posts</h2>
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

          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-3xl" />
              ))}
            </div>
          ) : posts.length === 0 ? (
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
        </section>

        {/* Modals */}
        <Modal
          isOpen={connectPortal !== null}
          onClose={() => setConnectPortal(null)}
          title={
            connectPortal
              ? `Connect ${platformNames[connectPortal.platform]}`
              : 'Connect Social Account'
          }
          size="xl"
        >
          {connectPortal && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                {connectPortal.message ||
                  `Follow the steps below to link your ${platformNames[connectPortal.platform]} account without leaving this tab.`}
              </p>
              {connectPortal.duration && (
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Link valid for {connectPortal.duration}.
                </div>
              )}
              <div className="h-[400px] sm:h-[540px] max-h-[60vh] overflow-hidden rounded-3xl border border-white/60 bg-slate-50/70">
                {!portalLoadFailed && !connectPortal.embedDisabled ? (
                  <iframe
                    key={connectPortal.url}
                    src={connectPortal.url}
                    title={`${platformNames[connectPortal.platform]} connection portal`}
                    className="w-full h-full border-0"
                    onError={() => setPortalLoadFailed(true)}
                    onLoad={() => setPortalLoadFailed(false)}
                    allow="clipboard-read; clipboard-write; autoplay; encrypted-media"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center space-y-4 p-6 text-sm text-slate-500">
                    <p>We couldn't display the connection portal here. Use the link below to continue at Upload-Post.</p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => tryOpenPortalWindow(connectPortal.url)}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Open in new tab
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Connection URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={connectPortal.url}
                    className="flex-1 truncate rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-xs text-slate-500"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="border border-white/60 bg-white/70 text-slate-500 hover:border-brand-200 hover:text-brand-600"
                    onClick={handleCopyPortalLink}
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              {connectPortal.redirectUrl && (
                <p className="text-xs text-slate-400">
                  When you finish in the portal you should be redirected automatically. If that does not happen, return to{' '}
                  <span className="font-medium text-slate-600">{connectPortal.redirectUrl}</span>.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="border border-white/60 bg-white/70 text-brand-600 hover:border-brand-200 hover:bg-white"
                  onClick={() => tryOpenPortalWindow(connectPortal.url)}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Open in new tab
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
                  onClick={() => setConnectPortal(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={disconnectModal !== null}
          onClose={() => setDisconnectModal(null)}
          title="Disconnect Account"
          size="sm"
        >
          <p className="mb-4 text-sm text-slate-500">
            Are you sure you want to disconnect this account? You won't be able to post to this platform until you reconnect.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
              onClick={() => setDisconnectModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => disconnectModal && handleDisconnect(disconnectModal)}
              loading={disconnecting}
            >
              Disconnect
            </Button>
          </div>
        </Modal>

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
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${isSelected
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

