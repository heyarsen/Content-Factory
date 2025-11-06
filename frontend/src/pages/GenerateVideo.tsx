import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Video } from 'lucide-react'
import { createVideo } from '../lib/videos'

export function GenerateVideo() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [script, setScript] = useState('')
  const [style, setStyle] = useState<'casual' | 'professional' | 'energetic' | 'educational'>('professional')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      await createVideo({
        topic,
        script: script || undefined,
        style,
        duration,
      })
      
      setSuccess(true)
      
      // Navigate after showing success message
      setTimeout(() => {
        navigate('/videos')
      }, 3000) // Show success message for 3 seconds
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate video')
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">create</p>
          <h1 className="mt-3 text-3xl font-semibold text-primary">Generate a new video</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Guide the AI with a topic, optional script, and tone. We will orchestrate the visuals, audio, and timing for
            you.
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-7">
            {error && (
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-6 py-5">
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
                      Redirecting to your video library to track progress...
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <Input
                label="Video topic"
                placeholder="e.g., Product launch announcement"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />
              <Select
                label="Style"
                options={[
                  { value: 'casual', label: 'Casual' },
                  { value: 'professional', label: 'Professional' },
                  { value: 'energetic', label: 'Energetic' },
                  { value: 'educational', label: 'Educational' },
                ]}
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
              />
            </div>

            <Textarea
              label="Script (optional)"
              placeholder="Add a detailed script or talking points if you have them - otherwise we'll generate it."
              rows={8}
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />

            <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-primary">Duration</label>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{duration} seconds</span>
              </div>
              <input
                type="range"
                min="15"
                max="180"
                step="15"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-4 w-full accent-brand-500"
              />
              <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wide text-slate-400">
                <span>15s</span>
                <span>180s</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/videos')}
                className="w-full border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:flex-1" loading={loading}>
                <Video className="mr-2 h-4 w-4" />
                Generate video
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  )
}

