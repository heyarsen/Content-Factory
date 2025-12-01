import { Star, Trash2 } from 'lucide-react'
import { AvatarImage } from '../AvatarImage'
import { Button } from '../../ui/Button'
import { Avatar, PhotoAvatarLook } from '../../../types/avatar'

interface LookDetailsPanelProps {
  look: PhotoAvatarLook
  avatar: Avatar
  onSetDefault?: () => void
  onDelete?: () => void
}

export function LookDetailsPanel({
  look,
  avatar,
  onSetDefault,
  onDelete,
}: LookDetailsPanelProps) {
  const imageUrl = look.image_url || look.preview_url || look.thumbnail_url

  return (
    <div className="space-y-6">
      {/* Look Preview */}
      <div>
        {imageUrl ? (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100">
            <img
              src={imageUrl}
              alt={look.name || 'Look'}
              className="w-full h-full object-cover"
            />
            {look.is_default && (
              <div className="absolute top-3 right-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                  <Star className="h-5 w-5 text-white fill-current" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-[3/4] rounded-2xl bg-slate-200 flex items-center justify-center">
            <span className="text-slate-400">No image</span>
          </div>
        )}
      </div>

      {/* Look Info */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {look.name || 'Unnamed Look'}
        </h2>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            <AvatarImage avatar={avatar} size="md" />
          </div>
          <span className="text-sm text-slate-500">{avatar.avatar_name}</span>
        </div>
        {look.is_default && (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-sm font-medium">
            <Star className="h-4 w-4 fill-current" />
            Default Look
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t border-slate-200">
        {!look.is_default && onSetDefault && (
          <Button
            onClick={onSetDefault}
            variant="secondary"
            className="w-full justify-start"
          >
            <Star className="h-4 w-4 mr-2" />
            Set as Default
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={onDelete}
            variant="danger"
            className="w-full justify-start"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Look
          </Button>
        )}
      </div>

      {/* Metadata */}
      {look.created_at && (
        <div className="pt-4 border-t border-slate-200">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Created</dt>
              <dd className="text-slate-900">
                {new Date(look.created_at * 1000).toLocaleDateString()}
              </dd>
            </div>
            {look.status && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="text-slate-900 capitalize">{look.status}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

