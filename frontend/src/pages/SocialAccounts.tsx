import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import {
  Users,
  Link2,
  X,
  Instagram,
  Youtube,
  Facebook,
  Share2,
  Linkedin,
} from 'lucide-react'
import api from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { CreditBanner } from '../components/ui/CreditBanner'
import { useToast } from '../hooks/useToast'

interface SocialAccount {
  id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'x' | 'linkedin' | 'threads'
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
  linkedin: Linkedin,
  threads: Share2,
}

export function SocialAccounts() {
  const { t } = useLanguage()
  const { user, refreshSubscriptionStatus } = useAuth()
  const { credits, unlimited } = useCreditsContext()
  const hasSubscription = (user?.hasActiveSubscription || user?.role === 'admin') || false
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<SocialAccount['platform'] | null>(null)
  const [disconnectModal, setDisconnectModal] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const platformNames: Record<string, string> = {
    instagram: t('platforms.instagram') !== 'platforms.instagram' ? t('platforms.instagram') : 'Instagram',
    tiktok: t('platforms.tiktok') !== 'platforms.tiktok' ? t('platforms.tiktok') : 'TikTok',
    youtube: t('platforms.youtube') !== 'platforms.youtube' ? t('platforms.youtube') : 'YouTube',
    facebook: t('platforms.facebook') !== 'platforms.facebook' ? t('platforms.facebook') : 'Facebook',
    x: t('platforms.x') !== 'platforms.x' ? t('platforms.x') : 'X (Twitter)',
    linkedin: t('platforms.linkedin') !== 'platforms.linkedin' ? t('platforms.linkedin') : 'LinkedIn',
    threads: t('platforms.threads') !== 'platforms.threads' ? t('platforms.threads') : 'Threads',
  }

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
    if (user?.id) {
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

      loadAccounts()
    }
  }, [searchParams, setSearchParams, loadAccounts])

  const connectedPlatforms = accounts.filter((a: SocialAccount) => a.status === 'connected')

  const handleConnect = async (platform: SocialAccount['platform']) => {
    const hasSub = user?.hasActiveSubscription || user?.role === 'admin'
    const safeCanCreate = hasSub || (credits !== null && credits > 0) || unlimited

    if (!safeCanCreate) {
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
        } catch {
          const separator = baseUrl.includes('?') ? '&' : '?'
          return `${baseUrl}${separator}platform=${platform}`
        }
      }

      const resolvedAccessUrl = accessUrl
        ? buildPlatformUrl(accessUrl)
        : buildPlatformUrl('https://connect.upload-post.com')

      localStorage.setItem(`uploadpost_access_url_${platform}`, resolvedAccessUrl)
      window.location.href = resolvedAccessUrl
      loadAccounts()
    } catch (error: any) {
      const status = error.response?.status
      let errorMessage = error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        t('social_accounts.initiate_failed')

      if (status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 60
        errorMessage = t('social_accounts.rate_limit_error').replace('{seconds}', retryAfter.toString())
      }

      if (status === 403 && error.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        errorMessage = t('social_accounts.subscription_needed_alert')
      }

      toast.error(errorMessage)
    } finally {
      setConnectingPlatform(null)
    }
  }

  const handleDisconnect = async (id: string) => {
    setDisconnecting(true)
    try {
      await api.delete(`/api/social/accounts/${id}`)
      setAccounts(accounts.filter((a: SocialAccount) => a.id !== id))
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

  const allPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'threads'] as const

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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Inbox / Engagement</p>
          <h1 className="text-3xl font-semibold text-primary">Unified social inbox</h1>
          <p className="text-sm text-slate-500">
            Connect DMs and manage comments, mentions, and direct messages in one workspace with AI-assisted responses.
          </p>
        </div>

        <CreditBanner />

        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Connected channels</h2>
              <p className="text-sm text-slate-500">Link channels to ingest DMs, comments, and mentions.</p>
            </div>
            <Badge variant="default">{connectedPlatforms.length} connected</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {allPlatforms.map((platform) => {
              const account = accounts.find((a: SocialAccount) => a.platform === platform)
              const Icon = platformIcons[platform]
              const isConnected = account?.status === 'connected'

              return (
                <Card key={platform} hover className="flex h-full flex-col gap-4 border border-slate-100 bg-slate-50/60 p-4 shadow-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-primary">{platformNames[platform]}</h3>
                        {account && getStatusBadge(account.status)}
                      </div>
                    </div>
                    {isConnected && <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500">DM sync on</span>}
                  </div>

                  {isConnected && account?.account_info?.username && (
                    <p className="text-xs text-slate-500">@{account.account_info.username}</p>
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
                        Disconnect DM channel
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConnect(platform)}
                        loading={connectingPlatform === platform}
                        disabled={!hasSubscription}
                        className="w-full"
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Connect DMs
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </Card>


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
