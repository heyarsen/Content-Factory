import { useState, useEffect } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { RefreshCw, Star, Trash2, User } from 'lucide-react'

interface Avatar {
  id: string
  heygen_avatar_id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
  gender: string | null
  status: string
  is_default: boolean
  created_at: string
}

export default function Avatars() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [defaultAvatarId, setDefaultAvatarId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadAvatars()
  }, [])

  const loadAvatars = async () => {
    try {
      const response = await api.get('/api/avatars')
      setAvatars(response.data.avatars || [])
      setDefaultAvatarId(response.data.default_avatar_id || null)
    } catch (error: any) {
      console.error('Failed to load avatars:', error)
      toast.error(error.response?.data?.error || 'Failed to load avatars')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await api.post('/api/avatars/sync')
      setAvatars(response.data.avatars || [])
      if (response.data.count === 0) {
        toast.error('No avatars found. Please check your HeyGen API key and ensure you have avatars in your HeyGen account.')
      } else {
        toast.success(`Synced ${response.data.count || 0} avatars from HeyGen`)
      }
    } catch (error: any) {
      console.error('Failed to sync avatars:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to sync avatars'
      toast.error(errorMessage + '. Please check your HEYGEN_KEY environment variable and HeyGen API documentation.')
    } finally {
      setSyncing(false)
    }
  }

  const handleSetDefault = async (avatarId: string) => {
    try {
      await api.post(`/api/avatars/${avatarId}/set-default`)
      setDefaultAvatarId(avatarId)
      setAvatars(avatars.map(a => ({
        ...a,
        is_default: a.id === avatarId
      })))
      toast.success('Default avatar updated')
    } catch (error: any) {
      console.error('Failed to set default avatar:', error)
      toast.error(error.response?.data?.error || 'Failed to set default avatar')
    }
  }

  const handleDelete = async (avatarId: string, avatarName: string) => {
    if (!confirm(`Are you sure you want to remove "${avatarName}" from your avatar list?`)) {
      return
    }

    try {
      await api.delete(`/api/avatars/${avatarId}`)
      setAvatars(avatars.filter(a => a.id !== avatarId))
      if (defaultAvatarId === avatarId) {
        setDefaultAvatarId(null)
      }
      toast.success('Avatar removed')
    } catch (error: any) {
      console.error('Failed to delete avatar:', error)
      toast.error(error.response?.data?.error || 'Failed to delete avatar')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Avatars</h1>
            <p className="text-slate-600 mt-1">
              Manage your HeyGen avatars for video generation
            </p>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from HeyGen'}
          </Button>
        </div>

        {avatars.length === 0 ? (
          <Card className="p-12 text-center">
            <User className="h-16 w-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No avatars found
            </h3>
            <p className="text-slate-600 mb-6">
              Sync avatars from HeyGen to get started
            </p>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync from HeyGen
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {avatars.map((avatar) => (
              <Card key={avatar.id} className="overflow-hidden">
                <div className="relative">
                  {avatar.thumbnail_url || avatar.preview_url ? (
                    <img
                      src={avatar.thumbnail_url || avatar.preview_url || ''}
                      alt={avatar.avatar_name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                      <User className="h-20 w-20 text-white opacity-50" />
                    </div>
                  )}
                  {avatar.is_default && (
                    <div className="absolute top-2 right-2 bg-brand-500 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Default
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {avatar.avatar_name}
                  </h3>
                  {avatar.gender && (
                    <p className="text-sm text-slate-500 mb-3 capitalize">
                      {avatar.gender}
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    {!avatar.is_default && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSetDefault(avatar.id)}
                        className="flex-1"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(avatar.id, avatar.avatar_name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
