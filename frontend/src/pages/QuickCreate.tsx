import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Sparkles, Video, Share2, Instagram, Youtube, Users, Facebook, AlertTriangle, Image, FileText, Lock } from 'lucide-react'
import api from '../lib/api'
import { DEFAULT_VERTICAL_ASPECT_RATIO, DEFAULT_VERTICAL_DIMENSION } from '../lib/videos'
import { useNotifications } from '../contexts/NotificationContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { useAuth } from '../contexts/AuthContext'

type NanoBananaProvider = 'nano-banana' | 'nano-banana-pro'

const NANO_BANANA_COSTS: Record<NanoBananaProvider, number> = {
  'nano-banana': 0.5,
  'nano-banana-pro': 1,
}

interface SocialAccount {
  id: string
  platform: string
  status: string
}

const platformIcons: Record<string, React.FC<any>> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Users,
  facebook: Facebook,
  x: Share2,
}

const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X (Twitter)',
}

const campaignObjectiveOptions = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
  { value: 'sales', label: 'Sales' },
]

const defaultChannelOptions = ['instagram', 'youtube', 'tiktok', 'facebook', 'x']


export function QuickCreate() {
  const navigate = useNavigate()
  const { addNotification } = useNotifications()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { credits, unlimited, subscription } = useCreditsContext()
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('Cinematic')
  const [campaignObjective, setCampaignObjective] = useState('awareness')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [duration] = useState(15)
  const [generateCaption, setGenerateCaption] = useState(true)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [formError, setFormError] = useState('')
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [creativeTab, setCreativeTab] = useState<'video' | 'photo' | 'text'>('video')
  const [photoPrompt, setPhotoPrompt] = useState('')
  const [photoAspectRatio, setPhotoAspectRatio] = useState('1:1')
  const [photoProvider, setPhotoProvider] = useState<NanoBananaProvider>('nano-banana')
  const [photoResultUrl, setPhotoResultUrl] = useState('')
  const [generatingPhoto, setGeneratingPhoto] = useState(false)

  const [ctaText, setCtaText] = useState('')

  const hasSubscription = !!(user?.role === 'admin' || (subscription && ['active', 'pending'].includes(subscription.status)))
  const canGenerateVideo = hasSubscription || unlimited || (credits !== null && credits > 0)
  const selectedPhotoCost = NANO_BANANA_COSTS[photoProvider]
  const canGeneratePhoto = hasSubscription || unlimited || (credits !== null && credits >= selectedPhotoCost)
  const connectedPlatforms = socialAccounts
    .filter((acc: SocialAccount) => acc.status === 'connected')
    .map((acc: SocialAccount) => acc.platform)

  useEffect(() => {
    loadSocialAccounts()
  }, [])

  useEffect(() => {
    if (!connectedPlatforms.length || selectedChannels.length > 0) {
      return
    }

    setSelectedChannels(connectedPlatforms)
  }, [connectedPlatforms, selectedChannels.length])

  const loadSocialAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      const accounts = response.data.accounts || []
      setSocialAccounts(accounts)
    } catch (error) {
      console.error('Failed to load social accounts:', error)
    }
  }

  const handleGenerateVideo = async () => {
    if (!canGenerateVideo) {
      setFormError(t('common.trial_credits_ended_message'))
      return
    }

    if (!topic.trim()) {
      setFormError(t('validation.required_field'))
      return
    }

    if (!selectedChannels.length) {
      setFormError('Select at least one channel to continue.')
      return
    }

    setGeneratingVideo(true)
    setFormError('')

    try {
      const verticalDimension = { ...DEFAULT_VERTICAL_DIMENSION }
      const ctaSection = ctaText.trim() ? `\n[CTA] ${ctaText.trim()}` : ''
      const descriptionWithContext = description.trim()
        ? `[Objective: ${campaignObjective}] ${description.trim()}${ctaSection}`
        : `Objective: ${campaignObjective}.${ctaText.trim() ? ` CTA: ${ctaText.trim()}` : ''}`

      await api.post('/api/videos/generate', {
        topic,
        description: descriptionWithContext,
        style,
        duration,
        provider: 'sora',
        campaign_objective: campaignObjective,
        channels: selectedChannels,
        generateScript: true,
        generate_caption: generateCaption,
        aspect_ratio: DEFAULT_VERTICAL_ASPECT_RATIO,
        dimension: verticalDimension,
      })

      addNotification({
        type: 'success',
        title: t('quick_create.gen_start_title'),
        message: t('quick_create.gen_start_desc'),
      })

      navigate('/videos')
    } catch (error: any) {
      console.error('Video generation error:', error)
      setFormError(error.response?.data?.error || t('errors.something_went_wrong'))
    } finally {
      setGeneratingVideo(false)
    }
  }

  const creativeTabs = [
    {
      key: 'video' as const,
      label: 'Video generation',
      description: 'Generate a complete video with AI guidance and publishing controls.',
      icon: Video,
      unavailable: false,
    },
    {
      key: 'photo' as const,
      label: 'Photo generation',
      description: 'Generate high-quality images from prompts using Nano Banana models.',
      icon: Image,
      unavailable: false,
    },
    {
      key: 'text' as const,
      label: 'Text generation',
      description: 'Coming soon in Creative Studio.',
      icon: FileText,
      unavailable: true,
    },
  ]

  const handleGeneratePhoto = async () => {
    if (!canGeneratePhoto) {
      setFormError(`You need ${selectedPhotoCost} credit${selectedPhotoCost === 1 ? '' : 's'} for this provider.`)
      return
    }

    if (!photoPrompt.trim()) {
      setFormError('Photo prompt is required.')
      return
    }

    setGeneratingPhoto(true)
    setFormError('')

    try {
      const createResponse = await api.post('/api/images/generate', {
        prompt: photoPrompt.trim(),
        image_size: photoAspectRatio,
        output_format: 'png',
        providerTier: photoProvider,
      })

      const taskId = createResponse.data?.taskId
      if (!taskId) {
        throw new Error('Missing task id from generation response')
      }

      const parseStatusState = (statusData: any): string => {
        const rawState = statusData?.state || statusData?.status || statusData?.task_status || statusData?.taskStatus
        return typeof rawState === 'string' ? rawState.toLowerCase() : ''
      }

      const extractResultUrl = (statusData: any): string | null => {
        const candidates = [
          statusData?.resultJson,
          statusData?.result_json,
          statusData?.result,
          statusData?.output,
          statusData?.response,
          statusData,
        ]

        for (const candidate of candidates) {
          const parsed = typeof candidate === 'string' ? (() => {
            try {
              return JSON.parse(candidate)
            } catch {
              return null
            }
          })() : candidate

          if (!parsed || typeof parsed !== 'object') {
            continue
          }

          const directUrl = parsed?.resultUrl || parsed?.result_url || parsed?.url || parsed?.imageUrl || parsed?.image_url
          if (typeof directUrl === 'string' && directUrl.trim()) {
            return directUrl
          }

          const urlArrays = [
            parsed?.resultUrls,
            parsed?.result_urls,
            parsed?.images,
            parsed?.urls,
            parsed?.output,
          ]

          for (const maybeArray of urlArrays) {
            if (Array.isArray(maybeArray) && maybeArray.length > 0) {
              const firstItem = maybeArray[0]
              if (typeof firstItem === 'string' && firstItem.trim()) {
                return firstItem
              }
              if (firstItem && typeof firstItem === 'object') {
                const nestedUrl = firstItem.url || firstItem.imageUrl || firstItem.image_url
                if (typeof nestedUrl === 'string' && nestedUrl.trim()) {
                  return nestedUrl
                }
              }
            }
          }
        }

        return null
      }

      let attempts = 0
      while (attempts < 40) {
        attempts += 1
        await new Promise((resolve) => setTimeout(resolve, 2500))

        const statusResponse = await api.get(`/api/images/status/${taskId}`)
        const statusData = statusResponse.data?.data
        const state = parseStatusState(statusData)

        if (['success', 'succeeded', 'completed', 'done', 'finish', 'finished'].includes(state)) {
          const url = extractResultUrl(statusData)

          if (!url) {
            throw new Error('Image finished but no result URL was returned')
          }

          await api.post('/api/images/library', {
            imageUrl: url,
            prompt: photoPrompt.trim(),
            providerTier: photoProvider,
            aspectRatio: photoAspectRatio,
          })

          setPhotoResultUrl(url)
          addNotification({
            type: 'success',
            title: 'Image generated',
            message: `Your image is ready and saved to Library with ${photoProvider === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Nano Banana'}.`,
          })
          return
        }

        if (['fail', 'failed', 'error', 'canceled', 'cancelled'].includes(state)) {
          throw new Error(statusData?.failMsg || 'Image generation failed')
        }
      }

      throw new Error('Image generation timed out. Please try again.')
    } catch (error: any) {
      console.error('Photo generation error:', error)
      setFormError(error.response?.data?.error || error.message || t('errors.something_went_wrong'))
    } finally {
      setGeneratingPhoto(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
        {!canGenerateVideo && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('common.trial_credits_ended_message')}</span>
          </div>
        )}

        {formError && <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{formError}</div>}

        <Card className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-semibold text-primary">{t('common.manual_creation')}</h2>
            </div>

            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3">
              {creativeTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = creativeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCreativeTab(tab.key)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${isActive
                      ? 'border-brand-300 bg-white text-brand-700 shadow-sm'
                      : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </span>
                      {tab.unavailable && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                          <Lock className="h-3 w-3" />
                          Unavailable
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{tab.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {creativeTab === 'text' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Text generation is currently unavailable.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Use <span className="font-semibold text-brand-600">Video generation</span> to continue creating content right now.
              </p>
            </div>
          ) : creativeTab === 'photo' ? (
            <div className="space-y-5">
              <Textarea
                label="Photo prompt"
                placeholder="Describe the image you want to generate..."
                rows={4}
                value={photoPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPhotoPrompt(e.target.value)}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Image provider"
                  value={photoProvider}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPhotoProvider(e.target.value as NanoBananaProvider)}
                  options={[
                    { value: 'nano-banana', label: 'Nano Banana (0.5 credits)' },
                    { value: 'nano-banana-pro', label: 'Nano Banana Pro (1 credit)' },
                  ]}
                />
                <Select
                  label="Aspect ratio"
                  value={photoAspectRatio}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPhotoAspectRatio(e.target.value)}
                  options={[
                    { value: '1:1', label: '1:1 (Square)' },
                    { value: '9:16', label: '9:16 (Portrait)' },
                    { value: '16:9', label: '16:9 (Landscape)' },
                    { value: '3:4', label: '3:4' },
                    { value: '4:3', label: '4:3' },
                    { value: '2:3', label: '2:3' },
                    { value: '3:2', label: '3:2' },
                  ]}
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {photoProvider === 'nano-banana' ? 'Nano Banana costs 0.5 credits per image.' : 'Nano Banana Pro costs 1 credit per image.'}
              </div>

              {photoResultUrl && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-primary">Latest generated image</p>
                  <img src={photoResultUrl} alt="Generated" className="max-h-[420px] w-full rounded-2xl border border-slate-200 object-contain bg-slate-50" />
                  <a href={photoResultUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Open full size image
                  </a>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-3">
                <Button variant="ghost" onClick={() => navigate('/videos')} className="w-full sm:w-auto border border-slate-200">
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleGeneratePhoto}
                  disabled={generatingPhoto || !canGeneratePhoto}
                  loading={generatingPhoto}
                  leftIcon={!generatingPhoto ? <Image className="h-4 w-4" /> : undefined}
                  className="w-full sm:w-auto shadow-lg shadow-brand-500/20"
                >
                  Generate photo ({selectedPhotoCost} credit{selectedPhotoCost === 1 ? '' : 's'})
                </Button>
              </div>
            </div>
          ) : (
            <>

          {connectedPlatforms.length > 0 && (
            <div className="mb-6 rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
              <p className="mb-2 text-sm font-semibold text-blue-700">Connected Social Media</p>
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.map((platform: string) => {
                  const Icon = platformIcons[platform] || Share2
                  return (
                    <div key={platform} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5">
                      <Icon className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">{platformNames[platform] || platform}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Input
              label={t('quick_create.topic_label')}
              placeholder={t('quick_create.topic_placeholder')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Campaign objective"
                value={campaignObjective}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCampaignObjective(e.target.value)}
                options={campaignObjectiveOptions}
              />
            </div>

            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700">
              Videos generated in Creative Studio stay in your library as drafts. You can publish them later from the Distribution/Posts flow.
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Channel(s)</p>
              <div className="flex flex-wrap gap-2">
                {(connectedPlatforms.length ? connectedPlatforms : defaultChannelOptions).map((platform: string) => {
                  const selected = selectedChannels.includes(platform)
                  const Icon = platformIcons[platform] || Share2
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() =>
                        setSelectedChannels((prev) =>
                          prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform],
                        )
                      }
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        selected
                          ? 'border-brand-300 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {platformNames[platform] || platform}
                    </button>
                  )
                })}
              </div>
            </div>

            <Input
              label="Call to action (optional)"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
            />

            <Textarea
              label={t('quick_create.desc_label')}
              placeholder={t('quick_create.desc_placeholder')}
              rows={3}
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            />

            <Select
              label={t('quick_create.video_style')}
              value={style}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStyle(e.target.value)}
              options={[
                { value: 'Cinematic', label: 'Cinematic' },
                { value: 'Realistic', label: 'Realistic' },
                { value: 'Anime', label: 'Anime' },
                { value: '3D Render', label: '3D Render' },
                { value: 'Cyberpunk', label: 'Cyberpunk' },
                { value: 'Minimalist', label: 'Minimalist' },
                { value: 'Documentary', label: 'Documentary' },
              ]}
              className="w-full"
            />

            <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="generateCaption"
                  checked={generateCaption}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGenerateCaption(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <label htmlFor="generateCaption" className="cursor-pointer text-sm font-semibold text-primary">
                    {t('quick_create.gen_caption_label')}
                  </label>
                  <p className="mt-1 text-xs text-slate-500">{t('quick_create.gen_caption_desc')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6">
              <Button variant="ghost" onClick={() => navigate('/videos')} className="w-full sm:w-auto border border-slate-200">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleGenerateVideo}
                disabled={generatingVideo || !canGenerateVideo}
                loading={generatingVideo}
                leftIcon={!generatingVideo ? <Video className="h-4 w-4" /> : undefined}
                className="w-full sm:w-auto shadow-lg shadow-brand-500/20"
              >
                {t('quick_create.generate_video_sora')}
              </Button>
            </div>
          </div>
            </>
          )}
        </Card>
      </div>
    </Layout>
  )
}
