import { useEffect, useState } from 'react'
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
  status: 'connected' | 'disconnected' | 'error'
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

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      setAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platform: string) => {
    setConnecting(true)
    try {
      const response = await api.post('/api/social/connect', { platform })
      // Redirect to OAuth URL
      window.location.href = response.data.authUrl
    } catch (error: any) {
      console.error('Failed to connect:', error)
      alert(error.response?.data?.error || 'Failed to initiate connection')
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

