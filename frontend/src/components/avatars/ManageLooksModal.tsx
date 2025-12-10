import { useMemo, useState } from 'react'
import { Upload, Sparkles, Clock, Star } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AvatarImage } from './AvatarImage'
import { Avatar, PhotoAvatarLook } from '../../types/avatar'

interface ManageLooksModalProps {
  isOpen: boolean
  onClose: () => void
  avatar: Avatar | null
  looks?: PhotoAvatarLook[]
  onUploadLooks: () => void
  onGenerateLook: () => void
  onSetDefaultLook?: (lookId: string) => Promise<void>
}

export function ManageLooksModal({
  isOpen,
  onClose,
  avatar,
  looks = [],
  onUploadLooks,
  onGenerateLook,
  onSetDefaultLook,
}: ManageLooksModalProps) {
  if (!avatar) return null

  const [activeTab, setActiveTab] = useState<'looks' | 'history'>('looks')
  const sortedLooks = useMemo(
    () => [...looks].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [looks],
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Looks - ${avatar.avatar_name}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <AvatarImage avatar={avatar} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{avatar.avatar_name}</p>
            <p className="text-xs text-slate-500">Looks: {looks.length}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onUploadLooks()
                onClose()
              }}
              size="sm"
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
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Look
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'looks' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setActiveTab('looks')}
          >
            Looks
          </button>
          <button
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        {activeTab === 'looks' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {sortedLooks.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No looks yet. Upload or generate to get started.
              </div>
            )}
            {sortedLooks.map((look) => (
              <div
                key={look.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative aspect-[3/4] bg-slate-50">
                  {look.preview_url || look.image_url ? (
                    <img src={look.preview_url || look.image_url} alt={look.name || 'Look'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">No preview</div>
                  )}
                  {look.is_default && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                      <Star className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                      Default
                    </span>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{look.name || 'Look'}</p>
                    <p className="text-xs text-slate-500">
                      {look.status ? look.status : 'Ready'}
                    </p>
                  </div>
                  {onSetDefaultLook && (
                    <Button
                      size="sm"
                      variant={look.is_default ? 'ghost' : 'secondary'}
                      disabled={!!look.is_default}
                      onClick={() => onSetDefaultLook(look.id)}
                      className="w-full"
                    >
                      {look.is_default ? 'Current default' : 'Set as default'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {sortedLooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No history yet.
              </div>
            ) : (
              sortedLooks.map((look) => (
                <div key={`${look.id}-history`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="relative h-12 w-9 overflow-hidden rounded-lg bg-slate-100">
                    {look.preview_url || look.image_url ? (
                      <img src={look.preview_url || look.image_url} alt={look.name || 'Look'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-400">No preview</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{look.name || 'Look'}</p>
                    <p className="text-xs text-slate-500 capitalize">{look.status || 'ready'}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-4 w-4" />
                    {look.created_at ? new Date(look.created_at).toLocaleString() : '—'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

