import { useState, useEffect, useRef, useCallback } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { RefreshCw, Star, Trash2, User, Upload, Plus, Sparkles } from 'lucide-react'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'

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
  const [onlyCreated, setOnlyCreated] = useState(true) // Default to showing only user-created avatars
  const [showGenerateAIModal, setShowGenerateAIModal] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  
  // AI Generation form fields
  const [aiName, setAiName] = useState('')
  const [aiAge, setAiAge] = useState<'Young Adult' | 'Adult' | 'Middle Aged' | 'Senior'>('Adult')
  const [aiGender, setAiGender] = useState<'Man' | 'Woman'>('Man')
  const [aiEthnicity, setAiEthnicity] = useState('')
  const [aiOrientation, setAiOrientation] = useState<'horizontal' | 'vertical' | 'square'>('square')
  const [aiPose, setAiPose] = useState<'half_body' | 'full_body' | 'close_up'>('close_up')
  const [aiStyle, setAiStyle] = useState<'Realistic' | 'Cartoon' | 'Anime'>('Realistic')
  const [aiAppearance, setAiAppearance] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const loadAvatars = useCallback(async () => {
    try {
      setLoading(true)
      const params = onlyCreated ? { created: 'true' } : {}
      const response = await api.get('/api/avatars', { params })
      setAvatars(response.data.avatars || [])
      setDefaultAvatarId(response.data.default_avatar_id || null)
    } catch (error: any) {
      console.error('Failed to load avatars:', error)
      toast.error(error.response?.data?.error || 'Failed to load avatars')
    } finally {
      setLoading(false)
    }
  }, [onlyCreated, toast])

  useEffect(() => {
    loadAvatars()
  }, [loadAvatars])

  // Cleanup status check interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
      }
    }
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      console.log('Syncing avatars from HeyGen...')
      const response = await api.post('/api/avatars/sync')
      console.log('Sync response:', response.data)
      
      if (response.data.count === 0) {
        toast.error('No avatars found. Please check your HeyGen API key and ensure you have avatars in your HeyGen account.')
      } else {
        toast.success(`Synced ${response.data.count || 0} avatars from HeyGen`)
      }
      
      // Reload avatars with current filter
      await loadAvatars()
    } catch (error: any) {
      console.error('Failed to sync avatars:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      
      const errorMessage = 
        error.response?.data?.error || 
        error.response?.data?.message ||
        error.message || 
        'Failed to sync avatars'
      
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

  const handleCreateAvatar = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    console.log('handleCreateAvatar called', { avatarName, photoFile: !!photoFile })
    
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
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'string') {
            resolve(reader.result)
          } else {
            reject(new Error('Failed to read file'))
          }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(photoFile)
      })
      
      console.log('File read, sending to API...')
      
      // Send to API - upload photo and create avatar
      console.log('Uploading photo and creating avatar...')
      
      // Add timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutes
      
      let response
      try {
        response = await api.post('/api/avatars/upload-photo', {
          photo_data: base64Data,
          avatar_name: avatarName,
        }, {
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
      } catch (error: any) {
        clearTimeout(timeoutId)
        
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. The avatar creation is taking longer than expected. Your photo may have been saved - please check your avatars list.')
        }
        throw error
      }
      
      console.log('API response:', response.data)

      if (response.data.avatar) {
        if (response.data.warning) {
          // Show warning message if HeyGen API is unavailable
          toast.warning(response.data.message || response.data.warning)
        } else {
          toast.success(response.data.message || 'Avatar creation started! It may take a few minutes to train.')
        }
        
        setShowCreateModal(false)
        setAvatarName('')
        setPhotoFile(null)
        setPhotoPreview(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        
        // Reload avatars
        await loadAvatars()
      } else {
        throw new Error('No avatar returned from API')
      }
    } catch (error: any) {
      console.error('Failed to create avatar:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        fullError: error,
      })
      
      let errorMessage = 
        error.response?.data?.error || 
        error.response?.data?.message ||
        error.message || 
        'Failed to create avatar. Please check console for details.'
      
      // If it's a storage bucket error, make it more user-friendly
      if (errorMessage.includes('bucket') || errorMessage.includes('Bucket')) {
        errorMessage = 'Storage bucket not configured. Please contact support to set up avatar storage, or create the "avatars" bucket in Supabase Dashboard > Storage with public access.'
      }
      
      // Show full error in console for debugging
      if (error.response?.data) {
        console.error('Full API error response:', JSON.stringify(error.response.data, null, 2))
      }
      
      toast.error(errorMessage)
      setCreating(false) // Set here too in case finally doesn't run
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

  const handleGenerateAI = async () => {
    if (!aiName.trim() || !aiEthnicity.trim() || !aiAppearance.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setGeneratingAI(true)
    try {
      const response = await api.post('/api/avatars/generate-ai', {
        name: aiName,
        age: aiAge,
        gender: aiGender,
        ethnicity: aiEthnicity,
        orientation: aiOrientation,
        pose: aiPose,
        style: aiStyle,
        appearance: aiAppearance,
      })

      const genId = response.data.generation_id
      toast.success('AI avatar generation started! This may take a few minutes.')
      
      // Start polling for status
      startStatusCheck(genId)
    } catch (error: any) {
      console.error('Failed to generate AI avatar:', error)
      toast.error(error.response?.data?.error || 'Failed to generate AI avatar')
      setGeneratingAI(false)
    }
  }

  const startStatusCheck = (genId: string) => {
    setCheckingStatus(true)
    
    // Check status every 5 seconds
    statusCheckIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/api/avatars/generation-status/${genId}`)
        const status = response.data
        
        if (status.status === 'success') {
          // Generation complete - create avatar group
          if (statusCheckIntervalRef.current) {
            clearInterval(statusCheckIntervalRef.current)
            statusCheckIntervalRef.current = null
          }
          
          if (status.image_key_list && status.image_key_list.length > 0) {
            try {
              await api.post('/api/avatars/complete-ai-generation', {
                generation_id: genId,
                image_keys: status.image_key_list,
                avatar_name: aiName,
              })
              
              toast.success('AI avatar created successfully!')
              setShowGenerateAIModal(false)
              resetAIGenerationForm()
              await loadAvatars()
            } catch (err: any) {
              console.error('Failed to complete AI avatar:', err)
              toast.error(err.response?.data?.error || 'Failed to create avatar from generated images')
            }
          } else {
            toast.error('No images were generated')
          }
          
          setCheckingStatus(false)
          setGeneratingAI(false)
        } else if (status.status === 'failed') {
          if (statusCheckIntervalRef.current) {
            clearInterval(statusCheckIntervalRef.current)
            statusCheckIntervalRef.current = null
          }
          toast.error(status.msg || 'Avatar generation failed')
          setCheckingStatus(false)
          setGeneratingAI(false)
        }
        // If still in_progress, continue polling
      } catch (error: any) {
        console.error('Failed to check generation status:', error)
        // Don't stop polling on error - might be temporary
      }
    }, 5000)
  }

  const resetAIGenerationForm = () => {
    setAiName('')
    setAiAge('Adult')
    setAiGender('Man')
    setAiEthnicity('')
    setAiOrientation('square')
    setAiPose('close_up')
    setAiStyle('Realistic')
    setAiAppearance('')
  }

  const handleCloseGenerateAIModal = () => {
    if (!generatingAI && !checkingStatus) {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
      setShowGenerateAIModal(false)
      resetAIGenerationForm()
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
              variant={onlyCreated ? "primary" : "secondary"}
              onClick={() => setOnlyCreated(!onlyCreated)}
              className="flex items-center gap-2"
            >
              {onlyCreated ? '✓ ' : ''}
              {onlyCreated ? 'My Avatars' : 'All Avatars'}
            </Button>
            <Button
              variant="secondary"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowGenerateAIModal(true)
              }}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate AI Avatar
            </Button>
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
              {onlyCreated ? 'No avatars created yet' : 'No avatars found'}
            </h3>
            <p className="text-slate-600 mb-6">
              {onlyCreated 
                ? 'Create an avatar from a photo to get started'
                : 'Sync avatars from HeyGen or create one from a photo to get started'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowCreateModal(true)
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create from Photo
              </Button>
              {onlyCreated && (
                <Button onClick={() => setOnlyCreated(false)} variant="secondary">
                  Show All Avatars
                </Button>
              )}
              {!onlyCreated && (
                <Button onClick={handleSync} disabled={syncing} variant="secondary">
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Sync from HeyGen
                </Button>
              )}
            </div>
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
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleCloseCreateModal()
                }}
                disabled={creating}
                type="button"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Create Avatar button clicked', { 
                    creating, 
                    hasName: !!avatarName.trim(), 
                    hasFile: !!photoFile,
                    avatarName,
                    photoFileName: photoFile?.name
                  })
                  handleCreateAvatar(e).catch((err) => {
                    console.error('Error in handleCreateAvatar:', err)
                  })
                }}
                disabled={creating || !avatarName.trim() || !photoFile}
                loading={creating}
                type="button"
              >
                {creating ? 'Creating...' : 'Create Avatar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Generate AI Avatar Modal */}
        <Modal
          isOpen={showGenerateAIModal}
          onClose={handleCloseGenerateAIModal}
          title="Generate AI Avatar"
          size="lg"
        >
          <div className="space-y-6">
            {checkingStatus ? (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 mx-auto text-brand-500 animate-spin mb-4" />
                <p className="text-lg font-semibold text-slate-900 mb-2">
                  Generating your avatar...
                </p>
                <p className="text-sm text-slate-600">
                  This may take a few minutes. Please don't close this window.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Describe the avatar you want to generate. AI will create a unique avatar based on your description.
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                  <Input
                    label="Avatar Name *"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    placeholder="e.g., Professional Business Person"
                    disabled={generatingAI}
                  />
                  
                  <Select
                    label="Age *"
                    value={aiAge}
                    onChange={(e) => setAiAge(e.target.value as any)}
                    options={[
                      { value: 'Young Adult', label: 'Young Adult' },
                      { value: 'Adult', label: 'Adult' },
                      { value: 'Middle Aged', label: 'Middle Aged' },
                      { value: 'Senior', label: 'Senior' },
                    ]}
                    disabled={generatingAI}
                  />

                  <Select
                    label="Gender *"
                    value={aiGender}
                    onChange={(e) => setAiGender(e.target.value as any)}
                    options={[
                      { value: 'Man', label: 'Man' },
                      { value: 'Woman', label: 'Woman' },
                    ]}
                    disabled={generatingAI}
                  />

                  <Input
                    label="Ethnicity *"
                    value={aiEthnicity}
                    onChange={(e) => setAiEthnicity(e.target.value)}
                    placeholder="e.g., Asian, Caucasian, Hispanic"
                    disabled={generatingAI}
                  />

                  <Select
                    label="Orientation *"
                    value={aiOrientation}
                    onChange={(e) => setAiOrientation(e.target.value as any)}
                    options={[
                      { value: 'horizontal', label: 'Horizontal' },
                      { value: 'vertical', label: 'Vertical' },
                      { value: 'square', label: 'Square' },
                    ]}
                    disabled={generatingAI}
                  />

                  <Select
                    label="Pose *"
                    value={aiPose}
                    onChange={(e) => setAiPose(e.target.value as any)}
                    options={[
                      { value: 'close_up', label: 'Close Up' },
                      { value: 'half_body', label: 'Half Body' },
                      { value: 'full_body', label: 'Full Body' },
                    ]}
                    disabled={generatingAI}
                  />

                  <Select
                    label="Style *"
                    value={aiStyle}
                    onChange={(e) => setAiStyle(e.target.value as any)}
                    options={[
                      { value: 'Realistic', label: 'Realistic' },
                      { value: 'Cartoon', label: 'Cartoon' },
                      { value: 'Anime', label: 'Anime' },
                    ]}
                    disabled={generatingAI}
                  />
                </div>

                <Textarea
                  label="Appearance Description *"
                  value={aiAppearance}
                  onChange={(e) => setAiAppearance(e.target.value)}
                  placeholder="Describe the appearance in detail: hair color, clothing, expression, etc. e.g., 'Brown hair, professional business suit, friendly smile'"
                  rows={4}
                  disabled={generatingAI}
                />

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                  <Button
                    variant="ghost"
                    onClick={handleCloseGenerateAIModal}
                    disabled={generatingAI}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerateAI}
                    disabled={generatingAI || !aiName.trim() || !aiEthnicity.trim() || !aiAppearance.trim()}
                    loading={generatingAI}
                    type="button"
                  >
                    {generatingAI ? 'Generating...' : 'Generate Avatar'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
