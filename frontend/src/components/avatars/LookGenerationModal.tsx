import { useState } from 'react'
import { User, CheckCircle2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { AvatarImage } from './AvatarImage'

interface Avatar {
  id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
  status: string
}

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
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
  }) => Promise<void>
  generating: boolean
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
}: LookGenerationModalProps) {
  const [lookPrompt, setLookPrompt] = useState('')
  const [lookPose, setLookPose] = useState<'half_body' | 'full_body' | 'close_up'>('close_up')
  const [lookStyle, setLookStyle] = useState<'Realistic' | 'Cartoon' | 'Anime'>('Realistic')

  const handleGenerate = async () => {
    if (!avatar || !lookPrompt.trim()) {
      return
    }

    await onGenerate({
      avatar,
      prompt: lookPrompt,
      pose: lookPose,
      style: lookStyle,
    })

    // Reset form on success
    setLookPrompt('')
    setLookPose('close_up')
    setLookStyle('Realistic')
  }

  const handleClose = () => {
    if (!generating) {
      setLookPrompt('')
      setLookPose('close_up')
      setLookStyle('Realistic')
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
      {step === 'select-avatar' ? (
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

          <Textarea
            label="Look Description *"
            value={lookPrompt}
            onChange={(e) => setLookPrompt(e.target.value)}
            placeholder="e.g., Professional business suit, formal attire, confident expression"
            rows={4}
            disabled={generating}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Pose *"
              value={lookPose}
              onChange={(e) => setLookPose(e.target.value as 'half_body' | 'full_body' | 'close_up')}
              options={[
                { value: 'close_up', label: 'Close Up' },
                { value: 'half_body', label: 'Half Body' },
                { value: 'full_body', label: 'Full Body' },
              ]}
              disabled={generating}
            />

            <Select
              label="Style *"
              value={lookStyle}
              onChange={(e) => setLookStyle(e.target.value as 'Realistic' | 'Cartoon' | 'Anime')}
              options={[
                { value: 'Realistic', label: 'Realistic' },
                { value: 'Cartoon', label: 'Cartoon' },
                { value: 'Anime', label: 'Anime' },
              ]}
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

