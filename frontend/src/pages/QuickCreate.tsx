import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Video, Sparkles, FileText, CheckCircle2, ArrowRight, ArrowLeft, Loader } from 'lucide-react'
import api from '../lib/api'

interface Category {
  id: string
  category_key: string
  name: string
  status: 'active' | 'inactive'
}

type Step = 'idea' | 'script' | 'generate'

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
  
  // Step 2: Script
  const [generatedScript, setGeneratedScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptError, setScriptError] = useState('')
  const [canEditScript, setCanEditScript] = useState(false)
  
  // Step 3: Generate Video
  const [style, setStyle] = useState<'casual' | 'professional' | 'energetic' | 'educational'>('professional')
  const [duration, setDuration] = useState(30)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoError, setVideoError] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

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
      await api.post('/api/videos/generate', {
        topic,
        script: generatedScript,
        style,
        duration,
        category: selectedCategory,
      })

      navigate('/videos')
    } catch (error: any) {
      setVideoError(error.response?.data?.error || 'Failed to generate video')
    } finally {
      setGeneratingVideo(false)
    }
  }

  const canProceedToScript = topic.trim().length > 0 && selectedCategory.length > 0
  const canProceedToVideo = generatedScript.trim().length > 0

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">quick create</p>
          <h1 className="mt-3 text-3xl font-semibold text-primary">Create video in 3 steps</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Describe your idea, let AI write the script, then generate your video. Simple as that.
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-3 ${step === 'idea' ? 'text-brand-600' : step === 'script' || step === 'generate' ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step === 'idea' ? 'border-brand-500 bg-brand-50' : 
                  step === 'script' || step === 'generate' ? 'border-emerald-500 bg-emerald-50' : 
                  'border-slate-300 bg-white'
                }`}>
                  {step === 'script' || step === 'generate' ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-semibold">1</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold">Idea</p>
                  <p className="text-xs text-slate-500">Describe your topic</p>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-slate-300" />

              <div className={`flex items-center gap-3 ${step === 'script' ? 'text-brand-600' : step === 'generate' ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step === 'script' ? 'border-brand-500 bg-brand-50' : 
                  step === 'generate' ? 'border-emerald-500 bg-emerald-50' : 
                  'border-slate-300 bg-white'
                }`}>
                  {step === 'generate' ? <CheckCircle2 className="h-5 w-5" /> : step === 'script' ? <Loader className="h-5 w-5 animate-spin" /> : <span className="text-sm font-semibold">2</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold">Script</p>
                  <p className="text-xs text-slate-500">AI writes for you</p>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-slate-300" />

              <div className={`flex items-center gap-3 ${step === 'generate' ? 'text-brand-600' : 'text-slate-400'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step === 'generate' ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white'
                }`}>
                  <span className="text-sm font-semibold">3</span>
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
          <Card className="p-8">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-semibold text-primary">Step 1: Your Idea</h2>
            </div>

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
          <Card className="p-8">
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
          <Card className="p-8">
            <div className="mb-6 flex items-center gap-3">
              <Video className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-semibold text-primary">Step 3: Generate Video</h2>
            </div>

            {videoError && (
              <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                {videoError}
              </div>
            )}

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
          </Card>
        )}
      </div>
    </Layout>
  )
}
