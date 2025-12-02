import { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'

type AiGenerationStage = 'idle' | 'creating' | 'photosReady' | 'completing' | 'completed'
type AiStageVisualState = 'done' | 'current' | 'pending'

interface AIGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (data: {
    name: string
    age: string
    gender: 'Man' | 'Woman'
    ethnicity: string
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
    appearance: string
  }) => Promise<void>
  checkingStatus: boolean
  stage: AiGenerationStage
  error: string | null
  photos?: Array<{ url: string; key: string }>
  selectedIndex: number | null
  onSelectPhoto: (index: number) => void
  onConfirmPhoto: () => Promise<void>
  confirmingPhoto: boolean
}

const AI_ETHNICITY_OPTIONS = [
  'Unspecified',
  'White',
  'Black',
  'Asian American',
  'East Asian',
  'South East Asian',
  'South Asian',
  'Middle Eastern',
  'Pacific',
  'Hispanic',
] as const

const aiStageFlow: Array<{ key: 'creating' | 'photosReady' | 'completing'; title: string; description: string }> = [
  { key: 'creating', title: 'Generating reference photos', description: 'HeyGen creates a photo set from your description' },
  { key: 'photosReady', title: 'Building the talking photo', description: 'We convert the best look into a HeyGen avatar' },
  { key: 'completing', title: 'Saving to your workspace', description: 'Avatar is synced and ready for video generation' },
]

const aiStageOrder: Array<'creating' | 'photosReady' | 'completing'> = ['creating', 'photosReady', 'completing']
const aiStageWeights: Record<AiGenerationStage, number> = {
  idle: -1,
  creating: 0,
  photosReady: 1,
  completing: 2,
  completed: 3,
}

function getAiStageState(stage: AiGenerationStage, stageKey: (typeof aiStageOrder)[number]): AiStageVisualState {
  const currentWeight = aiStageWeights[stage]
  const targetIndex = aiStageOrder.indexOf(stageKey)
  if (currentWeight > targetIndex) return 'done'
  if (currentWeight === targetIndex) return 'current'
  return 'pending'
}

