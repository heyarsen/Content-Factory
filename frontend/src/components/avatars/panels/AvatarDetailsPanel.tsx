import { Sparkles, Image, Play } from 'lucide-react'
import { AvatarImage } from '../AvatarImage'
import { Button } from '../../ui/Button'
import { Avatar } from '../../../types/avatar'

interface AvatarDetailsPanelProps {
  avatar: Avatar
  lookCount?: number
  onGenerateLook?: () => void
  onManageLooks?: () => void
  onTrainAvatar?: () => void
  training?: boolean
}

export function AvatarDetailsPanel({
  avatar,
  lookCount = 0,
  onGenerateLook,
  onManageLooks,
  onTrainAvatar,
  training = false,
}: AvatarDetailsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Avatar Preview */}
      <div className="flex flex-col items-center">
        <div className="w-32 h-32 rounded-2xl overflow-hidden mb-4 border-2 border-slate-200">
          <AvatarImage avatar={avatar} size="lg" className="w-full h-full rounded-none" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">{avatar.avatar_name}</h2>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{lookCount} look{lookCount !== 1 ? 's' : ''}</span>
          <span className="px-2 py-0.5 bg-slate-100 rounded-full capitalize">
            {avatar.status}
          </span>
        </div>
      </div>

      {/* Status Info */}
      {avatar.status !== 'active' && avatar.status !== 'ready' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">
            {avatar.status === 'training' && 'This avatar is currently being trained.'}
            {avatar.status === 'pending' && 'This avatar is pending training.'}
            {avatar.status === 'failed' && 'Training failed. Please try again.'}
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        {avatar.status === 'pending' && onTrainAvatar && (
          <Button
            onClick={onTrainAvatar}
            loading={training}
            disabled={training}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {training ? 'Starting Training...' : 'Start Training'}
          </Button>
        )}
        {avatar.status === 'active' && onGenerateLook && (
          <Button
            onClick={onGenerateLook}
            variant="secondary"
            className="w-full justify-start"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Look
          </Button>
        )}
        {onManageLooks && avatar.status === 'active' && (
          <Button
            onClick={onManageLooks}
            variant="secondary"
            className="w-full justify-start"
          >
            <Image className="h-4 w-4 mr-2" />
            Manage Looks
          </Button>
        )}
      </div>

      {/* Metadata */}
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Details</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-900">
              {new Date(avatar.created_at).toLocaleDateString()}
            </dd>
          </div>
          {avatar.source && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Source</dt>
              <dd className="text-slate-900 capitalize">
                {avatar.source.replace('_', ' ')}
              </dd>
            </div>
          )}
          {avatar.gender && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Gender</dt>
              <dd className="text-slate-900">{avatar.gender}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

