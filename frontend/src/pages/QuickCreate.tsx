import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Sparkles, Video, Share2, Instagram, Youtube, Users, Facebook, AlertTriangle, ChevronDown } from 'lucide-react'
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

const defaultChannelOptions = ['instagram', 'youtube', 'tiktok', 'facebook', 'x']

const strategyTemplates: Record<string, Record<string, { goals: string; audience: string; offer: string; concept: string; tone: string; cta: string; draftContent: string; description: string }>> = {
  awareness: {
    instagram: {
      goals: 'Increase top-of-funnel reach and brand recall from short-form videos',
      audience: 'Mobile-first creators and operators discovering new tools',
      offer: 'A free playbook with repeatable social growth workflows',
      concept: 'Problem-solution mini stories with strong visual hooks',
      tone: 'playful',
      cta: 'Follow for weekly strategy breakdowns and save this post.',
      draftContent: 'Most brands do not need more content—they need clearer positioning in the first 3 seconds.',
      description: 'Create a punchy awareness reel with a bold hook, simple narrative, and save-worthy takeaway.',
    },
    linkedin: {
      goals: 'Expand qualified visibility with decision-makers in-feed',
      audience: 'Marketing leads and founders in growth-stage B2B teams',
      offer: 'A practical social strategy framework for pipeline growth',
      concept: 'Insight-led posts translating market shifts into action',
      tone: 'professional',
      cta: 'Comment FRAMEWORK and we will send the one-page checklist.',
      draftContent: 'Awareness on LinkedIn improves when your insight challenges a common assumption and offers a clear next step.',
      description: 'Publish an educational awareness post with an opinionated insight and a practical takeaway.',
    },
    x: {
      goals: 'Boost share-of-voice and conversation participation',
      audience: 'Operators following fast-moving strategy discussions',
      offer: 'A concise thread template for content that compounds',
      concept: 'Contrarian takes paired with proof and tactical follow-through',
      tone: 'bold',
      cta: 'Reply GROWTH and I will send the thread template.',
      draftContent: 'Attention is won with specificity: one clear claim, one proof point, one action readers can take today.',
      description: 'Create a high-reach awareness concept designed for reposts and quote conversations.',
    },
  },
  engagement: {
    instagram: {
      goals: 'Increase comments, shares, and saves on educational content',
      audience: 'Creators and marketers who want practical execution ideas',
      offer: 'A swipe file of high-performing engagement hooks',
      concept: 'Interactive prompt-based content with social proof examples',
      tone: 'conversational',
      cta: 'Drop your niche below and I will share a custom hook idea.',
      draftContent: 'If your audience is passive, switch from broadcasting tips to prompting opinions and experiences.',
      description: 'Build an engagement-focused post that asks a sharp question and invites participation.',
    },
    linkedin: {
      goals: 'Drive meaningful comments from ICP-aligned professionals',
      audience: 'Revenue and content leaders balancing brand and demand',
      offer: 'A benchmarking checklist for engagement quality',
      concept: 'Discussion-starting posts anchored in real scenarios',
      tone: 'professional',
      cta: 'Share your biggest blocker in the comments for tailored advice.',
      draftContent: 'Great engagement is not volume—it is relevance. Ask questions that only your ideal customer can answer deeply.',
      description: 'Publish a conversation-driven post that invites expert perspectives and practical debate.',
    },
    x: {
      goals: 'Increase replies and repost velocity per post',
      audience: 'Growth-focused operators active in niche communities',
      offer: 'A lightweight engagement sprint playbook',
      concept: 'Hot takes reframed into useful tactical threads',
      tone: 'bold',
      cta: 'Quote this with your take and I will respond with 1 improvement.',
      draftContent: 'Engagement compounds when you publish strong viewpoints and stay active in follow-up conversation threads.',
      description: 'Create an engagement concept optimized for replies and quote posts.',
    },
  },
  leads: {
    instagram: {
      goals: 'Generate qualified inbound DMs and profile visits',
      audience: 'Small teams evaluating strategic marketing support',
      offer: 'A free audit worksheet for social content conversion',
      concept: 'Pain-point carousel leading to a low-friction lead magnet',
      tone: 'conversational',
      cta: 'DM AUDIT and I will send the worksheet.',
      draftContent: 'When content attracts attention but not leads, the missing piece is a clear bridge from insight to next action.',
      description: 'Create a lead-gen post that identifies pain, promises a fast win, and drives DMs.',
    },
    linkedin: {
      goals: 'Increase demo-qualified conversations from organic social',
      audience: 'Founders and demand gen leads at B2B SaaS companies',
      offer: 'A 30-minute strategy diagnostic for pipeline bottlenecks',
      concept: 'Case-study snippets tied to measurable outcomes',
      tone: 'professional',
      cta: 'Comment DIAGNOSE to get the scoring rubric.',
      draftContent: 'Lead generation improves when your post names a specific pain, quantifies impact, and offers a clear next step.',
      description: 'Publish a lead-focused post with social proof and a direct invitation to take action.',
    },
    x: {
      goals: 'Convert audience engagement into email signups and DMs',
      audience: 'Builders seeking repeatable growth systems',
      offer: 'A plug-and-play lead capture template',
      concept: 'Mini teardown thread with actionable checklist CTA',
      tone: 'bold',
      cta: 'Reply TEMPLATE and I will send the exact framework.',
      draftContent: 'The fastest path to leads on X is pairing practical insights with a CTA that feels like the next logical step.',
      description: 'Create a lead-generation thread concept with a clear problem-solution narrative and CTA.',
    },
  },
  sales: {
    instagram: {
      goals: 'Increase conversion intent and product click-throughs',
      audience: 'Warm followers close to making a purchase decision',
      offer: 'A limited-time implementation package with clear outcomes',
      concept: 'Outcome-driven product demo with objection handling',
      tone: 'bold',
      cta: 'Tap the link in bio to claim this week\'s onboarding bonus.',
      draftContent: 'Sales content works best when it demonstrates proof, urgency, and a frictionless path to buy.',
      description: 'Create a conversion-focused post featuring outcomes, urgency, and a direct purchase CTA.',
    },
    linkedin: {
      goals: 'Drive high-intent calls from decision-makers',
      audience: 'Revenue leaders with active budget and urgent growth goals',
      offer: 'A strategy sprint with measurable execution milestones',
      concept: 'ROI-focused narrative with customer result snapshots',
      tone: 'professional',
      cta: 'Book a call to map your next 30 days of content execution.',
      draftContent: 'Sales posts convert when they reduce risk: show context, process, outcome, and exact next step.',
      description: 'Publish a sales-oriented concept that highlights business outcomes and removes buyer objections.',
    },
    x: {
      goals: 'Increase high-intent traffic to the offer page',
      audience: 'Operators actively comparing growth solutions',
      offer: 'A focused execution package for measurable outcomes',
      concept: 'Proof-led thread with urgency and clear purchase path',
      tone: 'bold',
      cta: 'DM READY for pricing and implementation details.',
      draftContent: 'To sell on X without sounding salesy, teach first, prove results, then make the offer the obvious next move.',
      description: 'Create a sales concept that combines proof, urgency, and clear direct-response CTA.',
    },
  },
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
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [publishOption, setPublishOption] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
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
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  const hasSubscription = !!(user?.role === 'admin' || (subscription && ['active', 'pending'].includes(subscription.status)))
  const canGenerateVideo = hasSubscription || unlimited || (credits !== null && credits > 0)
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

  useEffect(() => {
    const objectiveTemplates = strategyTemplates[campaignObjective] || {}
    const template = objectiveTemplates[strategyPlatform] || objectiveTemplates.linkedin || objectiveTemplates.instagram

    if (!template) {
      return
    }

    if (!touchedFields.description) setDescription(template.description)
    if (!touchedFields.goals) setGoals(template.goals)
    if (!touchedFields.audience) setAudience(template.audience)
    if (!touchedFields.offer) setOffer(template.offer)
    if (!touchedFields.concept) setConcept(template.concept)
    if (!touchedFields.ctaText) setCtaText(template.cta)
    if (!touchedFields.tone) setTone(template.tone)
    if (!touchedFields.draftContent) setDraftContent(template.draftContent)
  }, [campaignObjective, strategyPlatform, touchedFields])

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

    if (!ctaText.trim()) {
      setFormError('Call to action is required.')
      return
    }

    if (!selectedChannels.length) {
      setFormError('Select at least one channel to continue.')
      return
    }

    if (publishOption === 'schedule' && !scheduledAt) {
      setFormError('Please choose a schedule date and time.')
      return
    }

    setGeneratingVideo(true)
    setFormError('')

    try {
      const verticalDimension = { ...DEFAULT_VERTICAL_DIMENSION }
      await api.post('/api/videos/generate', {
        topic,
        description: description ? `[Objective: ${campaignObjective}] ${description}\n[CTA] ${ctaText}` : `Objective: ${campaignObjective}. CTA: ${ctaText}`,
        style,
        duration,
        provider: 'sora',
        campaign_objective: campaignObjective,
        channels: selectedChannels,
        publish_option: publishOption,
        scheduled_at: publishOption === 'schedule' ? scheduledAt : null,
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

  const suggestions = useMemo(() => objectiveTemplateSuggestions[campaignObjective] || [], [campaignObjective])

  const applyTemplateSuggestion = (suggestion: string) => {
    setTouchedFields((prev) => ({ ...prev, description: true }))
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

              <Select
                label="Publish option"
                value={publishOption}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPublishOption(e.target.value as 'now' | 'schedule')}
                options={[
                  { value: 'now', label: 'Publish now' },
                  { value: 'schedule', label: 'Schedule for later' },
                ]}
              />
            </div>

            {publishOption === 'schedule' && (
              <Input
                type="datetime-local"
                label="Scheduled publish time"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            )}

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
              label="Call to action"
              value={ctaText}
              onChange={(e) => {
                setTouchedFields((prev) => ({ ...prev, ctaText: true }))
                setCtaText(e.target.value)
              }}
              required
            />

            <details className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-brand-700">Advanced strategy</p>
                  <p className="text-xs text-slate-500">Fine-tune inputs for richer creative direction and guidance.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info">Optional</Badge>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </div>
              </summary>

              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">AI suggestions</p>
                  <p className="mt-1 text-xs text-slate-500">Templates auto-fill from objective + platform. Tap a suggestion to swap direction quickly.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
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

                {strategyError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{strategyError}</p>}

                <Textarea
                  label={t('quick_create.desc_label')}
                  placeholder={t('quick_create.desc_placeholder')}
                  rows={3}
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setTouchedFields((prev) => ({ ...prev, description: true }))
                    setDescription(e.target.value)
                  }}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="Primary platform"
                    value={strategyPlatform}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStrategyPlatform(e.target.value)}
                    options={[
                      { value: 'x', label: 'X' },
                      { value: 'linkedin', label: 'LinkedIn' },
                      { value: 'instagram', label: 'Instagram' },
                    ]}
                  />
                  <Select
                    label="Tone option"
                    value={tone}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setTouchedFields((prev) => ({ ...prev, tone: true }))
                      setTone(e.target.value)
                    }}
                    options={[
                      { value: 'professional', label: 'Professional' },
                      { value: 'conversational', label: 'Conversational' },
                      { value: 'bold', label: 'Bold' },
                      { value: 'playful', label: 'Playful' },
                    ]}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Goals" value={goals} onChange={(e) => { setTouchedFields((prev) => ({ ...prev, goals: true })); setGoals(e.target.value) }} />
                  <Input label="Audience" value={audience} onChange={(e) => { setTouchedFields((prev) => ({ ...prev, audience: true })); setAudience(e.target.value) }} />
                  <Input label="Offer" value={offer} onChange={(e) => { setTouchedFields((prev) => ({ ...prev, offer: true })); setOffer(e.target.value) }} />
                  <Input label="Core concept" value={concept} onChange={(e) => { setTouchedFields((prev) => ({ ...prev, concept: true })); setConcept(e.target.value) }} />
                </div>

                <Textarea
                  label="Draft post for pre-publish checks"
                  rows={3}
                  value={draftContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setTouchedFields((prev) => ({ ...prev, draftContent: true }))
                    setDraftContent(e.target.value)
                  }}
                />

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

                <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Long strategy guide</p>
                    <Badge variant="info">AI Strategy Assistant</Badge>
                  </div>
                  <Button type="button" onClick={handleGenerateGuide} loading={generatingGuide} disabled={generatingGuide}>
                    Generate strategic guidance
                  </Button>

                  {strategyGuide && (
                    <div className="space-y-4 rounded-2xl border border-white bg-white/80 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Campaign brief</p>
                        <p className="mt-1 text-sm text-slate-600">{strategyGuide.campaignBrief.summary}</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                          <li><strong>Objective:</strong> {strategyGuide.campaignBrief.objective}</li>
                          <li><strong>Audience insight:</strong> {strategyGuide.campaignBrief.audienceInsight}</li>
                          <li><strong>Offer angle:</strong> {strategyGuide.campaignBrief.offerAngle}</li>
                        </ul>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Content pillars</p>
                          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                            {strategyGuide.contentPillars.map((pillar) => <li key={pillar}>{pillar}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Monthly plan</p>
                          <ul className="mt-2 space-y-1 text-xs text-slate-600">
                            {strategyGuide.monthlyPlan.map((item) => <li key={item.week}><strong>{item.week}:</strong> {item.focus} · {item.contentType}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-800">Cross-platform repurposing</p>
                        <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                          <div className="rounded-lg border p-2"><strong>X:</strong> {strategyGuide.repurposing.x}</div>
                          <div className="rounded-lg border p-2"><strong>LinkedIn:</strong> {strategyGuide.repurposing.linkedin}</div>
                          <div className="rounded-lg border p-2"><strong>Instagram:</strong> {strategyGuide.repurposing.instagram}</div>
                        </div>
                      </div>

                      <div className="grid gap-4 text-xs text-slate-600 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-sm font-semibold text-slate-800">Hashtags & keywords</p>
                          <p><strong>Hashtags:</strong> {strategyGuide.discovery.hashtags.join(', ')}</p>
                          <p className="mt-1"><strong>Keywords:</strong> {strategyGuide.discovery.keywords.join(', ')}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-sm font-semibold text-slate-800">Pre-publish quality checks</p>
                          <p><strong>Hook:</strong> {strategyGuide.qualityChecks.hookStrength.score}/10 - {strategyGuide.qualityChecks.hookStrength.reason}</p>
                          <p><strong>CTA:</strong> {strategyGuide.qualityChecks.ctaClarity.score}/10 - {strategyGuide.qualityChecks.ctaClarity.reason}</p>
                          <p><strong>Length fit:</strong> {strategyGuide.qualityChecks.lengthFit.score}/10 - {strategyGuide.qualityChecks.lengthFit.reason}</p>
                          <p className="mt-1"><strong>Policy:</strong> {strategyGuide.qualityChecks.policyRisks.join(' ')}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-800">Post-publish recommendations</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                          {strategyGuide.postPublishRecommendations.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </details>

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
