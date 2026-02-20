import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import api from '../../lib/api'
import { normalizeTimezone, timezones } from '../../lib/timezones'
import { useLanguage } from '../../contexts/LanguageContext'

interface SocialAccount {
  id: string
  platform: string
  status: string
}

interface UploadAndPlanModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_DURATION_SECONDS = 180

export function UploadAndPlanModal({ isOpen, onClose, onSuccess }: UploadAndPlanModalProps) {
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState(1)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [caption, setCaption] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scheduleChoice, setScheduleChoice] = useState<'now' | 'later'>('now')
  const [scheduledDateTime, setScheduledDateTime] = useState('')
  const [timezone, setTimezone] = useState(
    () => normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
  )
  const [submitting, setSubmitting] = useState(false)

  const connectedAccounts = useMemo(
    () => socialAccounts.filter((account) => account.status === 'connected'),
    [socialAccounts],
  )

  useEffect(() => {
    if (!isOpen) return

    const loadSocialAccounts = async () => {
      setLoadingAccounts(true)
      try {
        const response = await api.get('/api/social/accounts')
        const accounts = response.data.accounts || []
        setSocialAccounts(accounts)
        setSelectedPlatforms(
          accounts
            .filter((account: SocialAccount) => account.status === 'connected')
            .map((account: SocialAccount) => account.platform),
        )
      } catch (error) {
        console.error('Failed to load social accounts', error)
      } finally {
        setLoadingAccounts(false)
      }
    }

    loadSocialAccounts()
  }, [isOpen])

  const resetState = () => {
    setStep(1)
    setSelectedFile(null)
    setDuration(null)
    setUploadProgress(0)
    setUploadedVideoId(null)
    setUploading(false)
    setUploadError(null)
    setValidationError(null)
    setCaption('')
    setDescription('')
    setScheduleChoice('now')
    setScheduledDateTime('')
    setSubmitting(false)
  }

  const handleClose = () => {
    if (uploading || submitting) return
    resetState()
    onClose()
  }

  const validateVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      throw new Error(t('video_planning.upload_plan.validation_invalid_type'))
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(
        t('video_planning.upload_plan.validation_file_too_large', {
          size: `${Math.round(MAX_VIDEO_SIZE_BYTES / 1024 / 1024)}`,
        }),
      )
    }

    const fileDuration = await new Promise<number>((resolve, reject) => {
      const videoElement = document.createElement('video')
      const objectUrl = URL.createObjectURL(file)
      videoElement.preload = 'metadata'
      videoElement.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(videoElement.duration)
      }
      videoElement.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error(t('video_planning.upload_plan.validation_duration_read_failed')))
      }
      videoElement.src = objectUrl
    })

    if (fileDuration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error(
        t('video_planning.upload_plan.validation_duration_too_long', {
          duration: `${MAX_VIDEO_DURATION_SECONDS}`,
        }),
      )
    }

    setDuration(Math.round(fileDuration))
  }

  const setFileAndValidate = async (file: File) => {
    setValidationError(null)
    setUploadError(null)
    setUploadProgress(0)
    setUploadedVideoId(null)

    try {
      await validateVideoFile(file)
      setSelectedFile(file)
    } catch (error: any) {
      setSelectedFile(null)
      setValidationError(error.message || t('video_planning.upload_plan.validation_generic'))
    }
  }

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await setFileAndValidate(file)
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await setFileAndValidate(file)
  }

  const uploadVideo = async () => {
    if (!selectedFile) {
      setValidationError(t('video_planning.upload_plan.validation_missing_file'))
      return
    }

    setUploading(true)
    setUploadError(null)
    setValidationError(null)

    try {
      const fileDataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          if (typeof result !== 'string') {
            reject(new Error(t('video_planning.upload_plan.upload_failed')))
            return
          }
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = () => reject(new Error(t('video_planning.upload_plan.upload_failed')))
        reader.readAsDataURL(selectedFile)
      })

      const response = await api.post(
        '/api/videos/upload',
        {
          file_name: selectedFile.name,
          mime_type: selectedFile.type,
          file_data_base64: fileDataBase64,
          duration,
          topic: description || selectedFile.name.replace(/\.[^.]+$/, ''),
        },
        {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
          },
        },
      )

      setUploadedVideoId(response.data.video?.id || null)
      setStep(2)
    } catch (error: any) {
      setUploadError(error.response?.data?.error || t('video_planning.upload_plan.upload_failed'))
    } finally {
      setUploading(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((item) => item !== platform)
        : [...prev, platform],
    )
  }

  const goToPublishStep = () => {
    if (selectedPlatforms.length === 0) {
      setValidationError(t('video_planning.upload_plan.validation_missing_platform'))
      return
    }

    setValidationError(null)
    setStep(3)
  }

  const handleSubmit = async () => {
    if (!uploadedVideoId) {
      setValidationError(t('video_planning.upload_plan.validation_missing_file'))
      setStep(1)
      return
    }

    if (selectedPlatforms.length === 0) {
      setValidationError(t('video_planning.upload_plan.validation_missing_platform'))
      setStep(2)
      return
    }

    let scheduledTime: string | undefined

    if (scheduleChoice === 'later') {
      if (!scheduledDateTime) {
        setValidationError(t('video_planning.upload_plan.validation_missing_schedule_time'))
        return
      }

      const localDate = new Date(scheduledDateTime)
      if (Number.isNaN(localDate.getTime())) {
        setValidationError(t('video_planning.upload_plan.validation_missing_schedule_time'))
        return
      }

      if (localDate <= new Date()) {
        setValidationError(t('video_planning.upload_plan.validation_schedule_future'))
        return
      }

      scheduledTime = localDate.toISOString()
    }

    setSubmitting(true)
    setValidationError(null)

    try {
      await api.post('/api/posts/schedule', {
        video_id: uploadedVideoId,
        platforms: selectedPlatforms,
        caption: caption || description,
        scheduled_time: scheduledTime,
        timezone,
      })

      window.dispatchEvent(new CustomEvent('content-factory:post-created'))
      onSuccess()
      handleClose()
    } catch (error: any) {
      setValidationError(error.response?.data?.error || t('video_planning.upload_plan.submit_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const currentStepTitle = [
    t('video_planning.upload_plan.step_upload'),
    t('video_planning.upload_plan.step_details'),
    t('video_planning.upload_plan.step_publish'),
  ][step - 1]

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('video_planning.upload_plan.modal_title')}
      size="xl"
    >
      <div className="space-y-5">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          {t('video_planning.upload_plan.step_label', { step, total: 3 })}: {currentStepTitle}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div
              className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">{t('video_planning.upload_plan.dropzone')}</p>
              <Button className="mt-4" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {t('video_planning.upload_plan.pick_file')}
              </Button>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
              {selectedFile && (
                <p className="mt-3 text-xs text-slate-500">
                  {selectedFile.name} • {Math.round(selectedFile.size / 1024 / 1024)}MB • {duration || 0}s
                </p>
              )}
            </div>

            {uploading && (
              <div>
                <div className="h-2 rounded bg-slate-200">
                  <div className="h-full rounded bg-brand-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{t('video_planning.upload_plan.upload_progress', { progress: uploadProgress })}</p>
              </div>
            )}

            {uploadedVideoId && (
              <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {t('video_planning.upload_plan.upload_success')}
              </p>
            )}

            {uploadError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <p>{uploadError}</p>
                <Button className="mt-3" variant="secondary" onClick={uploadVideo}>
                  {t('video_planning.upload_plan.retry_upload')}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Textarea
              label={t('video_planning.upload_plan.description_label')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('video_planning.upload_plan.description_placeholder')}
              rows={4}
            />
            <Textarea
              label={t('video_planning.upload_plan.caption_label')}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder={t('video_planning.upload_plan.caption_placeholder')}
              rows={3}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{t('video_planning.upload_plan.platform_label')}</p>
              {loadingAccounts ? (
                <p className="text-sm text-slate-500">{t('video_planning.upload_plan.loading_accounts')}</p>
              ) : connectedAccounts.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <p>{t('video_planning.upload_plan.no_accounts')}</p>
                  <Link to="/social" className="mt-2 inline-flex text-sm font-semibold text-amber-900 underline">
                    {t('video_planning.upload_plan.connect_accounts')}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connectedAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => togglePlatform(account.platform)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        selectedPlatforms.includes(account.platform)
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {account.platform}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input
              label={t('video_planning.upload_plan.schedule_label')}
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(event) => setScheduledDateTime(event.target.value)}
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('video_planning.timezone_label')}</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {timezones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  checked={scheduleChoice === 'now'}
                  onChange={() => setScheduleChoice('now')}
                />
                <span>{t('video_planning.upload_plan.post_now')}</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  checked={scheduleChoice === 'later'}
                  onChange={() => setScheduleChoice('later')}
                />
                <span>{t('video_planning.upload_plan.schedule_later')}</span>
              </label>
            </div>

            {scheduleChoice === 'later' && (
              <Input
                label={t('video_planning.upload_plan.schedule_required_label')}
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(event) => setScheduledDateTime(event.target.value)}
              />
            )}
          </div>
        )}

        {(validationError || uploadError) && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{validationError || uploadError}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-4">
          <Button variant="ghost" onClick={handleClose}>
            {t('video_planning.cancel')}
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
                {t('video_planning.upload_plan.back')}
              </Button>
            )}
            {step === 1 && (
              <Button onClick={uploadVideo} loading={uploading} disabled={!selectedFile || uploading}>
                {t('video_planning.upload_plan.continue')}
              </Button>
            )}
            {step === 2 && (
              <Button onClick={goToPublishStep} disabled={connectedAccounts.length === 0}>
                {t('video_planning.upload_plan.continue')}
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSubmit} loading={submitting}>
                {t('video_planning.upload_plan.submit')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
