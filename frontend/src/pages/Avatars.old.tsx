import { useState, useCallback, useEffect, useRef } from 'react'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { handleError, formatSpecificError } from '../lib/errorHandler'
import { Upload, Sparkles, User, Plus, Grid3x3, List } from 'lucide-react'

// Import reimagined components
import { AvatarSelector } from '../components/avatars/AvatarSelector'
import { LooksGrid } from '../components/avatars/LooksGrid'
import { AvatarCreateModal } from '../components/avatars/AvatarCreateModal'
import { AIGenerationModal } from '../components/avatars/AIGenerationModal'
import { LookGenerationModal } from '../components/avatars/LookGenerationModal'
import { LookSelectionModal } from '../components/avatars/LookSelectionModal'
import { TrainingStatusModal } from '../components/avatars/TrainingStatusModal'
import { AddLooksModal } from '../components/avatars/AddLooksModal'
import { ManageLooksModal } from '../components/avatars/ManageLooksModal'

// Import custom hooks
import { useAvatarData } from '../hooks/useAvatarData'
import { useAvatarPolling } from '../hooks/useAvatarPolling'
import { useLookGeneration } from '../hooks/useLookGeneration'

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
  source?: 'synced' | 'user_photo' | 'ai_generated' | null
}

interface PhotoAvatarLook {
  id: string
  name?: string
  status?: string
  image_url?: string
  preview_url?: string
  thumbnail_url?: string
  created_at?: number
  updated_at?: number | null
  is_default?: boolean
}

type AiGenerationStage = 'idle' | 'creating' | 'photosReady' | 'completing' | 'completed'
type ViewMode = 'grid' | 'list'

