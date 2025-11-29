import { Upload, Sparkles, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AvatarImage } from './AvatarImage'

interface Avatar {
  id: string
  avatar_name: string
  heygen_avatar_id: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
}

interface ManageLooksModalProps {
  isOpen: boolean
  onClose: () => void
  avatar: Avatar | null
  onUploadLooks: () => void
  onGenerateLook: () => void
}

export function ManageLooksModal({
  isOpen,
  onClose,
  avatar,
  onUploadLooks,
  onGenerateLook,
}: ManageLooksModalProps) {
  if (!avatar) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Looks - ${avatar.avatar_name}`}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <AvatarImage avatar={avatar} size="md" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">{avatar.avatar_name}</p>
            <p className="text-xs text-slate-500">Avatar</p>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Add new looks to this avatar by uploading photos or generating them with AI.
        </p>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              onUploadLooks()
              onClose()
            }}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Looks
          </Button>
          <Button
            onClick={() => {
              onGenerateLook()
              onClose()
            }}
            variant="secondary"
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Look
          </Button>
        </div>
      </div>
    </Modal>
  )
}