export function AIGenerationModal({
  isOpen,
  onClose,
  onGenerate,
  checkingStatus,
  stage,
  error,
  photos = [],
  selectedIndex,
  onSelectPhoto,
  onConfirmPhoto,
  confirmingPhoto,
}: AIGenerationModalProps) {
  const [aiName, setAiName] = useState('')
  const [aiAge, setAiAge] = useState<AIAgeOption>('Unspecified')
  const [aiGender, setAiGender] = useState<'Man' | 'Woman'>('Man')
  const [aiEthnicity, setAiEthnicity] = useState<(typeof AI_ETHNICITY_OPTIONS)[number]>('Unspecified')
  const [aiPose, setAiPose] = useState<'half_body' | 'full_body' | 'close_up'>('close_up')
  const [aiStyle, setAiStyle] = useState<'Realistic' | 'Cartoon' | 'Anime'>('Realistic')
  const [aiAppearance, setAiAppearance] = useState('')

  type AIAgeOption = 'Young Adult' | 'Early Middle Age' | 'Late Middle Age' | 'Senior' | 'Unspecified'

  const handleGenerate = async () => {
    if (!aiName.trim() || !aiAppearance.trim()) {
      return
    }

    await onGenerate({
      name: aiName,
      age: aiAge,
      gender: aiGender,
      ethnicity: aiEthnicity,
      pose: aiPose,
      style: aiStyle,
      appearance: aiAppearance,
    })
  }

  const handleClose = () => {
    if (!checkingStatus) {
      setAiName('')
      setAiAge('Unspecified')
      setAiGender('Man')
      setAiEthnicity('Unspecified')
      setAiPose('close_up')
      setAiStyle('Realistic')
      setAiAppearance('')
      onClose()
    }
  }

  const isPhotoSelectionStage = !checkingStatus && stage === 'photosReady' && photos.length > 0

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generate AI Avatar" size="md">
      <div className="space-y-6">
        {checkingStatus ? (
          <div className="space-y-6">
            <div className="text-center py-4">
              <RefreshCw className="h-10 w-10 mx-auto text-brand-500 animate-spin mb-3" />
              <p className="text-lg font-semibold text-slate-900 mb-1">Generating your avatar...</p>
              <p className="text-sm text-slate-600">
                This runs in the background—you can close this window and we&apos;ll keep working.
              </p>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>
            <div className="space-y-3">
              {aiStageFlow.map(({ key, title, description }) => {
                const state = getAiStageState(stage, key)
                const colorClasses =
                  state === 'done'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : state === 'current'
                      ? 'border-brand-200 bg-brand-50 text-brand-900'
                      : 'border-slate-200 bg-white text-slate-600'
                return (
                  <div key={key} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${colorClasses}`}>
                    <div className="mt-0.5">
                      {state === 'done' && <CheckCircle2 className="h-4 w-4" />}
                      {state === 'current' && <Loader2 className="h-4 w-4 animate-spin" />}
                      {state === 'pending' && <Circle className="h-4 w-4 text-slate-300" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{title}</p>
                      <p className="mt-1 text-xs text-slate-600">{description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : isPhotoSelectionStage ? (
          <>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Choose your avatar photo
              </p>
              <p className="text-xs text-slate-600">
                We generated several options. Pick the one you like best — we&apos;ll create and train your avatar from that photo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {photos.slice(0, 4).map((photo, index) => {
                const isSelected = selectedIndex === index
                return (
                  <button
                    key={photo.key || index}
                    type="button"
                    onClick={() => onSelectPhoto(index)}
                    className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-brand-500 ring-2 ring-brand-200 shadow-lg'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={`AI avatar option ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                )
              })}
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <Button variant="ghost" onClick={handleClose} type="button" disabled={confirmingPhoto}>
                Cancel
              </Button>
              <Button
                onClick={onConfirmPhoto}
                disabled={confirmingPhoto || selectedIndex === null}
                loading={confirmingPhoto}
                type="button"
              >
                {confirmingPhoto ? 'Creating avatar...' : 'Use this photo'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200 p-4 mb-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">Optimized for TikTok & Vertical Video</p>
                  <p className="text-xs text-slate-600">
                    Your AI avatar will be generated in vertical format (9:16), perfect for TikTok, Instagram Reels, and YouTube Shorts.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Avatar Name *"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder="e.g., Professional Business Person"
                disabled={checkingStatus}
              />

              <Select
                label="Age *"
                value={aiAge}
                onChange={(e) => setAiAge(e.target.value as AIAgeOption)}
                options={[
                  { value: 'Young Adult', label: 'Young Adult' },
                  { value: 'Early Middle Age', label: 'Early Middle Age' },
                  { value: 'Late Middle Age', label: 'Late Middle Age' },
                  { value: 'Senior', label: 'Senior' },
                  { value: 'Unspecified', label: 'Unspecified' },
                ]}
                disabled={checkingStatus}
              />

              <Select
                label="Gender *"
                value={aiGender}
                onChange={(e) => setAiGender(e.target.value as 'Man' | 'Woman')}
                options={[
                  { value: 'Man', label: 'Man' },
                  { value: 'Woman', label: 'Woman' },
                ]}
                disabled={checkingStatus}
              />

              <Select
                label="Ethnicity *"
                value={aiEthnicity}
                onChange={(e) => setAiEthnicity(e.target.value as (typeof AI_ETHNICITY_OPTIONS)[number])}
                options={AI_ETHNICITY_OPTIONS.map(value => ({ value, label: value }))}
                disabled={checkingStatus}
              />

              <Select
                label="Pose *"
                value={aiPose}
                onChange={(e) => setAiPose(e.target.value as 'half_body' | 'full_body' | 'close_up')}
                options={[
                  { value: 'close_up', label: 'Close Up' },
                  { value: 'half_body', label: 'Half Body' },
                  { value: 'full_body', label: 'Full Body' },
                ]}
                disabled={checkingStatus}
              />

              <Select
                label="Style *"
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value as 'Realistic' | 'Cartoon' | 'Anime')}
                options={[
                  { value: 'Realistic', label: 'Realistic' },
                  { value: 'Cartoon', label: 'Cartoon' },
                  { value: 'Anime', label: 'Anime' },
                ]}
                disabled={checkingStatus}
              />
            </div>

            <Textarea
              label="Appearance Description *"
              value={aiAppearance}
              onChange={(e) => setAiAppearance(e.target.value)}
              placeholder="Describe the appearance in detail: hair color, clothing, expression, etc. e.g., 'Brown hair, professional business suit, friendly smile'"
              rows={4}
              disabled={checkingStatus}
            />
            <p className="text-xs text-slate-500">
              Tip: include outfit, camera framing, vibe (e.g., &ldquo;vertical close-up, confident smile, soft office lighting&rdquo;).
            </p>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <Button variant="ghost" onClick={handleClose} disabled={checkingStatus} type="button">
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={checkingStatus || !aiName.trim() || !aiEthnicity.trim() || !aiAppearance.trim()}
                loading={checkingStatus}
                type="button"
              >
                {checkingStatus ? 'Generating...' : 'Generate Avatar'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

