import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Video, Sparkles, FileText, CheckCircle2, ArrowRight, ArrowLeft, Loader, Download, Share2, Instagram, Youtube, Users, Facebook } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import api from '../lib/api'
import { DEFAULT_VERTICAL_ASPECT_RATIO, DEFAULT_VERTICAL_DIMENSION } from '../lib/videos'
import { useNotifications } from '../contexts/NotificationContext'
import { useLanguage } from '../contexts/LanguageContext'


interface SocialAccount {
  id: string
  platform: string
  status: string
}

type Step = 'idea' | 'script' | 'generate' | 'complete'

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

export function QuickCreate() {
  const navigate = useNavigate()
  const { addNotification } = useNotifications()
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>('idea')

  // Step 1: Idea
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])

  // Step 2: Script
  const [generatedScript, setGeneratedScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptError, setScriptError] = useState('')
  const [canEditScript, setCanEditScript] = useState(false)

  // Step 3: Generate Video
  const [style, setStyle] = useState('Cinematic')
  const [duration] = useState(15) // Fixed duration for Sora
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)

  // Step 4: Post-Generation
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<'pending' | 'generating' | 'completed' | 'failed'>('pending')
  const previousStatusRef = useRef<'pending' | 'generating' | 'completed' | 'failed'>('pending')
  const [socialDescription, setSocialDescription] = useState('')
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posting' | 'success' | 'error'>('idle')
  const [generateCaption, setGenerateCaption] = useState(true)


  useEffect(() => {
    loadSocialAccounts()
  }, [])




  // Poll for video status when video is generating
  useEffect(() => {
    if (!videoId) return
    if (videoStatus === 'completed' || videoStatus === 'failed') return

    let pollInterval: any
    let pollDelay = 3000 // Start with 3 seconds
    let consecutiveErrors = 0

    const pollStatus = async () => {
      try {
        const response = await api.get(`/api/videos/${videoId}/status`)
        const video = response.data.video
        const previousStatus = previousStatusRef.current
        const newStatus = video.status as 'pending' | 'generating' | 'completed' | 'failed'

        // Reset error tracking on success
        consecutiveErrors = 0
        pollDelay = 3000 // Reset to normal polling interval

        // Update ref before setting state
        previousStatusRef.current = newStatus
        setVideoStatus(newStatus)

        if (newStatus === 'completed' && video.video_url) {
          setVideoUrl(video.video_url)
          setStep('complete')

          // Show notification when video completes
          if (previousStatus !== 'completed') {
            addNotification({
              type: 'success',
              title: t('videos.video_ready_title'),
              message: `"${topic}" ${t('videos.video_ready_message')}`,
              link: `/videos`,
            })
          }
        } else if (newStatus === 'failed') {
          setVideoError(video.error_message || t('videos.status_failed'))
          if (previousStatus !== 'failed') {
            addNotification({
              type: 'error',
              title: t('videos.status_failed'),
              message: `"${topic}" ${t('videos.status_failed')}: ${video.error_message || 'Unknown error'}`,
            })
          }
        } else {
          // Continue polling with current delay
          pollInterval = setTimeout(pollStatus, pollDelay)
        }
      } catch (error: any) {
        consecutiveErrors++
        const is429 = error.response?.status === 429

        if (is429) {
          // Exponential backoff for rate limits: 30s, 60s, 120s, max 300s
          pollDelay = Math.min(30000 * Math.pow(2, consecutiveErrors - 1), 300000)

          console.warn(`Rate limited (429). Waiting ${pollDelay / 1000}s before next poll.`)

          // Show notification only once
          if (consecutiveErrors === 1) {
            addNotification({
              type: 'warning',
              title: t('videos.rate_limit_title'),
              message: t('videos.rate_limit_message'),
            })
          }
        } else {
          // For other errors, use shorter backoff
          pollDelay = Math.min(5000 * consecutiveErrors, 60000)
          console.error('Failed to poll video status:', error)
        }

        // Continue polling with backoff
        pollInterval = setTimeout(pollStatus, pollDelay)
      }
    }

    // Start polling
    pollInterval = setTimeout(pollStatus, pollDelay)

    return () => {
      if (pollInterval) clearTimeout(pollInterval)
    }
  }, [videoId, videoStatus, topic, addNotification])


  const loadSocialAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      const accounts = response.data.accounts || []
      setSocialAccounts(accounts)

      // Auto-select connected platforms by default
      const connected = accounts
        .filter((acc: SocialAccount) => acc.status === 'connected')
        .map((acc: SocialAccount) => acc.platform)
      setSelectedPlatforms(connected)
    } catch (error) {
      console.error('Failed to load social accounts:', error)
    }
  }

  const handleGenerateScript = async () => {
    if (!topic.trim()) {
      setScriptError(t('quick_create.topic_required'))
      return
    }

    setGeneratingScript(true)
    setScriptError('')

    try {
      // Smart category detection based on user input
      let category = 'general'
      const topicLower = topic.toLowerCase()
      const descLower = description.toLowerCase()
      
      // Check for educational content
      if (topicLower.includes('tutorial') || topicLower.includes('how to') || topicLower.includes('learn') || 
          topicLower.includes('tips') || topicLower.includes('guide') || descLower.includes('teach') ||
          descLower.includes('explain') || descLower.includes('step by step')) {
        category = 'educational'
      }
      // Check for storytelling/personal content
      else if (topicLower.includes('story') || topicLower.includes('my') || topicLower.includes('experience') ||
               topicLower.includes('journey') || descLower.includes('personal') || descLower.includes('my story')) {
        category = 'storytelling'
      }
      // Check for listicle/content
      else if (topicLower.includes('top') || topicLower.includes('best') || topicLower.includes('list') ||
               topicLower.includes('number') || /\d+/.test(topic) || descLower.includes('number')) {
        category = 'listicle'
      }
      // Check for review/comparison
      else if (topicLower.includes('review') || topicLower.includes('vs') || topicLower.includes('compare') ||
               topicLower.includes('test') || descLower.includes('comparison')) {
        category = 'review'
      }

      const response = await api.post('/api/content/quick-create/generate-script', {
        category,
        topic,
        description: description || undefined,
      })

      setGeneratedScript(response.data.script)
      setCanEditScript(true)
      setStep('script')
    } catch (error: any) {
      setScriptError(error.response?.data?.error || 'Failed to generate script')
    } finally {
      setGeneratingScript(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!generatedScript) {
      setVideoError(t('quick_create.script_preview'))
      return
    }

    setGeneratingVideo(true)
    setVideoError('')

    try {
      console.log('Sending video generation request to:', '/api/videos/generate')
      const verticalDimension = { ...DEFAULT_VERTICAL_DIMENSION }

      console.log('Request payload:', {
        topic,
        hasScript: !!generatedScript,
        scriptLength: generatedScript?.length,
        style,
        duration,
        provider: 'sora',
      })

      const response = await api.post('/api/videos/generate', {
        topic,
        script: generatedScript,
        style,
        duration,
        provider: 'sora', // Always use Sora via KIE
        generate_caption: generateCaption,
        aspect_ratio: DEFAULT_VERTICAL_ASPECT_RATIO,
        dimension: verticalDimension,
      })

      console.log('Video generation response:', response.data)
      setVideoId(response.data.video.id)
      const initialStatus = response.data.video.status as 'pending' | 'generating' | 'completed' | 'failed'
      previousStatusRef.current = initialStatus
      setVideoStatus(initialStatus)

      // Show success message immediately
      setVideoError('')
      addNotification({
        type: 'info',
        title: t('quick_create.gen_start_title'),
        message: t('quick_create.gen_start_desc'),
      })

      // If video is already completed (unlikely), go to complete step
      if (response.data.video.status === 'completed' && response.data.video.video_url) {
        setVideoUrl(response.data.video.video_url)
        setStep('complete')
      } else {
        // Show success message and keep on generate step to show status
        // The polling will automatically move to complete step when done
      }
    } catch (error: any) {
      console.error('Video generation error - Full error:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        },
      })

      // Extract detailed error message
      let errorMessage = 'Failed to generate video'

      if (error.response?.status === 404) {
        errorMessage = error.response?.data?.error ||
          'Video generation endpoint not found (404). Please check if the feature is available.'
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }

      setVideoError(errorMessage)
    } finally {
      setGeneratingVideo(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!videoId) return

    setGeneratingDescription(true)
    try {
      const response = await api.post(`/api/videos/${videoId}/generate-description`, {
        topic,
        script: generatedScript,
      })
      setSocialDescription(response.data.description)
    } catch (error: any) {
      console.error('Failed to generate description:', error)
    } finally {
      setGeneratingDescription(false)
    }
  }

  const handleDownload = () => {
    if (!videoUrl) return
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = `${topic.replace(/\s+/g, '-')}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePostToSocial = async () => {
    if (!videoId || selectedPlatforms.length === 0) return

    setIsPostModalOpen(true)
    setPostStatus('posting')
    setPosting(true)
    try {
      await api.post('/api/posts/schedule', {
        video_id: videoId,
        platforms: selectedPlatforms,
        caption: socialDescription || topic,
      })
      setPostStatus('success')
    } catch (error: any) {
      console.error('Failed to post:', error)
      setPostStatus('error')
    } finally {
      setPosting(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev: string[]) =>
      prev.includes(platform)
        ? prev.filter((p: string) => p !== platform)
        : [...prev, platform]
    )
  }

  const canProceedToScript = topic.trim().length > 0
  const canProceedToVideo = generatedScript.trim().length > 0
  const connectedPlatforms = socialAccounts.filter((acc: SocialAccount) => acc.status === 'connected').map((acc: SocialAccount) => acc.platform)

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-5 sm:p-6 lg:p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('common.create')}</p>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{t('quick_create.title')}</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {t('quick_create.desc')}
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-3 sm:gap-6 min-w-max">
              <div className={`flex items-center gap-2 sm:gap-3 ${step === 'idea' ? 'text-brand-600' : ['script', 'generate', 'complete'].includes(step) ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all ${step === 'idea' ? 'border-brand-500 bg-brand-50 shadow-sm' :
                  ['script', 'generate', 'complete'].includes(step) ? 'border-emerald-500 bg-emerald-50' :
                    'border-slate-300 bg-white'
                  }`}>
                  {['script', 'generate', 'complete'].includes(step) ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-bold">1</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold leading-tight">{t('quick_create.step_idea')}</p>
                  <p className="hidden xs:block text-[10px] text-slate-500">{t('quick_create.step_idea_desc')}</p>
                </div>
              </div>

              <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />

              <div className={`flex items-center gap-2 sm:gap-3 ${step === 'script' ? 'text-brand-600' : ['generate', 'complete'].includes(step) ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all ${step === 'script' ? 'border-brand-500 bg-brand-50 shadow-sm' :
                  ['generate', 'complete'].includes(step) ? 'border-emerald-500 bg-emerald-50' :
                    'border-slate-300 bg-white'
                  }`}>
                  {['generate', 'complete'].includes(step) ? <CheckCircle2 className="h-5 w-5" /> : step === 'script' ? <Loader className="h-5 w-5 animate-spin" /> : <span className="text-sm font-bold">2</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold leading-tight">{t('quick_create.step_script')}</p>
                  <p className="hidden xs:block text-[10px] text-slate-500">{t('quick_create.step_script_desc')}</p>
                </div>
              </div>

              <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />

              <div className={`flex items-center gap-2 sm:gap-3 ${step === 'generate' ? 'text-brand-600' : step === 'complete' ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all ${step === 'generate' ? 'border-brand-500 bg-brand-50 shadow-sm' : step === 'complete' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'
                  }`}>
                  {step === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : step === 'generate' ? <Loader className="h-5 w-5 animate-spin" /> : <span className="text-sm font-bold">3</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold leading-tight">{t('quick_create.step_generate')}</p>
                  <p className="hidden xs:block text-[10px] text-slate-500">{t('quick_create.step_generate_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Step 1: Idea */}
        {step === 'idea' && (
          <Card className="p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-semibold text-primary">{t('quick_create.step_idea_title')}</h2>
            </div>

            {scriptError && (
              <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                {scriptError}
              </div>
            )}

            {connectedPlatforms.length > 0 && (
              <div className="mb-6 rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
                <p className="mb-2 text-sm font-semibold text-blue-700">Connected Social Media</p>
                <div className="flex flex-wrap gap-2">
                  {connectedPlatforms.map((platform: string) => {
                    const Icon = platformIcons[platform] || Share2
                    return (
                      <div
                        key={platform}
                        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5"
                      >
                        <Icon className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">
                          {platformNames[platform] || platform}
                        </span>
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

              {/* Prompt Guidance Section */}
              <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-900">💡 Pro Tip: Write Specific, Engaging Prompts</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-amber-800">❌ Generic (gets boring results):</p>
                    <div className="rounded-lg bg-white/50 p-3 font-mono text-xs text-slate-600">
                      "Make a video about marketing"
                    </div>
                  </div>
                  
                  <div>
                    <p className="mb-2 text-sm font-medium text-green-700">✅ Specific (gets engaging results):</p>
                    <div className="rounded-lg bg-green-50/50 p-3 font-mono text-xs text-green-800">
                      "Create a 15-second TikTok video showing 3 productivity hacks for remote workers who struggle with focus. Include a surprising statistic about attention spans."
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/50 bg-white/30 p-3">
                      <p className="mb-1 text-xs font-semibold text-amber-900">🎯 Target Audience</p>
                      <p className="text-xs text-amber-700">"for busy moms", "college students", "small business owners"</p>
                    </div>
                    <div className="rounded-lg border border-white/50 bg-white/30 p-3">
                      <p className="mb-1 text-xs font-semibold text-amber-900">🔥 Hook/Problem</p>
                      <p className="text-xs text-amber-700">"struggling with...", "tired of...", "secret to..."</p>
                    </div>
                    <div className="rounded-lg border border-white/50 bg-white/30 p-3">
                      <p className="mb-1 text-xs font-semibold text-amber-900">📊 Specific Format</p>
                      <p className="text-xs text-amber-700">"3 tips", "step-by-step", "myth vs fact"</p>
                    </div>
                    <div className="rounded-lg border border-white/50 bg-white/30 p-3">
                      <p className="mb-1 text-xs font-semibold text-amber-900">🎨 Style/Tone</p>
                      <p className="text-xs text-amber-700">"funny", "inspiring", "educational", "shocking"</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-100/50 p-3">
                    <p className="mb-2 text-xs font-semibold text-amber-900">🚀 Quick Templates:</p>
                    <div className="space-y-1 text-xs text-amber-800">
                      <p>• "Show [NUMBER] [TOPIC] tips for [AUDIENCE] who struggle with [PROBLEM]"</p>
                      <p>• "Myth vs fact: [COMMON MISCONCEPTION] about [TOPIC]"</p>
                      <p>• "Day in the life of [PERSONA] - [SURPRISING ELEMENT]"</p>
                      <p>• "Stop doing [BAD HABIT]. Try this [BETTER ALTERNATIVE] instead"</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-blue-50/50 border border-blue-200/50 p-3">
                    <p className="mb-1 text-xs font-semibold text-blue-900">📚 Advanced: Video Prompts Library</p>
                    <p className="text-xs text-blue-700">
                      Want more structured templates? Visit our 
                      <Link to="/video-prompts" className="font-medium text-blue-600 underline hover:text-blue-800"> Video Prompts Library</Link> 
                      for research-backed templates and scripts.
                    </p>
                  </div>
                </div>
              </div>

              <Textarea
                label={t('quick_create.desc_label')}
                placeholder="Add specific details: target audience, desired tone, key points to include, or any specific format you want (e.g., 'make it funny', 'include a shocking statistic', 'focus on beginners')"
                rows={4}
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              />


              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/videos')}
                  className="w-full sm:w-auto border border-slate-200"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleGenerateScript}
                  disabled={!canProceedToScript || generatingScript}
                  loading={generatingScript}
                  leftIcon={!generatingScript ? <Sparkles className="h-4 w-4" /> : undefined}
                  className="w-full sm:w-auto shadow-lg shadow-brand-500/20"
                >
                  {t('quick_create.generate_script')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Script */}
        {step === 'script' && (
          <Card className="p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex items-center gap-3">
              <FileText className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-semibold text-primary">{t('quick_create.step_script_title')}</h2>
            </div>

            {scriptError && (
              <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                {scriptError}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-primary">{t('quick_create.script_preview')}</label>
                  {canEditScript && (
                    <Badge variant="success">
                      {t('quick_create.editable')}
                    </Badge>
                  )}
                </div>
                <Textarea
                  value={generatedScript}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGeneratedScript(e.target.value)}
                  rows={12}
                  placeholder={generatingScript ? t('quick_create.generating_script') : t('quick_create.script_empty')}
                  disabled={generatingScript || !canEditScript}
                  className="font-mono text-sm"
                />
              </div>

              <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4 text-sm text-blue-700">
                <p className="font-semibold">{t('quick_create.tip_title')}</p>
                <p className="mt-1">{t('quick_create.tip_desc')}</p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6">
                <Button
                  variant="ghost"
                  onClick={() => setStep('idea')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                  className="w-full sm:w-auto border border-slate-200"
                >
                  {t('common.back')}
                </Button>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleGenerateScript}
                    disabled={generatingScript}
                    loading={generatingScript}
                    className="w-full sm:w-auto border border-slate-200"
                  >
                    {t('quick_create.regenerate')}
                  </Button>
                  <Button
                    onClick={() => setStep('generate')}
                    disabled={!canProceedToVideo}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                    className="w-full sm:w-auto shadow-lg shadow-brand-500/20"
                  >
                    {t('quick_create.continue_to_video')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Generate Video */}
        {step === 'generate' && (
          <Card className="p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Video className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-semibold text-primary">{t('quick_create.step_generate_title')}</h2>
            </div>

            {videoError && (
              <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                {videoError}
              </div>
            )}

            {videoId && (videoStatus === 'pending' || videoStatus === 'generating') && !videoError && (
              <div className="mb-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-emerald-800">{t('quick_create.gen_start_title')}</h3>
                    <p className="mt-1 text-sm text-emerald-700">
                      {t('quick_create.gen_start_desc')}
                    </p>
                    <p className="mt-2 text-xs text-emerald-600">
                      {t('quick_create.gen_start_sub')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {videoStatus === 'pending' || videoStatus === 'generating' || videoStatus === 'failed' ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-6">
                  <h3 className="mb-4 text-sm font-semibold text-primary">{t('quick_create.script_preview')}</h3>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{generatedScript}</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
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
                </div>

                {/* Caption Generation Toggle */}
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
                      <label
                        htmlFor="generateCaption"
                        className="text-sm font-semibold text-primary cursor-pointer"
                      >
                        {t('quick_create.gen_caption_label')}
                      </label>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('quick_create.gen_caption_desc')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6">
                  <Button
                    variant="ghost"
                    onClick={() => setStep('script')}
                    leftIcon={<ArrowLeft className="h-4 w-4" />}
                    className="w-full sm:w-auto border border-slate-200"
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    onClick={handleGenerateVideo}
                    disabled={generatingVideo}
                    loading={generatingVideo}
                    leftIcon={!generatingVideo ? <Video className="h-4 w-4" /> : undefined}
                    className="w-full sm:w-auto min-w-[160px] shadow-lg shadow-brand-500/20"
                  >
                    {generatingVideo ? t('quick_create.generating_btn') : t('quick_create.step_generate')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Loader className="h-12 w-12 animate-spin text-brand-500 mx-auto mb-4" />
                <p className="text-sm text-slate-600">Processing...</p>
              </div>
            )}
          </Card>
        )}

        {/* Step 4: Post-Generation */}
        {step === 'complete' && videoUrl && (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Left: Video Preview */}
            <Card className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Video className="h-5 w-5 text-brand-500" />
                <h2 className="text-xl font-semibold text-primary">{t('quick_create.your_video')}</h2>
              </div>
              <div
                className="rounded-xl bg-slate-900 overflow-hidden mb-4"
                style={{ aspectRatio: '9 / 16' }}
              >
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleDownload}
                leftIcon={<Download className="h-4 w-4" />}
                className="w-full"
              >
                {t('videos.download')}
              </Button>
            </Card>

            {/* Right: Description and Social */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary">{t('quick_create.social_desc_title')}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateDescription}
                    loading={generatingDescription}
                    disabled={generatingDescription}
                  >
                    {t('quick_create.regenerate')}
                  </Button>
                </div>
                <Textarea
                  value={socialDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSocialDescription(e.target.value)}
                  placeholder={t('videos.prompt_placeholder')}
                  rows={6}
                />
              </Card>

              <Card className="p-4 sm:p-6">
                <h3 className="mb-4 text-base sm:text-lg font-semibold text-primary">{t('quick_create.post_social_title')}</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2.5 sm:gap-3">
                    {connectedPlatforms.map((platform) => {
                      const Icon = platformIcons[platform] || Share2
                      const isSelected = selectedPlatforms.includes(platform)
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all touch-manipulation min-h-[44px] active:scale-95 ${isSelected
                            ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/10'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                        >
                          <Icon className="h-4 w-4" />
                          {platformNames[platform] || platform}
                          {isSelected && <span className="ml-1">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                  {connectedPlatforms.length === 0 && (
                    <p className="text-sm text-slate-500">
                      {t('videos.no_accounts_found')} <a href="/social" className="text-brand-600 hover:underline">{t('quick_create.connect_accounts')}</a> {t('quick_create.no_accounts_desc')}
                    </p>
                  )}
                  <Button
                    onClick={handlePostToSocial}
                    disabled={selectedPlatforms.length === 0 || posting}
                    loading={posting}
                    leftIcon={<Share2 className="h-4 w-4" />}
                    className="w-full"
                  >
                    {t('quick_create.post_selected')}
                  </Button>
                </div>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/videos')}
                  className="flex-1"
                >
                  {t('quick_create.go_to_videos')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep('idea')
                    setVideoId(null)
                    setVideoUrl(null)
                    setVideoStatus('pending')
                    setSocialDescription('')
                    setSelectedPlatforms([])
                  }}
                  className="flex-1"
                >
                  {t('quick_create.create_another')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Modal
          isOpen={isPostModalOpen}
          onClose={() => {
            if (postStatus !== 'posting') {
              setIsPostModalOpen(false)
            }
          }}
          title={postStatus === 'posting' ? t('quick_create.posting_title') : postStatus === 'success' ? t('quick_create.posted_title') : 'Error'}
          size="md"
        >
          <div className="py-6 text-center">
            {postStatus === 'posting' && (
              <div className="space-y-4">
                <Loader className="mx-auto h-12 w-12 animate-spin text-brand-500" />
                <p className="text-lg font-medium text-slate-900">{t('quick_create.posting_status')}</p>
                <p className="text-sm text-slate-500">{t('quick_create.posting_wait')}</p>
              </div>
            )}

            {postStatus === 'success' && (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-slate-900">{t('quick_create.success_title')}</p>
                  <p className="text-slate-500">{t('quick_create.success_desc')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setIsPostModalOpen(false)}
                    className="flex-1"
                  >
                    {t('quick_create.ok_stay')}
                  </Button>
                  <Button
                    onClick={() => navigate('/posts')}
                    className="flex-1"
                  >
                    {t('quick_create.view_posts')}
                  </Button>
                </div>
              </div>
            )}

            {postStatus === 'error' && (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                  <span className="text-4xl text-rose-600">!</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-slate-900">{t('quick_create.post_fail_title')}</p>
                  <p className="text-slate-500">{t('quick_create.post_fail_desc')}</p>
                </div>
                <Button
                  onClick={() => setIsPostModalOpen(false)}
                  className="w-full"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
