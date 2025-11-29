import { useState } from 'react'
import { Star, User } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'

interface Avatar {
  id: string
  avatar_name: string
}

interface PhotoAvatarLook {
  id: string
  name?: string
  image_url?: string
  preview_url?: string
  thumbnail_url?: string
}

interface LookSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  avatar: Avatar
  looks: PhotoAvatarLook[]
  onConfirm: (lookId: string) => Promise<void>
  allowSkip?: boolean
}

export function LookSelectionModal({
  isOpen,
  onClose,
  avatar,
  looks,
  onConfirm,
  allowSkip = false,
}: LookSelectionModalProps) {
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null)
  const { toast } = useToast()

  const handleConfirm = async () => {
    if (!selectedLookId) {
      toast.warning('Please select a look to continue')
      return
    }

    await onConfirm(selectedLookId)
    setSelectedLookId(null)
  }

  const handleClose = () => {
    if (allowSkip) {
      setSelectedLookId(null)
      onClose()
    } else {
      if (!selectedLookId) {
        toast.warning('Please select a look to continue. This selection is required.')
        return
      }
      handleConfirm()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Choose Your Avatar Look"
      size="lg"
      closeOnOverlayClick={allowSkip}
      showCloseButton={allowSkip}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {allowSkip
            ? 'Select the look you want to use for this avatar. You can skip this step and select later.'
            : 'Select the look you want to use for this avatar. This choice is permanent and cannot be changed later.'}
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {looks.map((look) => (
            <div
              key={look.id}
              onClick={() => setSelectedLookId(look.id)}
              className={`relative flex-shrink-0 w-32 rounded-lg border-2 overflow-hidden transition-all cursor-pointer ${
                selectedLookId === look.id
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-slate-200 bg-white hover:border-brand-300'
              }`}
            >
              {(() => {
                const imageUrl = look.thumbnail_url || look.preview_url || look.image_url
                const hasValidUrl = imageUrl && imageUrl.trim() !== ''
                return (
                  <div className="relative w-full aspect-[9/16]">
                    <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-400" />
                    </div>
                    {hasValidUrl && (
                      <div className="relative w-full h-full bg-slate-50 flex items-center justify-center overflow-hidden z-10">
                        <img
                          src={imageUrl}
                          alt={look.name || 'Look'}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="p-1.5">
                <p className="text-xs font-medium text-slate-900 truncate">{look.name || 'Unnamed Look'}</p>
              </div>
              {selectedLookId === look.id && (
                <div className="absolute top-1.5 right-1.5 bg-brand-500 text-white px-1.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Selected
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
          {allowSkip && (
            <Button variant="ghost" onClick={handleClose}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={!selectedLookId}>
            {allowSkip ? 'Confirm & Train' : 'Confirm & Train'}
          </Button>
        </div>
        {allowSkip && (
          <p className="text-xs text-slate-500 text-center mt-2">
            You can select a look later from the avatar settings
          </p>
        )}
      </div>
    </Modal>
  )
}

