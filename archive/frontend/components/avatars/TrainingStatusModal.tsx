import { Loader2, CheckCircle2, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
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

interface TrainingStatusModalProps {
  isOpen: boolean
  onClose: () => void
  avatar: Avatar | null
  status: 'training' | 'pending' | 'ready' | 'failed' | null
  onRefresh?: () => void
}

export function TrainingStatusModal({
  isOpen,
  onClose,
  avatar,
  status,
      onRefresh,
}: TrainingStatusModalProps) {
  const canClose = status === 'ready' || status === 'failed'

  return (
    <Modal
      isOpen={isOpen}
      onClose={canClose ? onClose : undefined}
      title="Avatar Training in Progress"
      size="md"
      closeOnOverlayClick={canClose}
      showCloseButton={canClose}
    >
      {avatar && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl overflow-hidden border-2 border-slate-200 relative">
              <AvatarImage avatar={avatar} size="lg" className="rounded-xl" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{avatar.avatar_name}</h3>
          </div>

          <div className="space-y-4">
            {status === 'training' || status === 'pending' ? (
              <>
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-full max-w-xs bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
                    <p className="text-base font-medium text-slate-900">Training your avatar...</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 text-center">
                  This process typically takes a few minutes. Your avatar will be ready to use once training completes.
                </p>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 text-center">
                    You can close this window - training will continue in the background. You&apos;ll be notified when it&apos;s ready.
                  </p>
                </div>
                {onRefresh && (
                  <div className="flex justify-center">
                    <Button variant="ghost" size="sm" onClick={onRefresh}>
                      Refresh Status
                    </Button>
                  </div>
                )}
              </>
            ) : status === 'ready' ? (
              <>
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <p className="text-base font-medium text-slate-900">Training completed!</p>
                </div>
                <p className="text-sm text-slate-600 text-center">
                  Your avatar is now ready to use for video generation.
                </p>
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <Button onClick={onClose}>Close</Button>
                </div>
              </>
            ) : status === 'failed' ? (
              <>
                <div className="flex items-center justify-center gap-3">
                  <X className="h-6 w-6 text-red-500" />
                  <p className="text-base font-medium text-slate-900">Training failed</p>
                </div>
                <p className="text-sm text-slate-600 text-center">
                  There was an error during training. Please try training again manually.
                </p>
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <Button onClick={onClose}>Close</Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  )
}

