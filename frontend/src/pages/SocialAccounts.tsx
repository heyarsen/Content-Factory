import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import {
  Users,
  Link2,
  X,
  Instagram,
  Youtube,
  Facebook,
  Share2,
  Linkedin,
  MessageCircle,
  Send,
  Sparkles,
  AlertTriangle,
  UserCheck,
  MessageSquare,
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

type InboxView = 'unread' | 'urgent' | 'assigned' | 'all'
type InteractionType = 'comment' | 'mention' | 'dm'
type Sentiment = 'positive' | 'neutral' | 'negative'
type BrandPreset = 'Professional' | 'Friendly' | 'Playful'

interface InboxInteraction {
  id: string
  platform: SocialAccount['platform']
  platformAccountId: string
  sender: string
  type: InteractionType
  message: string
  unread: boolean
  urgent: boolean
  assignedTo: string | null
  slaMinutes: number
  createdAt: string
  sentiment: Sentiment
  needsEscalation: boolean
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

const interactionTypeLabel: Record<InteractionType, string> = {
  comment: 'Comment',
  mention: 'Mention',
  dm: 'Direct message',
}

const sentimentLabel: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
}

const teamMembers = ['Anna', 'Sam', 'Jordan', 'Priya']

const brandVoicePresets: Record<BrandPreset, string> = {
  Professional: 'clear, concise, and confidence-building',
  Friendly: 'warm, conversational, and helpful',
  Playful: 'lighthearted, energetic, and upbeat',
}

const relativeTime = (date: string) => {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const buildDemoInteractions = (accounts: SocialAccount[]): InboxInteraction[] => {
  const connected = accounts.filter((account) => account.status === 'connected')
  return connected.flatMap((account, index) => {
    const name = account.account_info?.display_name || account.account_info?.username || account.platform
    const now = Date.now()

    return [
      {
        id: `${account.id}-dm`,
        platform: account.platform,
        platformAccountId: account.id,
        sender: `${name} community`,
        type: 'dm' as const,
        message: `Hi! Can you share pricing details and onboarding timeline for your service?`,
        unread: true,
        urgent: index % 2 === 0,
        assignedTo: index % 2 === 0 ? 'Anna' : null,
        slaMinutes: index % 2 === 0 ? 10 : 75,
        createdAt: new Date(now - (index + 1) * 1000 * 60 * 23).toISOString(),
        sentiment: index % 2 === 0 ? 'neutral' : 'positive',
        needsEscalation: index % 3 === 0,
      },
      {
        id: `${account.id}-mention`,
        platform: account.platform,
        platformAccountId: account.id,
        sender: `${name} followers`,
        type: 'mention' as const,
        message: `@yourbrand can someone help me with order #${1130 + index}?`,
        unread: index % 2 === 1,
        urgent: index % 2 === 1,
        assignedTo: index % 2 === 1 ? 'Jordan' : null,
        slaMinutes: 35,
        createdAt: new Date(now - (index + 2) * 1000 * 60 * 47).toISOString(),
        sentiment: 'negative',
        needsEscalation: true,
      },
      {
        id: `${account.id}-comment`,
        platform: account.platform,
        platformAccountId: account.id,
        sender: `${name} audience`,
        type: 'comment' as const,
        message: `Love this content! Do you also support team workflows for approvals?`,
        unread: true,
        urgent: false,
        assignedTo: null,
        slaMinutes: 120,
        createdAt: new Date(now - (index + 2) * 1000 * 60 * 14).toISOString(),
        sentiment: 'positive',
        needsEscalation: false,
      },
    ]
  })
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
  const [inboxView, setInboxView] = useState<InboxView>('unread')
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialAccount['platform']>('all')
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null)
  const [brandVoice, setBrandVoice] = useState<BrandPreset>('Professional')
  const [replyDraft, setReplyDraft] = useState('')

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

  const interactions = useMemo(() => buildDemoInteractions(accounts), [accounts])
  const connectedPlatforms = useMemo(
    () => accounts.filter((a: SocialAccount) => a.status === 'connected').map((a: SocialAccount) => a.platform),
    [accounts]
  )

  const filteredInteractions = useMemo(() => {
    return interactions.filter((interaction) => {
      if (platformFilter !== 'all' && interaction.platform !== platformFilter) return false
      if (inboxView === 'unread') return interaction.unread
      if (inboxView === 'urgent') return interaction.urgent || interaction.slaMinutes <= 15
      if (inboxView === 'assigned') return Boolean(interaction.assignedTo)
      return true
    })
  }, [interactions, platformFilter, inboxView])

  const activeInteraction = filteredInteractions.find((item) => item.id === activeInteractionId) || filteredInteractions[0]

  useEffect(() => {
    if (!activeInteraction && filteredInteractions.length > 0) {
      setActiveInteractionId(filteredInteractions[0].id)
      return
    }

    if (activeInteraction && replyDraft.trim() === '') {
      setReplyDraft(`Thanks for reaching out! I'm checking this now and will share the next steps shortly.`)
    }
  }, [filteredInteractions, activeInteraction, replyDraft])

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

  const generateDraft = () => {
    if (!activeInteraction) return

    const voice = brandVoicePresets[brandVoice]
    const escalationLine = activeInteraction.needsEscalation
      ? 'I have flagged this for escalation and a specialist will also review it.'
      : 'I can fully support this request from here.'

    const draft = `Hi ${activeInteraction.sender},\n\nThanks for your message. We appreciate you reaching out. In our ${voice} brand voice, here's the update: ${escalationLine} We'll get this resolved within the expected response window.\n\nBest regards,\nContent Factory team`
    setReplyDraft(draft)
  }

  const assignInteraction = (member: string) => {
    if (!activeInteraction) return
    toast.success(`${interactionTypeLabel[activeInteraction.type]} assigned to ${member}.`)
  }

  const submitReply = () => {
    if (!activeInteraction || !replyDraft.trim()) return
    toast.success(`Reply queued for ${platformNames[activeInteraction.platform]} ${interactionTypeLabel[activeInteraction.type].toLowerCase()}.`)
    setReplyDraft('')
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

        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Inbox views</h2>
              <p className="text-sm text-slate-500">Filter unread, urgent, and assigned interactions across platforms.</p>
            </div>
            <div className="w-52">
              <Select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value as typeof platformFilter)}
                options={[
                  { value: 'all', label: 'All connected platforms' },
                  ...connectedPlatforms.map((platform) => ({ value: platform, label: platformNames[platform] })),
                ]}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([
              { key: 'unread', label: 'Unread', icon: MessageCircle },
              { key: 'urgent', label: 'Urgent', icon: AlertTriangle },
              { key: 'assigned', label: 'Assigned', icon: UserCheck },
              { key: 'all', label: 'All activity', icon: MessageSquare },
            ] as const).map(({ key, label, icon: Icon }) => {
              const count = interactions.filter((item) => {
                if (key === 'unread') return item.unread
                if (key === 'urgent') return item.urgent || item.slaMinutes <= 15
                if (key === 'assigned') return Boolean(item.assignedTo)
                return true
              }).length

              const active = inboxView === key

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInboxView(key)}
                  className={`rounded-2xl border p-4 text-left transition ${active
                    ? 'border-brand-200 bg-brand-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-lg font-semibold text-primary">{count}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                </button>
              )
            })}
          </div>

          {connectedPlatforms.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="Connect at least one social channel"
              description="Once connected, comments, mentions, and DMs will appear here for faster responses."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="space-y-3">
                {filteredInteractions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                    No interactions in this view.
                  </div>
                ) : (
                  filteredInteractions.map((interaction) => {
                    const isSelected = interaction.id === activeInteraction?.id
                    const Icon = platformIcons[interaction.platform]

                    return (
                      <button
                        type="button"
                        key={interaction.id}
                        onClick={() => setActiveInteractionId(interaction.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${isSelected
                          ? 'border-brand-200 bg-brand-50/70'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-brand-600" />
                            <span className="text-sm font-semibold text-primary">{platformNames[interaction.platform]}</span>
                            <Badge variant="default">{interactionTypeLabel[interaction.type]}</Badge>
                          </div>
                          <span className="text-xs text-slate-500">{relativeTime(interaction.createdAt)}</span>
                        </div>

                        <p className="line-clamp-2 text-sm text-slate-600">{interaction.message}</p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {interaction.unread && <Badge variant="default">Unread</Badge>}
                          {(interaction.urgent || interaction.slaMinutes <= 15) && <Badge variant="error">Urgent</Badge>}
                          {interaction.assignedTo && <Badge variant="success">Assigned: {interaction.assignedTo}</Badge>}
                          <Badge variant="default">SLA: {interaction.slaMinutes}m</Badge>
                          <Badge variant={interaction.sentiment === 'negative' ? 'error' : 'default'}>
                            Sentiment: {sentimentLabel[interaction.sentiment]}
                          </Badge>
                          {interaction.needsEscalation && <Badge variant="error">Needs escalation</Badge>}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              <Card className="space-y-4 border border-slate-100 bg-slate-50/70 p-5 shadow-none">
                {activeInteraction ? (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-primary">Respond faster with AI</h3>
                      <p className="text-sm text-slate-500">Draft a reply aligned with your brand voice and team workflow.</p>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Selected interaction</p>
                      <p className="text-sm text-slate-700">{activeInteraction.message}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        value={brandVoice}
                        onChange={(e) => setBrandVoice(e.target.value as BrandPreset)}
                        options={(Object.keys(brandVoicePresets) as BrandPreset[]).map((preset) => ({
                          value: preset,
                          label: `${preset} voice`,
                        }))}
                      />
                      <Select
                        value={activeInteraction.assignedTo || ''}
                        onChange={(e) => assignInteraction(e.target.value)}
                        options={[
                          { value: '', label: 'Assign owner' },
                          ...teamMembers.map((member) => ({ value: member, label: member })),
                        ]}
                      />
                    </div>

                    <Input
                      label="SLA target"
                      value={`Respond in ${activeInteraction.slaMinutes} minutes`}
                      readOnly
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={generateDraft} className="border border-slate-200 bg-white">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate AI draft
                      </Button>
                      {activeInteraction.needsEscalation && (
                        <Badge variant="error">Escalation flag enabled</Badge>
                      )}
                    </div>

                    <Textarea
                      label="Reply draft"
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={8}
                      placeholder="AI draft appears here..."
                    />

                    <Button variant="primary" onClick={submitReply} className="w-full" disabled={!replyDraft.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Send reply
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select an interaction to draft a reply.</p>
                )}
              </Card>
            </div>
          )}
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
