import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Modal } from '../ui/Modal'
import { Video } from 'lucide-react'
import { createVideo } from '../../lib/videos'
import { useNotifications } from '../../contexts/NotificationContext'

interface GenerateVideoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function GenerateVideoModal({ isOpen, onClose, onSuccess }: GenerateVideoModalProps) {
  const { addNotification } = useNotifications()
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
      
      // Show success immediately
      setSuccess(true)
      addNotification({
        type: 'info',
        title: 'Video Generation Started!',
        message: `"${topic}" is now being generated. This typically takes 1-3 minutes. You'll be notified when it's ready!`,
      })
      
      // Reset form after showing success
      setTimeout(() => {
        setTopic('')
        setScript('')
        setStyle('professional')
        setDuration(60)
        setError('')
        setSuccess(false)
        onSuccess()
        onClose()
      }, 3000) // Show success message for 3 seconds
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate video')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setTopic('')
      setScript('')
      setStyle('professional')
      setDuration(60)
      setError('')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generate a new video" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-sm text-slate-500">
          Guide the AI with a topic, optional script, and tone. We will orchestrate the visuals, audio, and timing for you.
        </p>

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
                  Your video is now being generated. This typically takes 3-7 minutes depending on the duration.
                </p>
                <p className="mt-2 text-xs text-emerald-600">
                  You can track the progress in your video library. We'll notify you when it's ready!
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
            min="5"
            max="300"
            step="5"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-4 w-full accent-brand-500"
          />
          <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wide text-slate-400">
            <span>5s</span>
            <span>300s</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white sm:w-auto"
          >
            Cancel
          </Button>
          <Button type="submit" className="sm:w-auto" loading={loading}>
            <Video className="mr-2 h-4 w-4" />
            Generate video
          </Button>
        </div>
      </form>
    </Modal>
  )
}

