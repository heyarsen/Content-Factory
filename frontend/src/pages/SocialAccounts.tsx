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
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'

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

export function SocialAccounts() {
  const { t } = useLanguage()
  const { user, refreshSubscriptionStatus } = useAuth()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<SocialAccount['platform'] | null>(null)

  const platformNames: Record<string, string> = {
    instagram: t('platforms.instagram') !== 'platforms.instagram' ? t('platforms.instagram') : 'Instagram',
    tiktok: t('platforms.tiktok') !== 'platforms.tiktok' ? t('platforms.tiktok') : 'TikTok',
    youtube: t('platforms.youtube') !== 'platforms.youtube' ? t('platforms.youtube') : 'YouTube',
    facebook: t('platforms.facebook') !== 'platforms.facebook' ? t('platforms.facebook') : 'Facebook',
    x: t('platforms.x') !== 'platforms.x' ? t('platforms.x') : 'X (Twitter)',
    linkedin: t('platforms.linkedin') !== 'platforms.linkedin' ? t('platforms.linkedin') : 'LinkedIn',
    pinterest: t('platforms.pinterest') !== 'platforms.pinterest' ? t('platforms.pinterest') : 'Pinterest',
    threads: t('platforms.threads') !== 'platforms.threads' ? t('platforms.threads') : 'Threads',
  }
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

  // Refresh subscription status when component mounts
  useEffect(() => {
    if (user?.id) {
      // Refresh subscription status immediately and then again after 1 second
      refreshSubscriptionStatus()
      setTimeout(() => {
        refreshSubscriptionStatus()
      }, 1000)
    }
  }, [user?.id, refreshSubscriptionStatus])

  useEffect(() => {
    const connectedPlatform = searchParams.get('connected') as SocialAccount['platform'] | null

    if (connectedPlatform) {
      const platformLabel = platformNames[connectedPlatform] || connectedPlatform
      toast.success(t('social_accounts.connect_success').replace('{platform}', platformLabel))

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('connected')
      setSearchParams(nextParams, { replace: true })

      // Refresh accounts to reflect the latest status
      loadAccounts()
    }
  }, [searchParams, setSearchParams, loadAccounts])


  const handleConnect = async (platform: SocialAccount['platform']) => {
    // Refresh subscription status first to get the latest data
    const refreshResult = await refreshSubscriptionStatus()
    const { hasActiveSubscription, role: userRole } = refreshResult

    console.log('[Social] Connection attempt:', {
      platform,
      userId: user?.id,
      hasActiveSubscription,
      userRole
    })

    // Check if user has an active subscription
    if (!hasActiveSubscription) {
      toast.error(t('social_accounts.subscription_needed_alert'))
      return
    }

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
        t('social_accounts.initiate_failed')

      // Handle 429 rate limit specifically
      if (status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 60
        errorMessage = t('social_accounts.rate_limit_error').replace('{seconds}', retryAfter.toString())
      }

      // Handle subscription required error specifically
      if (status === 403 && error.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        errorMessage = t('social_accounts.subscription_needed_alert')
      }

      console.error('Error details:', {
        message: errorMessage,
        fullResponse: error.response?.data,
        status: error.response?.status,
      })
      toast.error(errorMessage)
    } finally {
      setConnectingPlatform(null)
    }
  }

  const handleDisconnect = async (id: string) => {
    setDisconnecting(true)
    try {
      await api.delete(`/api/social/accounts/${id}`)
      setAccounts(accounts.filter((a) => a.id !== id))
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error(t('errors.delete_failed'))
    } finally {
      setDisconnecting(false)
      setDisconnectModal(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'error'> = {
      connected: 'success',
      disconnected: 'default',
      error: 'error',
      pending: 'default',
    }
    return <Badge variant={variants[status] || 'default'}>{t(`social_accounts.status_${status}`)}</Badge>
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t('social_accounts.distribution')}</p>
          <h1 className="text-3xl font-semibold text-primary">{t('social_accounts.title')}</h1>
          <p className="text-sm text-slate-500">
            {t('social_accounts.subtitle')}
          </p>
        </div>

        {accounts.length === 0 && availablePlatforms.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title={t('social_accounts.no_accounts_title')}
            description={t('social_accounts.no_accounts_desc')}
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
                      <span className="text-xs font-medium uppercase tracking-wide text-emerald-500/80">{t('social_accounts.synced')}</span>
                    )}
                  </div>

                  {account?.status === 'pending' && (
                    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-600">
                      {t('social_accounts.finish_linking')}
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
                        {t('social_accounts.connected_on').replace('{date}', new Date(account.connected_at).toLocaleDateString())}
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
                        {t('social_accounts.disconnect')}
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
                        {t('social_accounts.connect')}
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
          title={t('social_accounts.disconnect_title')}
          size="sm"
        >
          <p className="mb-4 text-sm text-slate-500">
            {t('social_accounts.disconnect_confirm')}
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
              onClick={() => setDisconnectModal(null)}
            >
              {t('social_accounts.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => disconnectModal && handleDisconnect(disconnectModal)}
              loading={disconnecting}
            >
              {t('social_accounts.disconnect')}
            </Button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}

