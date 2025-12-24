import { useState } from 'react'
import { User, CheckCircle2, RefreshCw, Loader2, Circle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { AvatarImage } from './AvatarImage'
import { Avatar } from '../../types/avatar'

interface LookGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  avatar: Avatar | null
  avatars: Avatar[]
  step: 'select-avatar' | 'generate'
  onSelectAvatar: (avatar: Avatar) => void
  onGenerate: (data: {
    avatar: Avatar
    prompt: string
  }) => Promise<void>
  generating: boolean
  checkingStatus?: boolean
  stage?: 'idle' | 'generating' | 'saving' | 'completed'
  error?: string | null
}

const lookStageFlow = [
  { key: 'generating', title: 'Generating new look', description: 'HeyGen is creating a new look for your avatar' },
  { key: 'saving', title: 'Saving to workspace', description: 'Adding the new look to your avatar group' },
]

const lookStageOrder: Array<'generating' | 'saving'> = ['generating', 'saving']
const lookStageWeights: Record<string, number> = {
  idle: -1,
  generating: 0,
  saving: 1,
  completed: 2,
}

function getLookStageState(stage: string, stageKey: string): 'done' | 'current' | 'pending' {
  const currentWeight = lookStageWeights[stage] || -1
  const targetIndex = lookStageOrder.indexOf(stageKey as any)
  if (currentWeight > targetIndex) return 'done'
  if (currentWeight === targetIndex) return 'current'
  return 'pending'
}


export function LookGenerationModal({
  isOpen,
  onClose,
  avatar,
  avatars,
  step,
  onSelectAvatar,
  onGenerate,
  generating,
  checkingStatus = false,
  stage = 'idle',
  error = null,
}: LookGenerationModalProps) {
  const [lookPrompt, setLookPrompt] = useState('')

  const handleGenerate = async () => {
    if (!avatar || !lookPrompt.trim()) {
      return
    }


    await onGenerate({
      avatar,
      prompt: lookPrompt,
      age: avatar.age || 'Young Adult',
      ethnicity: avatar.ethnicity !== 'Unspecified' ? avatar.ethnicity : undefined,
    } as any)

    // Reset form on success
    setLookPrompt('')
  }

  const handleClose = () => {
    if (!generating && !checkingStatus) {
      setLookPrompt('')
      onClose()
    } else {
      // Allow closing during generation, just like AI avatar generation
      onClose()
    }
  }

  const activeAvatars = avatars.filter(a => a.status === 'active')

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'select-avatar' ? 'Select Avatar' : 'Generate AI Look'}
      size={step === 'select-avatar' ? 'xl' : 'md'}
    >
      {checkingStatus ? (
        <div className="space-y-6">
          <div className="text-center py-4">
            <RefreshCw className="h-10 w-10 mx-auto text-brand-500 animate-spin mb-3" />
            <p className="text-lg font-semibold text-slate-900 mb-1">Generating your look...</p>
            <p className="text-sm text-slate-600">
              This runs in the background—you can close this window and we&apos;ll keep working.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
          <div className="space-y-3">
            {lookStageFlow.map(({ key, title, description }) => {
              const state = getLookStageState(stage, key)
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
          <div className="flex justify-center pt-4">
            <Button variant="ghost" onClick={handleClose}>
              Close & Continue in Background
            </Button>
          </div>
        </div>
      ) : step === 'select-avatar' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Choose an avatar to generate a new look for. Only trained avatars can have new looks generated.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
            {activeAvatars.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => onSelectAvatar(av)}
                className="relative rounded-xl border-2 border-slate-200 bg-white p-3 transition-all hover:scale-105 hover:border-brand-300 hover:shadow-md text-left"
              >
                <div className="relative w-full aspect-[3/4] mb-2">
                  <AvatarImage avatar={av} size="lg" className="rounded-lg" />
                </div>
                <p className="text-xs font-medium text-slate-700 truncate text-center">{av.avatar_name}</p>
              </button>
            ))}
          </div>

          {activeAvatars.length === 0 && (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-1">No trained avatars available</p>
              <p className="text-xs text-slate-500">Train an avatar first before generating looks</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Selected Avatar Display */}
          {avatar && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <AvatarImage avatar={avatar} size="md" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{avatar.avatar_name}</p>
                <p className="text-xs text-slate-500">Selected avatar</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          )}

          <div className="space-y-4">

            <Textarea
              label="Look Description *"
              value={lookPrompt}
              onChange={(e) => setLookPrompt(e.target.value)}
              placeholder="e.g., Professional business suit, formal attire, confident expression"
              rows={4}
              disabled={generating}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <Button variant="ghost" onClick={handleClose} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !lookPrompt.trim()} loading={generating}>
              {generating ? 'Generating...' : 'Generate Look'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