export default function Avatars() {
  const { toast } = useToast()
  const avatarsLengthRef = useRef(0)
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showGenerateAIModal, setShowGenerateAIModal] = useState(false)
  const [showGenerateLookModal, setShowGenerateLookModal] = useState(false)
  const [generateLookStep, setGenerateLookStep] = useState<'select-avatar' | 'generate'>('select-avatar')
  const [selectedAvatarForLook, setSelectedAvatarForLook] = useState<Avatar | null>(null)
  const [showAddLooksModal, setShowAddLooksModal] = useState(false)
  const [showLooksModal, setShowLooksModal] = useState<Avatar | null>(null)
  const [lookSelectionModal, setLookSelectionModal] = useState<{ avatar: Avatar; looks: PhotoAvatarLook[] } | null>(null)
  const [showTrainingModal, setShowTrainingModal] = useState(false)
  const [trainingAvatar, setTrainingAvatar] = useState<Avatar | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<'training' | 'pending' | 'ready' | 'failed' | null>(null)

  // Filter state
  const [selectedAvatarFilter, setSelectedAvatarFilter] = useState<string | null>(null)
  
  // AI Generation state
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [aiGenerationStage, setAiGenerationStage] = useState<AiGenerationStage>('idle')
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null)
  
  // Create/Look states
  const [creating, setCreating] = useState(false)
  const [addingLooks, setAddingLooks] = useState(false)

  // Use custom hooks
  const { avatars, loading, allLooks, loadingLooks, loadAvatars, invalidateLooksCache } = useAvatarData({
    lazyLoadLooks: false,
    selectedAvatarId: selectedAvatarFilter,
  })

  const { refreshTrainingStatus } = useAvatarPolling({
    avatars: avatars as any,
    onStatusUpdate: (_avatar, _status) => {
      // Status updates handled by polling
    },
    onTrainingComplete: (avatar) => {
      if (trainingAvatar && trainingAvatar.id === avatar.id) {
        setTrainingStatus('ready')
        toast.success('Avatar training completed!')
        setTimeout(() => {
          setShowTrainingModal(false)
          setTrainingAvatar(null)
          setTrainingStatus(null)
        }, 2000)
      }
      loadAvatars()
      invalidateLooksCache()
    },
  })

  const { generating, generatingLookIds, generateLook } = useLookGeneration({
    onSuccess: () => {
      loadAvatars()
      invalidateLooksCache()
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  // Check for unselected looks
  const checkForUnselectedLooks = useCallback(async (avatarsList: Avatar[]) => {
    if (lookSelectionModal) return

    for (const avatar of avatarsList) {
      if (avatar.status !== 'active' || !avatar.heygen_avatar_id) continue

      try {
        const detailsResponse = await api.get(`/api/avatars/${avatar.id}/details`)
        const looks = detailsResponse.data?.looks || []
        const defaultLookId = detailsResponse.data?.default_look_id

        if (looks.length > 0 && !defaultLookId) {
          setLookSelectionModal({ avatar, looks })
          return
        }
      } catch (error) {
        // Silently continue
      }
    }
  }, [lookSelectionModal])

  // Handle avatar creation
  const handleCreateAvatar = useCallback(async (data: { avatarName: string; photoFiles: File[] }) => {
    setCreating(true)
    try {
      const formData = new FormData()
      formData.append('avatar_name', data.avatarName)
      
      // Convert first file to base64
      const primaryFile = data.photoFiles[0]
      const primaryBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result)
          } else {
            reject(new Error('Failed to read file'))
          }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(primaryFile)
      })
      formData.append('photo_data', primaryBase64)

      // Add additional photos if any
      if (data.photoFiles.length > 1) {
        const additionalPhotos = await Promise.all(
          data.photoFiles.slice(1).map(file =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result)
                } else {
                  reject(new Error('Failed to read file'))
                }
              }
              reader.onerror = () => reject(new Error('Failed to read file'))
              reader.readAsDataURL(file)
            })
          )
        )
        formData.append('additional_photos', JSON.stringify(additionalPhotos))
      }

      const response = await api.post('/api/avatars/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success('Avatar created successfully!')
      setShowCreateModal(false)
      await loadAvatars()
      invalidateLooksCache()

      // Check if avatar has looks that need selection
      const avatar = response.data?.avatar
      if (avatar) {
        setTimeout(() => {
          checkForUnselectedLooks([avatar])
        }, 2000)
      }
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setCreating(false)
    }
  }, [toast, loadAvatars, invalidateLooksCache, checkForUnselectedLooks])

  // Handle AI generation
  const handleGenerateAI = useCallback(async (data: {
    name: string
    age: string
    gender: 'Man' | 'Woman'
    ethnicity: string
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
    appearance: string
  }) => {
    setCheckingStatus(true)
    setAiGenerationStage('creating')
    setAiGenerationError(null)

    try {
      const response = await api.post('/api/avatars/generate-ai', {
        name: data.name,
        age: data.age,
        gender: data.gender,
        ethnicity: data.ethnicity,
        orientation: 'square',
        pose: data.pose,
        style: data.style,
        appearance: data.appearance,
      })

      const generationId = response.data?.generation_id
      if (!generationId) {
        throw new Error('No generation ID returned')
      }

      setAiGenerationStage('photosReady')
      
      // Poll for completion
      const checkStatus = async () => {
        try {
          const statusResponse = await api.get(`/api/avatars/generation-status/${generationId}`)
          const status = statusResponse.data?.status

          if (status === 'success') {
            setAiGenerationStage('completing')
            await loadAvatars()
            invalidateLooksCache()
            setAiGenerationStage('completed')
            setShowGenerateAIModal(false)
            toast.success('AI avatar generated successfully!')
          } else if (status === 'failed') {
            throw new Error('AI generation failed')
          } else {
            setTimeout(checkStatus, 5000)
          }
        } catch (error: any) {
          setAiGenerationError(error.message || 'Failed to check generation status')
          handleError(error, { showToast: false, logError: true })
        }
      }

      setTimeout(checkStatus, 5000)
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      setAiGenerationError(errorMessage)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage)
      setCheckingStatus(false)
    }
  }, [toast, loadAvatars, invalidateLooksCache])

  // Handle look generation
  const handleGenerateLook = useCallback(async (data: {
    avatar: Avatar
    prompt: string
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
  }) => {
    await generateLook(data)
    setShowGenerateLookModal(false)
    setGenerateLookStep('select-avatar')
    setSelectedAvatarForLook(null)
  }, [generateLook])

  // Handle adding looks
  const handleAddLooks = useCallback(async (files: File[]) => {
    if (!showLooksModal) return

    setAddingLooks(true)
    try {
      const formData = new FormData()
      formData.append('group_id', showLooksModal.heygen_avatar_id)
      
      const imageKeys: string[] = []
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result.split(',')[1])
            } else {
              reject(new Error('Failed to read file'))
            }
          }
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
        const uploadResponse = await api.post('/api/avatars/upload-look-image', {
          image_data: `data:${file.type};base64,${base64}`,
        })
        if (uploadResponse.data?.image_key) {
          imageKeys.push(uploadResponse.data.image_key)
        }
      }

      await api.post('/api/avatars/add-looks', {
        group_id: showLooksModal.heygen_avatar_id,
        image_keys: imageKeys,
      })

      toast.success('Looks added successfully!')
      setShowAddLooksModal(false)
      setShowLooksModal(null)
      await loadAvatars()
      invalidateLooksCache()
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setAddingLooks(false)
    }
  }, [showLooksModal, toast, loadAvatars, invalidateLooksCache])

  // Handle look selection
  const handleLookSelection = useCallback(async (lookId: string) => {
    if (!lookSelectionModal) return

    try {
      await api.post(`/api/avatars/${lookSelectionModal.avatar.id}/set-default-look`, {
        look_id: lookId,
      })

      setLookSelectionModal(null)
      setTrainingAvatar(lookSelectionModal.avatar)
      setTrainingStatus('pending')
      setShowTrainingModal(true)

      setTrainingStatus('training')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const trainResponse = await api.post(`/api/avatars/${lookSelectionModal.avatar.id}/train`)
      await loadAvatars()
      invalidateLooksCache()

      const responseStatus = trainResponse.data?.status
      if (responseStatus === 'ready' || responseStatus === 'active') {
        setTrainingStatus('ready')
        setTimeout(() => {
          setShowTrainingModal(false)
          setTrainingAvatar(null)
          setTrainingStatus(null)
        }, 2000)
      } else if (responseStatus === 'failed') {
        setTrainingStatus('failed')
      }
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage)
      setTrainingStatus('failed')
    }
  }, [lookSelectionModal, toast, loadAvatars, invalidateLooksCache])

  // Trigger check after avatars load
  useEffect(() => {
    if (avatars.length > 0 && avatars.length !== avatarsLengthRef.current) {
      avatarsLengthRef.current = avatars.length
      const timer = setTimeout(() => {
        checkForUnselectedLooks(avatars)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [avatars.length, checkForUnselectedLooks])

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-20 h-20 rounded-xl bg-slate-200 animate-pulse"></div>
                <div className="h-3 w-12 bg-slate-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-slate-200 rounded-2xl"></div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  const selectedAvatar = selectedAvatarFilter ? avatars.find(a => a.id === selectedAvatarFilter) : null

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Avatars</h1>
            <p className="text-sm text-slate-500 mt-1">
              {selectedAvatarFilter
                ? `Managing looks for "${selectedAvatar?.avatar_name || 'Unknown'}"`
                : 'Manage your avatars and their looks'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowGenerateAIModal(true)}
              variant="secondary"
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI
            </Button>
            <Button onClick={() => setShowCreateModal(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          </div>
        </div>

        {/* Avatar Selector */}
        <AvatarSelector
          avatars={avatars}
          selectedAvatarId={selectedAvatarFilter}
          onSelect={setSelectedAvatarFilter}
          onCreateClick={() => setShowCreateModal(true)}
        />

        {/* Section header with view controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">
            {selectedAvatarFilter
              ? `${selectedAvatar?.avatar_name}'s looks`
              : 'All avatar looks'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Looks Grid */}
        {avatars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
              <User className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 text-center">
              No avatars yet
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-md mb-8">
              Create your first avatar by uploading a photo or generating one with AI
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={() => setShowCreateModal(true)} size="lg">
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </Button>
              <Button onClick={() => setShowGenerateAIModal(true)} variant="secondary" size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Avatar
              </Button>
            </div>
          </div>
        ) : (
          <LooksGrid
            looks={allLooks}
            selectedAvatarFilter={selectedAvatarFilter}
            viewMode={viewMode}
            onCreateClick={() => {
              if (selectedAvatarFilter) {
                const avatar = avatars.find(a => a.id === selectedAvatarFilter)
                if (avatar) {
                  setSelectedAvatarForLook(avatar as any)
                  setGenerateLookStep('generate')
                  setShowGenerateLookModal(true)
                }
              } else {
                setGenerateLookStep('select-avatar')
                setSelectedAvatarForLook(null)
                setShowGenerateLookModal(true)
              }
            }}
            onLookClick={(_look, avatar) => {
              setShowLooksModal(avatar as any)
            }}
            generatingLookIds={generatingLookIds}
            loading={loadingLooks}
            avatars={avatars}
          />
        )}
      </div>

      {/* Modals */}
      <AvatarCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateAvatar}
        creating={creating}
      />

      <AIGenerationModal
        isOpen={showGenerateAIModal}
        onClose={() => {
          setShowGenerateAIModal(false)
          setAiGenerationStage('idle')
          setAiGenerationError(null)
        }}
        onGenerate={handleGenerateAI}
        checkingStatus={checkingStatus}
        stage={aiGenerationStage}
        error={aiGenerationError}
      />

      <LookGenerationModal
        isOpen={showGenerateLookModal}
        onClose={() => {
          setShowGenerateLookModal(false)
          setGenerateLookStep('select-avatar')
          setSelectedAvatarForLook(null)
        }}
        avatar={selectedAvatarForLook}
        avatars={avatars}
        step={generateLookStep}
        onSelectAvatar={(avatar) => {
          setSelectedAvatarForLook(avatar as any)
          setGenerateLookStep('generate')
        }}
        onGenerate={handleGenerateLook as any}
        generating={generating}
      />

      <ManageLooksModal
        isOpen={!!showLooksModal && !showAddLooksModal && !showGenerateLookModal}
        onClose={() => {
          setShowLooksModal(null)
        }}
        avatar={showLooksModal}
        looks={showLooksModal ? allLooks.filter((l) => l.avatar.id === showLooksModal.id).map((l) => l.look) : []}
        onUploadLooks={() => {
          setShowAddLooksModal(true)
        }}
        onGenerateLook={() => {
          if (showLooksModal) {
            setSelectedAvatarForLook(showLooksModal as any)
            setGenerateLookStep('generate')
            setShowGenerateLookModal(true)
          }
        }}
        onSetDefaultLook={async (lookId: string) => {
          if (!showLooksModal) return
          await api.post(`/api/avatars/${showLooksModal.id}/set-default-look`, { look_id: lookId })
          await loadAvatars()
          invalidateLooksCache()
        }}
      />

      <AddLooksModal
        isOpen={showAddLooksModal && !!showLooksModal}
        onClose={() => {
          setShowAddLooksModal(false)
          setShowLooksModal(null)
        }}
        avatar={showLooksModal}
        onAdd={handleAddLooks}
        adding={addingLooks}
      />

      <LookSelectionModal
        isOpen={!!lookSelectionModal}
        onClose={() => setLookSelectionModal(null)}
        avatar={lookSelectionModal?.avatar!}
        looks={lookSelectionModal?.looks || []}
        onConfirm={handleLookSelection}
        allowSkip={false}
      />

      <TrainingStatusModal
        isOpen={showTrainingModal}
        onClose={() => {
          if (trainingStatus === 'ready' || trainingStatus === 'failed') {
            setShowTrainingModal(false)
            setTrainingAvatar(null)
            setTrainingStatus(null)
          }
        }}
        avatar={trainingAvatar}
        status={trainingStatus}
        onRefresh={() => {
          if (trainingAvatar) {
            refreshTrainingStatus(trainingAvatar, { silent: false })
          }
        }}
      />
    </Layout>
  )
}
