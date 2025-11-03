import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Users, Link2, X, Instagram, Youtube, Facebook } from 'lucide-react'
import api from '../lib/api'

interface SocialAccount {
  id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  connected_at: string
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

export function SocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnectModal, setDisconnectModal] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectPortal, setConnectPortal] = useState<{
    platform: SocialAccount['platform']
    url: string
    duration?: string
    redirectUrl?: string
    message?: string
  } | null>(null)
  const [portalLoadFailed, setPortalLoadFailed] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
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

  useEffect(() => {
    if (connectPortal) {
      setPortalLoadFailed(false)
      setCopiedLink(false)
    }
  }, [connectPortal?.url])

  useEffect(() => {
    if (!copiedLink) return
    const timeout = setTimeout(() => setCopiedLink(false), 2000)
    return () => clearTimeout(timeout)
  }, [copiedLink])

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

  const handleConnect = async (platform: SocialAccount['platform']) => {
    setConnecting(true)
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

      if (accessUrl) {
        const resolvedAccessUrl = buildPlatformUrl(accessUrl)
        localStorage.setItem(`uploadpost_access_url_${platform}`, resolvedAccessUrl)
        setConnectPortal({
          platform,
          url: resolvedAccessUrl,
          duration,
          redirectUrl,
          message: message || `Account linking initiated for ${platformLabel}.`,
        })
      } else {
        const fallbackParts = [
          message || `Account linking initiated for ${platformLabel}.`,
        ]

        if (duration) {
          fallbackParts.push(`Link valid for ${duration}.`)
        }

        if (redirectUrl) {
          fallbackParts.push(
            `Once finished you will be redirected automatically. If that does not happen, revisit: ${redirectUrl}`
          )
        }

        alert(fallbackParts.join('\n\n'))
      }

      // Reload accounts to show pending status
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
      setConnecting(false)
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

  const allPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook'] as const
  const connectedPlatforms = accounts
    .filter((a) => a.status === 'connected')
    .map((a) => a.platform)
  const availablePlatforms = allPlatforms.filter((p) => !connectedPlatforms.includes(p))

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Social Accounts</h1>
          <p className="text-sm text-gray-600 mt-2">Connect your social media accounts to post videos</p>
        </div>

        {accounts.length === 0 && availablePlatforms.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title="No social accounts connected"
            description="Connect your social media accounts to start posting your videos automatically."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allPlatforms.map((platform) => {
              const account = accounts.find((a) => a.platform === platform)
              const Icon = platformIcons[platform]
              const isConnected = account?.status === 'connected'

              return (
                <Card key={platform}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Icon className="w-8 h-8 text-purple-600" />
                      <div>
                        <h3 className="font-bold text-sm text-primary">{platformNames[platform]}</h3>
                        {account && getStatusBadge(account.status)}
                      </div>
                    </div>
                  </div>

                  {account?.status === 'pending' && (
                    <p className="text-xs text-gray-600 mb-4">
                      Finish linking in the connection portal. If you closed it, click Connect again to reopen or use the saved link.
                    </p>
                  )}

                  {isConnected && account && (
                    <p className="text-xs text-gray-600 mb-4">
                      Connected on {new Date(account.connected_at).toLocaleDateString()}
                    </p>
                  )}

                  {isConnected ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDisconnectModal(account!.id)}
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConnect(platform)}
                      loading={connecting}
                      className="w-full"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        )}

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
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {connectPortal.message ||
                  `Follow the steps below to link your ${platformNames[connectPortal.platform]} account without leaving this tab.`}
              </p>
              {connectPortal.duration && (
                <div className="text-xs text-gray-500">
                  Link valid for {connectPortal.duration}.
                </div>
              )}
              <div className="border border-gray-200 rounded-lg overflow-hidden h-[540px] bg-gray-50">
                {!portalLoadFailed ? (
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
                  <div className="h-full flex flex-col items-center justify-center text-sm text-gray-600 p-6 space-y-4">
                    <p>The connection portal could not be displayed here.</p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => window.open(connectPortal.url, '_blank', 'noopener')}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Open in new tab
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Connection URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={connectPortal.url}
                    className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-md bg-white truncate"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyPortalLink}
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              {connectPortal.redirectUrl && (
                <p className="text-xs text-gray-500">
                  When you finish in the portal you should be redirected automatically. If that does not happen, return to{' '}
                  <span className="font-medium text-gray-700">{connectPortal.redirectUrl}</span>.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(connectPortal.url, '_blank', 'noopener')}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Open in new tab
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
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
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to disconnect this account? You won't be able to post to this platform until you reconnect.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDisconnectModal(null)}>
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

