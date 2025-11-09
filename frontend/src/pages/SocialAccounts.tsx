import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Users, Link2, X, Instagram, Youtube, Facebook, Share2 } from 'lucide-react'
import api from '../lib/api'

interface SocialAccount {
  id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'x' | 'linkedin' | 'pinterest' | 'threads'
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  connected_at: string
  account_info?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

const platformIcons = {
  instagram: Instagram,
  tiktok: Users,
  youtube: Youtube,
  facebook: Facebook,
  x: Share2,
  linkedin: Users,
  pinterest: Share2,
  threads: Share2,
}

const platformNames = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

export function SocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<SocialAccount['platform'] | null>(null)
  const [disconnectModal, setDisconnectModal] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const loadAccounts = useCallback(async () => {
    try {
      const response = await api.get('/api/social/accounts')
      setAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    const connectedPlatform = searchParams.get('connected') as SocialAccount['platform'] | null

    if (connectedPlatform) {
      const platformLabel = platformNames[connectedPlatform] || connectedPlatform
      alert(`Success! ${platformLabel} connected successfully.`)

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('connected')
      setSearchParams(nextParams, { replace: true })

      // Refresh accounts to reflect the latest status
      loadAccounts()
    }
  }, [searchParams, setSearchParams, loadAccounts])


  const handleConnect = async (platform: SocialAccount['platform']) => {
    setConnectingPlatform(platform)
    try {
      const response = await api.post('/api/social/connect', { platform })
      const { accessUrl, uploadPostUsername, redirectUrl } = response.data as {
        accessUrl?: string
        uploadPostUsername?: string
        redirectUrl?: string
      }

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

      // Redirect directly to Upload-Post connection page instead of popup
      if (accessUrl) {
        const resolvedAccessUrl = buildPlatformUrl(accessUrl)
        localStorage.setItem(`uploadpost_access_url_${platform}`, resolvedAccessUrl)
        // Redirect current window to Upload-Post
        window.location.href = resolvedAccessUrl
      } else {
        const fallbackBaseUrl = buildPlatformUrl('https://connect.upload-post.com')
        localStorage.setItem(`uploadpost_access_url_${platform}`, fallbackBaseUrl)
        // Redirect current window to Upload-Post
        window.location.href = fallbackBaseUrl
      }

      // Reload accounts to show pending status
      loadAccounts()
    } catch (error: any) {
      console.error('Failed to connect:', error)
      const status = error.response?.status
      let errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        'Failed to initiate connection'
      
      // Handle 429 rate limit specifically
      if (status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 60
        errorMessage = `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
      }
      
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'error'> = {
      connected: 'success',
      disconnected: 'default',
      error: 'error',
      pending: 'default',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const allPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'threads'] as const
  const connectedPlatforms = accounts
    .filter((a) => a.status === 'connected')
    .map((a) => a.platform)
  const availablePlatforms = allPlatforms.filter((p) => !connectedPlatforms.includes(p))

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-28 rounded-[28px]" />
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Distribution</p>
          <h1 className="text-3xl font-semibold text-primary">Social accounts</h1>
          <p className="text-sm text-slate-500">
            Connect channels to push finished videos live automatically. Secure OAuth flows keep credentials safe.
          </p>
        </div>

        {accounts.length === 0 && availablePlatforms.length === 0 ? (
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
                    <div className="space-y-3">
                      {account.account_info && (account.account_info.username || account.account_info.avatar_url) && (
                        <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
                          {account.account_info.avatar_url && (
                            <img 
                              src={account.account_info.avatar_url} 
                              alt={account.account_info.display_name || account.account_info.username || platformNames[platform]}
                              className="h-8 w-8 rounded-full object-cover"
                              onError={(e) => {
                                // Hide image if it fails to load
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            {account.account_info.display_name && (
                              <div className="text-sm font-medium text-slate-700 truncate">
                                {account.account_info.display_name}
                              </div>
                            )}
                            {account.account_info.username && (
                              <div className="text-xs text-slate-500 truncate">
                                @{account.account_info.username}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs text-slate-500">
                        Connected on {new Date(account.connected_at).toLocaleDateString()}.
                      </div>
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
      </div>
    </Layout>
  )
}

