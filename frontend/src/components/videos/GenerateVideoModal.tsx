import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Modal } from '../ui/Modal'
import { Video } from 'lucide-react'
import { createVideo } from '../../lib/videos'
import { countWords, getMaxCharsForDuration, getMaxWordsForDuration } from '../../lib/scriptLimits'
import { useNotifications } from '../../contexts/NotificationContext'
import { useLanguage } from '../../contexts/LanguageContext'

interface GenerateVideoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function GenerateVideoModal({ isOpen, onClose, onSuccess }: GenerateVideoModalProps) {
  const { addNotification } = useNotifications()
  const { t } = useLanguage()
  const [topic, setTopic] = useState('')
  const [script, setScript] = useState('')
  const [style, setStyle] = useState<'casual' | 'professional' | 'energetic' | 'educational'>('professional')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const maxWords = getMaxWordsForDuration(duration)
  const maxChars = getMaxCharsForDuration(duration)
  const scriptWordCount = countWords(script)

  useEffect(() => {
    if (!script) {
      return
    }
    if (maxWords && countWords(script) > maxWords) {
      const trimmed = script.trim().split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ')
      setScript(trimmed)
    }
  }, [duration, maxWords, script])

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
        title: t('generate_video.generation_started_title'),
        message: t('generate_video.generation_started_message', { topic }),
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
      setError(err.response?.data?.error || t('generate_video.generation_failed'))
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
    <Modal isOpen={isOpen} onClose={handleClose} title={t('generate_video.modal_title')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-sm text-slate-500">
          {t('generate_video.modal_desc')}
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
                <h3 className="text-sm font-semibold text-emerald-800">{t('generate_video.generation_started_title')}</h3>
                <p className="mt-1 text-sm text-emerald-700">
                  {t('generate_video.generation_started_desc')}
                </p>
                <p className="mt-2 text-xs text-emerald-600">
                  {t('generate_video.generation_started_hint')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Input
            label={t('generate_video.topic_label')}
            placeholder={t('generate_video.topic_placeholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
          <Select
            label={t('generate_video.style_label')}
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
          label={t('generate_video.script_optional')}
          placeholder={t('generate_video.script_placeholder')}
          rows={8}
          value={script}
          onChange={(e) => {
            const nextValue = e.target.value
            if (maxWords) {
              const words = nextValue.trim().split(/\s+/).filter(Boolean)
              if (words.length > maxWords) {
                setScript(words.slice(0, maxWords).join(' '))
                return
              }
            }
            setScript(nextValue)
          }}
          maxLength={maxChars || undefined}
        />
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{t('generate_video.script_helper')}</span>
          <span>{t('generate_video.words_counter', { used: scriptWordCount, total: maxWords })}</span>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-primary">{t('generate_video.duration_label')}</label>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('generate_video.duration_seconds', { duration })}</span>
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
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="sm:w-auto" loading={loading}>
            <Video className="mr-2 h-4 w-4" />
            {t('generate_video.generate_button')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
