import { useState, useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import { AvatarCardCompact } from '../cards/AvatarCardCompact'
import { Avatar } from '../../../types/avatar'

interface AvatarSidebarProps {
  avatars: Avatar[]
  loading: boolean
  selectedAvatarId: string | null
  onSelectAvatar: (avatarId: string | null) => void
  onCreateAvatarClick: () => void
}

export function AvatarSidebar({
  avatars,
  loading,
  selectedAvatarId,
  onSelectAvatar,
  onCreateAvatarClick,
}: AvatarSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAvatars = useMemo(() => {
    return avatars.filter(avatar =>
      avatar.avatar_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [avatars, searchQuery])
  

  if (loading) {
    return (
      <div className="w-72 flex-shrink-0">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search avatars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Create Avatar Button */}
      <button
        onClick={onCreateAvatarClick}
        className="w-full mb-4 p-4 bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
      >
        <Plus className="h-5 w-5" />
        <span className="font-semibold">Create Avatar</span>
      </button>

      {/* All Avatars Option */}
      <button
        onClick={() => onSelectAvatar(null)}
        className={`w-full mb-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${
          selectedAvatarId === null
            ? 'border-cyan-500 bg-cyan-50 text-slate-900'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}
      >
        <span className="font-semibold">All Avatars</span>
      </button>

      {/* Avatar List */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
        {filteredAvatars.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            {searchQuery ? 'No avatars found' : 'No avatars yet'}
          </div>
        ) : (
          filteredAvatars.map((avatar) => (
            <AvatarCardCompact
              key={avatar.id}
              avatar={avatar}
              isSelected={selectedAvatarId === avatar.id}
              onClick={() => onSelectAvatar(avatar.id === selectedAvatarId ? null : avatar.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

