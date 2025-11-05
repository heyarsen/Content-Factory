import { useState, useEffect, useRef } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { RefreshCw, Star, Trash2, User, Upload, Plus } from 'lucide-react'

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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [avatarName, setAvatarName] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('Image size must be less than 10MB')
        return
      }
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateAvatar = async () => {
    if (!avatarName.trim()) {
      toast.error('Please enter an avatar name')
      return
    }
    if (!photoFile) {
      toast.error('Please select a photo')
      return
    }

    setCreating(true)
    try {
      // Convert file to base64 data URL
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Data = reader.result as string
        
        // For now, we'll send the base64 data URL directly
        // In production, you might want to upload to a storage service first
        await api.post('/api/avatars/create-from-photo', {
          photo_url: base64Data,
          avatar_name: avatarName,
        })

        toast.success('Avatar creation started! It may take a few minutes to train.')
        setShowCreateModal(false)
        setAvatarName('')
        setPhotoFile(null)
        setPhotoPreview(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        
        // Reload avatars
        await loadAvatars()
      }
      reader.readAsDataURL(photoFile)
    } catch (error: any) {
      console.error('Failed to create avatar:', error)
      toast.error(error.response?.data?.error || 'Failed to create avatar')
    } finally {
      setCreating(false)
    }
  }

  const handleCloseCreateModal = () => {
    if (!creating) {
      setShowCreateModal(false)
      setAvatarName('')
      setPhotoFile(null)
      setPhotoPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold text-primary">Avatars</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your HeyGen avatars for video generation
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Create avatar button clicked')
                setShowCreateModal(true)
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create from Photo
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from HeyGen'}
            </Button>
          </div>
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

        {/* Create Avatar Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          title="Create Avatar from Photo"
          size="lg"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Avatar Name
              </label>
              <Input
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                placeholder="Enter avatar name"
                disabled={creating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Photo
              </label>
              {photoPreview ? (
                <div className="space-y-3">
                  <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-slate-200">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    disabled={creating}
                  >
                    Change Photo
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-500 transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600 mb-1">
                    Click to upload a photo
                  </p>
                  <p className="text-xs text-slate-500">
                    PNG, JPG up to 10MB. Front-facing photo recommended.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={creating}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={handleCloseCreateModal}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAvatar}
                disabled={creating || !avatarName.trim() || !photoFile}
                loading={creating}
              >
                {creating ? 'Creating...' : 'Create Avatar'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
