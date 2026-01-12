import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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


interface SocialAccount {
  id: string
  platform: string
  status: string
}

type Step = 'idea' | 'script' | 'generate' | 'complete'

const platformIcons: Record<string, any> = {
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

    let pollInterval: NodeJS.Timeout
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
              title: 'Video Ready!',
              message: `"${topic}" has finished generating and is ready to view.`,
              link: `/videos`,
            })
          }
        } else if (newStatus === 'failed') {
          setVideoError(video.error_message || 'Video generation failed')
          if (previousStatus !== 'failed') {
            addNotification({
              type: 'error',
              title: 'Video Generation Failed',
              message: `"${topic}" failed to generate: ${video.error_message || 'Unknown error'}`,
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
              title: 'Rate Limit Reached',
              message: 'Polling paused due to rate limit. Will resume automatically.',
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
    if (!topic) {
      setScriptError('Please fill in the topic')
      return
    }

    setGeneratingScript(true)
    setScriptError('')

    try {
      const response = await api.post('/api/content/quick-create/generate-script', {
        category: 'general', // Default category
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
      setVideoError('Please generate a script first')
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
        title: 'Video Generation Started!',
        message: `"${topic}" is now being generated. This typically takes 1-3 minutes. You'll be notified when it's ready!`,
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
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const canProceedToScript = topic.trim().length > 0
  const canProceedToVideo = generatedScript.trim().length > 0
  const connectedPlatforms = socialAccounts.filter(acc => acc.status === 'connected').map(acc => acc.platform)

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-4 sm:p-6 lg:p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">create video</p>
          <h1 className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-semibold text-primary">Create a new video</h1>
          <p className="mt-2 text-sm text-slate-500">
            Describe your idea, let AI write the script, then generate your video. Simple as that.
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between overflow-x-auto">
            <div className="flex items-center gap-2 sm:gap-4 min-w-max">
              <div className={`flex items-center gap-3 ${step === 'idea' ? 'text-brand-600' : ['script', 'generate', 'complete'].includes(step) ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${step === 'idea' ? 'border-brand-500 bg-brand-50' :
                  ['script', 'generate', 'complete'].includes(step) ? 'border-emerald-500 bg-emerald-50' :
                    'border-slate-300 bg-white'
                  }`}>
                  {['script', 'generate', 'complete'].includes(step) ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-semibold">1</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold">Idea</p>
                  <p className="text-xs text-slate-500">Describe your topic</p>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-slate-300" />

              <div className={`flex items-center gap-3 ${step === 'script' ? 'text-brand-600' : ['generate', 'complete'].includes(step) ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${step === 'script' ? 'border-brand-500 bg-brand-50' :
                  ['generate', 'complete'].includes(step) ? 'border-emerald-500 bg-emerald-50' :
                    'border-slate-300 bg-white'
                  }`}>
                  {['generate', 'complete'].includes(step) ? <CheckCircle2 className="h-5 w-5" /> : step === 'script' ? <Loader className="h-5 w-5 animate-spin" /> : <span className="text-sm font-semibold">2</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold">Script</p>
                  <p className="text-xs text-slate-500">AI writes for you</p>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-slate-300" />

              <div className={`flex items-center gap-3 ${step === 'generate' ? 'text-brand-600' : step === 'complete' ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${step === 'generate' ? 'border-brand-500 bg-brand-50' : step === 'complete' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'
                  }`}>
                  {step === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : step === 'generate' ? <Loader className="h-5 w-5 animate-spin" /> : <span className="text-sm font-semibold">3</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold">Generate</p>
                  <p className="text-xs text-slate-500">Create video</p>
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
              <h2 className="text-xl font-semibold text-primary">Step 1: Your Idea</h2>
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
                  {connectedPlatforms.map((platform) => {
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
                label="Topic"
                placeholder="e.g., 5 Trading Mistakes Beginners Make"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />

              <Textarea
                label="Description (optional)"
                placeholder="Add more context about your idea..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />


              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/videos')}
                  className="border border-white/60 text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateScript}
                  disabled={!canProceedToScript || generatingScript}
                  loading={generatingScript}
                  leftIcon={!generatingScript ? <Sparkles className="h-4 w-4" /> : undefined}
                >
                  Generate Script
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
              <h2 className="text-xl font-semibold text-primary">Step 2: AI-Generated Script</h2>
            </div>

            {scriptError && (
              <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                {scriptError}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-primary">Script Preview</label>
                  {canEditScript && (
                    <Badge variant="success">
                      Editable
                    </Badge>
                  )}
                </div>
                <Textarea
                  value={generatedScript}
                  onChange={(e) => setGeneratedScript(e.target.value)}
                  rows={12}
                  placeholder={generatingScript ? 'Generating your script...' : 'Your script will appear here'}
                  disabled={generatingScript || !canEditScript}
                  className="font-mono text-sm"
                />
              </div>

              <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4 text-sm text-blue-700">
                <p className="font-semibold">💡 Tip:</p>
                <p className="mt-1">Review and edit the script if needed. You can make changes before generating the video.</p>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep('idea')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleGenerateScript}
                    disabled={generatingScript}
                    loading={generatingScript}
                  >
                    Regenerate
                  </Button>
                  <Button
                    onClick={() => setStep('generate')}
                    disabled={!canProceedToVideo}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Continue to Video
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
              <h2 className="text-xl font-semibold text-primary">Step 3: Generate Video</h2>
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
                    <h3 className="text-sm font-semibold text-emerald-800">Video Generation Started!</h3>
                    <p className="mt-1 text-sm text-emerald-700">
                      Your video is now being generated. This typically takes 1-3 minutes depending on the duration.
                    </p>
                    <p className="mt-2 text-xs text-emerald-600">
                      We'll automatically move to the next step when your video is ready!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {videoStatus === 'pending' || videoStatus === 'generating' ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-6">
                  <h3 className="mb-4 text-sm font-semibold text-primary">Script Preview</h3>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{generatedScript}</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Select
                    label="Video Style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
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
                      onChange={(e) => setGenerateCaption(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="generateCaption"
                        className="text-sm font-semibold text-primary cursor-pointer"
                      >
                        Generate Social Media Caption
                      </label>
                      <p className="mt-1 text-xs text-slate-500">
                        Automatically generate an engaging caption for your video when it's ready
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setStep('script')}
                    leftIcon={<ArrowLeft className="h-4 w-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleGenerateVideo}
                    disabled={generatingVideo}
                    loading={generatingVideo}
                    leftIcon={!generatingVideo ? <Video className="h-4 w-4" /> : undefined}
                    className="min-w-[160px]"
                  >
                    {generatingVideo ? 'Generating...' : 'Generate Video'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Loader className="h-12 w-12 animate-spin text-brand-500 mx-auto mb-4" />
                <p className="text-sm text-slate-600">Generating your video... This may take a few moments.</p>
              </div>
            )}
          </Card>
        )}

        {/* Step 4: Post-Generation */}
        {step === 'complete' && videoUrl && (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Left: Video Preview */}
            <Card className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Video className="h-5 w-5 text-brand-500" />
                <h2 className="text-xl font-semibold text-primary">Your Video</h2>
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
                Download Video
              </Button>
            </Card>

            {/* Right: Description and Social */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary">Social Media Description</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateDescription}
                    loading={generatingDescription}
                    disabled={generatingDescription}
                  >
                    Generate
                  </Button>
                </div>
                <Textarea
                  value={socialDescription}
                  onChange={(e) => setSocialDescription(e.target.value)}
                  placeholder="Write or generate a caption for your social media posts..."
                  rows={6}
                />
              </Card>

              <Card className="p-4 sm:p-6">
                <h3 className="mb-4 text-base sm:text-lg font-semibold text-primary">Post to Social Media</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {connectedPlatforms.map((platform) => {
                      const Icon = platformIcons[platform] || Share2
                      const isSelected = selectedPlatforms.includes(platform)
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition touch-manipulation min-h-[44px] ${isSelected
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
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
                      No connected accounts. <a href="/social" className="text-brand-600 hover:underline">Connect accounts</a> to post videos.
                    </p>
                  )}
                  <Button
                    onClick={handlePostToSocial}
                    disabled={selectedPlatforms.length === 0 || posting}
                    loading={posting}
                    leftIcon={<Share2 className="h-4 w-4" />}
                    className="w-full"
                  >
                    Post to Selected Platforms
                  </Button>
                </div>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/videos')}
                  className="flex-1"
                >
                  Go to Videos
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
                  Create Another
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
          title={postStatus === 'posting' ? 'Posting Video...' : postStatus === 'success' ? 'Video Posted!' : 'Error'}
          size="md"
        >
          <div className="py-6 text-center">
            {postStatus === 'posting' && (
              <div className="space-y-4">
                <Loader className="mx-auto h-12 w-12 animate-spin text-brand-500" />
                <p className="text-lg font-medium text-slate-900">Your video is being posted</p>
                <p className="text-sm text-slate-500">This may take a few moments...</p>
              </div>
            )}

            {postStatus === 'success' && (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-slate-900">Success!</p>
                  <p className="text-slate-500">Your video has been scheduled for posting to your selected platforms.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setIsPostModalOpen(false)}
                    className="flex-1"
                  >
                    Ok, stay here
                  </Button>
                  <Button
                    onClick={() => navigate('/posts')}
                    className="flex-1"
                  >
                    View all posts
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
                  <p className="text-xl font-semibold text-slate-900">Failed to post</p>
                  <p className="text-slate-500">There was an error scheduling your post. Please try again.</p>
                </div>
                <Button
                  onClick={() => setIsPostModalOpen(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
