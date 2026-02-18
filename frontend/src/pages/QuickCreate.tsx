import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Sparkles, Video, Share2, Instagram, Youtube, Users, Facebook, AlertTriangle } from 'lucide-react'
import api from '../lib/api'
import { DEFAULT_VERTICAL_ASPECT_RATIO, DEFAULT_VERTICAL_DIMENSION } from '../lib/videos'
import { useNotifications } from '../contexts/NotificationContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { useAuth } from '../contexts/AuthContext'

interface SocialAccount {
  id: string
  platform: string
  status: string
}

interface StrategyGuide {
  campaignBrief: {
    summary: string
    objective: string
    audienceInsight: string
    offerAngle: string
    keyMessage: string
  }
  contentPillars: string[]
  monthlyPlan: Array<{ week: string; focus: string; contentType: string; cta: string }>
  repurposing: { x: string; linkedin: string; instagram: string }
  discovery: { hashtags: string[]; keywords: string[]; toneNotes: Record<string, string> }
  qualityChecks: {
    hookStrength: { score: number; reason: string }
    ctaClarity: { score: number; reason: string }
    lengthFit: { score: number; reason: string; recommendedRange: string }
    policyRisks: string[]
  }
  postPublishRecommendations: string[]
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

const objectiveTemplateSuggestions: Record<string, string[]> = {
  awareness: [
    'Introduce the campaign story arc and core message.',
    'Show a quick before/after transformation with a branded hook.',
    'Publish an educational explainer designed for reach and shares.',
  ],
  engagement: [
    'Ask a bold question to spark comments and replies.',
    'Create a trend response with a clear community angle.',
    'Share a behind-the-scenes clip that invites audience opinions.',
  ],
  leads: [
    'Break down a common pain point and tease the full solution in bio.',
    'Publish a checklist-style post with an offer to download a resource.',
    'Create a social proof story that drives profile clicks and DMs.',
  ],
  sales: [
    'Feature the product in action with a time-limited call to action.',
    'Address top purchase objections and close with a direct offer.',
    'Show customer outcomes and include a clear buying path.',
  ],
}

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
  const [duration] = useState(15)
  const [generateCaption, setGenerateCaption] = useState(true)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [formError, setFormError] = useState('')
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])

  const [goals, setGoals] = useState('Increase qualified inbound leads from social content')
  const [audience, setAudience] = useState('Founders and growth marketers at B2B SaaS companies')
  const [offer, setOffer] = useState('A done-with-you content strategy sprint')
  const [concept, setConcept] = useState('One strategic concept transformed into platform-native content')
  const [draftContent, setDraftContent] = useState('If your content calendar is full but revenue impact is flat, you need fewer topics and sharper positioning.')
  const [ctaText, setCtaText] = useState('Comment PLAN and I will send the framework.')
  const [strategyPlatform, setStrategyPlatform] = useState('linkedin')
  const [tone, setTone] = useState('professional')
  const [engagement, setEngagement] = useState({ impressions: '2500', likes: '85', comments: '11', shares: '9', saves: '14', clicks: '22' })
  const [generatingGuide, setGeneratingGuide] = useState(false)
  const [strategyError, setStrategyError] = useState('')
  const [strategyGuide, setStrategyGuide] = useState<StrategyGuide | null>(null)

  const hasSubscription = !!(user?.role === 'admin' || (subscription && ['active', 'pending'].includes(subscription.status)))
  const canGenerateVideo = hasSubscription || unlimited || (credits !== null && credits > 0)

  useEffect(() => {
    loadSocialAccounts()
  }, [])

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

    setGeneratingVideo(true)
    setFormError('')

    try {
      const verticalDimension = { ...DEFAULT_VERTICAL_DIMENSION }
      await api.post('/api/videos/generate', {
        topic,
        description: description ? `[Objective: ${campaignObjective}] ${description}` : `Objective: ${campaignObjective}`,
        style,
        duration,
        provider: 'sora',
        campaign_objective: campaignObjective,
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

  const handleGenerateGuide = async () => {
    if (!goals.trim() || !audience.trim() || !offer.trim()) {
      setStrategyError('Goals, audience, and offer are required to generate strategic guidance.')
      return
    }

    setGeneratingGuide(true)
    setStrategyError('')

    try {
      const response = await api.post('/api/strategy-assistant/guide', {
        goals,
        audience,
        offer,
        concept,
        draftContent,
        callToAction: ctaText,
        platform: strategyPlatform,
        tone,
        targetMonth: new Date().toISOString().slice(0, 7),
        engagement,
      })
      setStrategyGuide(response.data.guide)
    } catch (error: any) {
      console.error('Failed to generate strategy guide:', error)
      setStrategyError(error.response?.data?.error || 'Unable to generate strategic guidance right now.')
    } finally {
      setGeneratingGuide(false)
    }
  }

  const connectedPlatforms = socialAccounts
    .filter((acc: SocialAccount) => acc.status === 'connected')
    .map((acc: SocialAccount) => acc.platform)

  const suggestions = useMemo(() => objectiveTemplateSuggestions[campaignObjective] || [], [campaignObjective])

  const applyTemplateSuggestion = (suggestion: string) => {
    setDescription(suggestion)
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-5 sm:p-6 lg:p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('common.create')}</p>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{t('quick_create.title')}</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{t('quick_create.desc')}</p>
        </div>

        {!canGenerateVideo && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('common.trial_credits_ended_message')}</span>
          </div>
        )}

        {formError && <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{formError}</div>}

        <Card className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand-500" />
            <h2 className="text-xl font-semibold text-primary">{t('common.manual_creation')}</h2>
          </div>

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
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Campaign objective"
                value={campaignObjective}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCampaignObjective(e.target.value)}
                options={campaignObjectiveOptions}
              />
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">AI suggestions</p>
                <p className="mt-1 text-xs text-slate-500">Template prompts adapt to your selected objective.</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Suggested campaign angles</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => applyTemplateSuggestion(suggestion)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <Input label={t('quick_create.topic_label')} placeholder={t('quick_create.topic_placeholder')} value={topic} onChange={(e) => setTopic(e.target.value)} required />

            <Textarea
              label={t('quick_create.desc_label')}
              placeholder={t('quick_create.desc_placeholder')}
              rows={4}
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

            <div className="rounded-2xl border border-white/60 bg-white/70 p-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="generateCaption"
                  checked={generateCaption}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGenerateCaption(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <label htmlFor="generateCaption" className="text-sm font-semibold text-primary cursor-pointer">
                    {t('quick_create.gen_caption_label')}
                  </label>
                  <p className="mt-1 text-xs text-slate-500">{t('quick_create.gen_caption_desc')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">AI Strategy Assistant</p>
                  <p className="text-sm text-slate-600">Generate strategic guidance and operational assistance for planning, publishing, and optimization.</p>
                </div>
                <Badge variant="info">New</Badge>
              </div>

              {strategyError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{strategyError}</p>}

              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Goals" value={goals} onChange={(e) => setGoals(e.target.value)} />
                <Input label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)} />
                <Input label="Offer" value={offer} onChange={(e) => setOffer(e.target.value)} />
                <Input label="Core concept" value={concept} onChange={(e) => setConcept(e.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Primary platform" value={strategyPlatform} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStrategyPlatform(e.target.value)} options={[{ value: 'x', label: 'X' }, { value: 'linkedin', label: 'LinkedIn' }, { value: 'instagram', label: 'Instagram' }]} />
                <Select label="Tone option" value={tone} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTone(e.target.value)} options={[{ value: 'professional', label: 'Professional' }, { value: 'conversational', label: 'Conversational' }, { value: 'bold', label: 'Bold' }, { value: 'playful', label: 'Playful' }]} />
              </div>

              <Textarea label="Draft post for pre-publish checks" rows={3} value={draftContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraftContent(e.target.value)} />
              <Input label="Call to action" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {Object.entries(engagement).map(([key, value]) => (
                  <Input
                    key={key}
                    label={key}
                    type="number"
                    value={value}
                    onChange={(e) => setEngagement((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                ))}
              </div>

              <Button type="button" onClick={handleGenerateGuide} loading={generatingGuide} disabled={generatingGuide}>
                Generate strategic guidance
              </Button>

              {strategyGuide && (
                <div className="space-y-4 rounded-2xl border border-white bg-white/80 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Campaign brief</p>
                    <p className="text-sm text-slate-600 mt-1">{strategyGuide.campaignBrief.summary}</p>
                    <ul className="mt-2 text-xs text-slate-600 list-disc list-inside space-y-1">
                      <li><strong>Objective:</strong> {strategyGuide.campaignBrief.objective}</li>
                      <li><strong>Audience insight:</strong> {strategyGuide.campaignBrief.audienceInsight}</li>
                      <li><strong>Offer angle:</strong> {strategyGuide.campaignBrief.offerAngle}</li>
                    </ul>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Content pillars</p>
                      <ul className="mt-2 text-xs text-slate-600 list-disc list-inside space-y-1">
                        {strategyGuide.contentPillars.map((pillar) => <li key={pillar}>{pillar}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Monthly plan</p>
                      <ul className="mt-2 text-xs text-slate-600 space-y-1">
                        {strategyGuide.monthlyPlan.map((item) => <li key={item.week}><strong>{item.week}:</strong> {item.focus} · {item.contentType}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-800">Cross-platform repurposing</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-slate-600">
                      <div className="rounded-lg border p-2"><strong>X:</strong> {strategyGuide.repurposing.x}</div>
                      <div className="rounded-lg border p-2"><strong>LinkedIn:</strong> {strategyGuide.repurposing.linkedin}</div>
                      <div className="rounded-lg border p-2"><strong>Instagram:</strong> {strategyGuide.repurposing.instagram}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 text-xs text-slate-600">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">Hashtags & keywords</p>
                      <p><strong>Hashtags:</strong> {strategyGuide.discovery.hashtags.join(', ')}</p>
                      <p className="mt-1"><strong>Keywords:</strong> {strategyGuide.discovery.keywords.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">Pre-publish quality checks</p>
                      <p><strong>Hook:</strong> {strategyGuide.qualityChecks.hookStrength.score}/10 - {strategyGuide.qualityChecks.hookStrength.reason}</p>
                      <p><strong>CTA:</strong> {strategyGuide.qualityChecks.ctaClarity.score}/10 - {strategyGuide.qualityChecks.ctaClarity.reason}</p>
                      <p><strong>Length fit:</strong> {strategyGuide.qualityChecks.lengthFit.score}/10 - {strategyGuide.qualityChecks.lengthFit.reason}</p>
                      <p className="mt-1"><strong>Policy:</strong> {strategyGuide.qualityChecks.policyRisks.join(' ')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-800">Post-publish recommendations</p>
                    <ul className="mt-2 text-xs text-slate-600 list-disc list-inside space-y-1">
                      {strategyGuide.postPublishRecommendations.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              )}
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
        </Card>
      </div>
    </Layout>
  )
}
