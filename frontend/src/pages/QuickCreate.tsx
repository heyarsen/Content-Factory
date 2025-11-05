import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Video, Sparkles, FileText, CheckCircle2, ArrowRight, ArrowLeft, Loader, Download, Share2, Instagram, Youtube, Users, Facebook } from 'lucide-react'
import api from '../lib/api'

interface Category {
  id: string
  category_key: string
  name: string
  status: 'active' | 'inactive'
}

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
  const [step, setStep] = useState<Step>('idea')
  
  // Step 1: Idea
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [whyImportant, setWhyImportant] = useState('')
  const [usefulTips, setUsefulTips] = useState('')
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  
  // Step 2: Script
  const [generatedScript, setGeneratedScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptError, setScriptError] = useState('')
  const [canEditScript, setCanEditScript] = useState(false)
  
  // Step 3: Generate Video
  const [style, setStyle] = useState<'casual' | 'professional' | 'energetic' | 'educational'>('professional')
  const [duration, setDuration] = useState(30)
  const [avatars, setAvatars] = useState<Array<{ id: string; heygen_avatar_id: string; avatar_name: string; thumbnail_url: string | null; preview_url: string | null; is_default: boolean }>>([])
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  
  // Step 4: Post-Generation
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<'pending' | 'generating' | 'completed' | 'failed'>('pending')
  const [socialDescription, setSocialDescription] = useState('')
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    loadCategories()
    loadSocialAccounts()
    loadAvatars()
  }, [])

  const loadAvatars = async () => {
    try {
      const response = await api.get('/api/avatars')
      setAvatars(response.data.avatars || [])
      // Set default avatar if available
      const defaultAvatar = response.data.avatars?.find((a: any) => a.is_default)
      if (defaultAvatar) {
        setSelectedAvatarId(defaultAvatar.heygen_avatar_id)
      } else if (response.data.avatars?.length > 0) {
        setSelectedAvatarId(response.data.avatars[0].heygen_avatar_id)
      }
    } catch (error: any) {
      console.error('Failed to load avatars:', error)
    }
  }

  // Poll for video status when video is generating
  useEffect(() => {
    if (!videoId || videoStatus === 'completed' || videoStatus === 'failed') return

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/api/videos/${videoId}/status`)
        const video = response.data.video
        setVideoStatus(video.status)
        if (video.status === 'completed' && video.video_url) {
          setVideoUrl(video.video_url)
          setStep('complete')
        } else if (video.status === 'failed') {
          setVideoError(video.error_message || 'Video generation failed')
        }
      } catch (error) {
        console.error('Failed to poll video status:', error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [videoId, videoStatus])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/content')
      const activeCategories = (response.data.categories || []).filter(
        (c: Category) => c.status === 'active'
      )
      setCategories(activeCategories)
      if (activeCategories.length > 0) {
        setSelectedCategory(activeCategories[0].category_key)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  const loadSocialAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      setSocialAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load social accounts:', error)
    }
  }

  const handleGenerateScript = async () => {
    if (!topic || !selectedCategory) {
      setScriptError('Please fill in the topic and select a category')
      return
    }

    setGeneratingScript(true)
    setScriptError('')

    try {
      const response = await api.post('/api/content/quick-create/generate-script', {
        category: selectedCategory,
        topic,
        description: description || undefined,
        whyImportant: whyImportant || undefined,
        usefulTips: usefulTips || undefined,
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
      const response = await api.post('/api/videos/generate', {
        topic,
        script: generatedScript,
        style,
        duration,
        category: selectedCategory,
        avatar_id: selectedAvatarId || undefined,
      })

      setVideoId(response.data.video.id)
      setVideoStatus(response.data.video.status)
      // If video is already completed (unlikely), go to complete step
      if (response.data.video.status === 'completed' && response.data.video.video_url) {
        setVideoUrl(response.data.video.video_url)
        setStep('complete')
      }
    } catch (error: any) {
      console.error('Video generation error:', error)
      
      // Extract detailed error message
      const errorMessage = 
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Failed to generate video. Please check your avatar configuration and try again.'
      
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

    setPosting(true)
    try {
      await api.post('/api/posts/schedule', {
        video_id: videoId,
        platforms: selectedPlatforms,
        caption: socialDescription || topic,
      })
      navigate('/posts')
    } catch (error: any) {
      console.error('Failed to post:', error)
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

  const canProceedToScript = topic.trim().length > 0 && selectedCategory.length > 0
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step === 'idea' ? 'border-brand-500 bg-brand-50' : 
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step === 'script' ? 'border-brand-500 bg-brand-50' : 
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step === 'generate' ? 'border-brand-500 bg-brand-50' : step === 'complete' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'
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
              <Select
                label="Category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={categories.map((cat) => ({ value: cat.category_key, label: cat.name }))}
                disabled={loadingCategories}
                required
              />

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

              <Textarea
                label="Why is this important? (optional)"
                placeholder="Why should viewers care about this topic?"
                rows={3}
                value={whyImportant}
                onChange={(e) => setWhyImportant(e.target.value)}
              />

              <Textarea
                label="Useful tips (optional)"
                placeholder="Any key points or tips to include?"
                rows={3}
                value={usefulTips}
                onChange={(e) => setUsefulTips(e.target.value)}
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
                    onChange={(e) => setStyle(e.target.value as any)}
                    options={[
                      { value: 'casual', label: 'Casual' },
                      { value: 'professional', label: 'Professional' },
                      { value: 'energetic', label: 'Energetic' },
                      { value: 'educational', label: 'Educational' },
                    ]}
                  />

                  <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-primary">Duration</label>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{duration} seconds</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="60"
                      step="5"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="mt-4 w-full accent-brand-500"
                    />
                    <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wide text-slate-400">
                      <span>15s</span>
                      <span>60s</span>
                    </div>
                  </div>
                </div>

                {/* Avatar Selection */}
                {avatars.length > 0 && (
                  <div className="rounded-2xl border border-white/60 bg-white/70 p-6">
                    <label className="block text-sm font-semibold text-primary mb-4">
                      Choose Avatar
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {avatars.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatarId(avatar.heygen_avatar_id)}
                          className={`relative rounded-xl border-2 p-2 transition-all ${
                            selectedAvatarId === avatar.heygen_avatar_id
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-slate-200 hover:border-brand-300'
                          }`}
                        >
                          {avatar.thumbnail_url || avatar.preview_url ? (
                            <img
                              src={avatar.thumbnail_url || avatar.preview_url || ''}
                              alt={avatar.avatar_name}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-24 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center">
                              <Users className="h-8 w-8 text-white opacity-50" />
                            </div>
                          )}
                          <p className="mt-2 text-xs font-medium text-slate-700 truncate">
                            {avatar.avatar_name}
                          </p>
                          {selectedAvatarId === avatar.heygen_avatar_id && (
                            <div className="absolute top-2 right-2 bg-brand-500 text-white rounded-full p-1">
                              <CheckCircle2 className="h-3 w-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
              <div className="aspect-video rounded-xl bg-slate-900 overflow-hidden mb-4">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
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
                          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition touch-manipulation min-h-[44px] ${
                            isSelected
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
      </div>
    </Layout>
  )
}
