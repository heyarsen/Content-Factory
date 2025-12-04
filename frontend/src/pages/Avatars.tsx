import { useCallback, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { AvatarWorkspaceProvider, useAvatarWorkspace } from '../contexts/AvatarWorkspaceContext'
import { AvatarWorkspace } from '../components/avatars/workspace/AvatarWorkspace'
import { useAvatarWorkspaceState } from '../hooks/avatars/useAvatarWorkspace'
import { useContextPanel } from '../hooks/avatars/useContextPanel'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { handleError, formatSpecificError } from '../lib/errorHandler'
import { Avatar, PhotoAvatarLook } from '../types/avatar'
import { AIGenerationModal } from '../components/avatars/AIGenerationModal'

function AvatarsContent() {
  const { toast } = useToast()
  const { selectedAvatarId, setSelectedAvatarId } = useAvatarWorkspace()
  const panel = useContextPanel()
  
  // Tab state: 'my-avatars' or 'public-avatars'
  const [activeTab, setActiveTab] = useState<'my-avatars' | 'public-avatars'>('my-avatars')
  const [publicAvatars, setPublicAvatars] = useState<Avatar[]>([])
  const [loadingPublicAvatars, setLoadingPublicAvatars] = useState(false)
  
  // AI Generation state (kept as modal for now)
  const [showGenerateAIModal, setShowGenerateAIModal] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [aiGenerationStage, setAiGenerationStage] = useState<'idle' | 'creating' | 'photosReady' | 'completing' | 'completed'>('idle')
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null)
  const [aiGenerationPhotos, setAiGenerationPhotos] = useState<Array<{ url: string; key: string }>>([])
  const [aiSelectedPhotoIndex, setAiSelectedPhotoIndex] = useState<number | null>(null)
  const [aiGenerationId, setAiGenerationId] = useState<string | null>(null)
  const [aiConfirmingPhoto, setAiConfirmingPhoto] = useState(false)
  const [aiRequestName, setAiRequestName] = useState<string | null>(null)

  const {
    avatars,
    allLooks,
    loading,
    loadingLooks,
    loadAvatars,
    invalidateLooksCache,
    addAvatar,
    generateLook,
    generating,
    generatingLookIds,
  } = useAvatarWorkspaceState(selectedAvatarId)

  // Load public avatars
  const loadPublicAvatars = useCallback(async () => {
    try {
      setLoadingPublicAvatars(true)
      const response = await api.get('/api/avatars?public=true')
      const publicAvatarsList = response.data?.avatars || []
      
      // Convert HeyGen avatar format to our Avatar format
      const normalizedAvatars: Avatar[] = publicAvatarsList.map((avatar: any) => ({
        id: avatar.avatar_id, // Use HeyGen avatar_id as our id
        user_id: '', // Public avatars don't have a user_id
        heygen_avatar_id: avatar.avatar_id,
        avatar_name: avatar.avatar_name || 'Unnamed Avatar',
        avatar_url: avatar.avatar_url || null,
        preview_url: avatar.preview_url || avatar.avatar_url || null,
        thumbnail_url: avatar.thumbnail_url || avatar.avatar_url || null,
        gender: avatar.gender || null,
        status: avatar.status || 'active',
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: null,
      }))
      
      setPublicAvatars(normalizedAvatars)
      console.log('[Public Avatars] Loaded', normalizedAvatars.length, 'public avatars')
    } catch (error: any) {
      console.error('[Public Avatars] Failed to load public avatars:', error)
      handleError(error, {
        showToast: true,
        logError: true,
      })
      toast.error('Failed to load public avatars')
    } finally {
      setLoadingPublicAvatars(false)
    }
  }, [toast])

  // Load public avatars when switching to public tab
  const handleTabChange = useCallback((tab: 'my-avatars' | 'public-avatars') => {
    setActiveTab(tab)
    if (tab === 'public-avatars' && publicAvatars.length === 0) {
      loadPublicAvatars()
    }
    // Clear selection when switching tabs
    setSelectedAvatarId(null)
  }, [publicAvatars.length, loadPublicAvatars, setSelectedAvatarId])

  // Handle avatar creation
  const handleCreateAvatar = useCallback(async (data: { avatarName: string; photoFiles: File[] }) => {
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

      // Add the avatar immediately to state so it shows up right away
      if (response.data?.avatar) {
        addAvatar(response.data.avatar)
      }

      toast.success('Avatar created successfully!')
      panel.closePanel()
      // Also refresh the list to ensure we have the latest data
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
    }
  }, [toast, loadAvatars, invalidateLooksCache, panel])

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
    setAiGenerationPhotos([])
    setAiSelectedPhotoIndex(null)
    setAiGenerationId(null)
    setAiRequestName(data.name)

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

      setAiGenerationId(generationId)
      
      // Poll for completion with timeout and better error handling
      let attempts = 0
      const maxAttempts = 120 // 10 minutes (120 * 5 seconds = 600 seconds)
      
      const checkStatus = async () => {
        attempts++
        
        try {
          const statusResponse = await api.get(`/api/avatars/generation-status/${generationId}`)
          const status = statusResponse.data?.status
          const imageUrls: string[] = statusResponse.data?.image_url_list || []
          const imageKeys: string[] = statusResponse.data?.image_key_list || []

          if (status === 'success') {
            setCheckingStatus(false)
            const photos = imageUrls
              .slice(0, 4)
              .map((url, index) => ({
                url,
                key: imageKeys[index] || '',
              }))
              .filter(photo => photo.url && photo.key)

            if (!photos.length) {
              throw new Error('Generation succeeded but no photos were returned')
            }

            setAiGenerationPhotos(photos)
            setAiSelectedPhotoIndex(0)
            setAiGenerationStage('photosReady')
            toast.success('AI photos generated. Please choose one to create your avatar.')
            return
          } else if (status === 'failed') {
            setCheckingStatus(false)
            const errorMsg = statusResponse.data?.msg || 'AI generation failed'
            setAiGenerationError(errorMsg)
            handleError(new Error(errorMsg), {
              showToast: true,
              logError: true,
            })
            return
          }
          
          // Continue polling if still in progress and under max attempts
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000)
          } else {
            setCheckingStatus(false)
            setAiGenerationError('Generation is taking longer than expected. The avatar will appear once ready. Please refresh the page to check status.')
            toast.info('Generation is taking longer than expected. Please check back later or refresh the page.')
          }
        } catch (error: any) {
          // On error, continue polling unless it's a permanent failure
          console.error('[AI Generation] Status check error:', error)
          
          // If it's a 404 or we've tried many times, stop polling
          if (error.response?.status === 404 || attempts >= 10) {
            setCheckingStatus(false)
            setAiGenerationError(error.message || 'Failed to check generation status. The avatar may still be processing.')
            handleError(error, { showToast: true, logError: true })
            return
          }
          
          // Temporary error - continue polling (but don't poll forever)
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000)
          } else {
            setCheckingStatus(false)
            setAiGenerationError('Failed to check generation status after multiple attempts. Please refresh the page.')
            handleError(error, { showToast: true, logError: true })
          }
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

  const handleConfirmAIPhoto = useCallback(async () => {
    try {
      if (
        aiGenerationId === null ||
        aiSelectedPhotoIndex === null ||
        !aiGenerationPhotos[aiSelectedPhotoIndex]
      ) {
        setAiGenerationError('Please select a photo first.')
        return
      }

      const selected = aiGenerationPhotos[aiSelectedPhotoIndex]
      const avatarName = aiRequestName || 'AI Avatar'

      setAiConfirmingPhoto(true)

      const completeResponse = await api.post('/api/avatars/complete-ai-generation', {
        generation_id: aiGenerationId,
        image_keys: [selected.key],
        avatar_name: avatarName,
        image_urls: [selected.url],
      })

      const newAvatar: Avatar | undefined = completeResponse.data?.avatar

      if (newAvatar) {
        // Add to state immediately so it shows up right away
        addAvatar(newAvatar)
        
        // Start training automatically (user requested this)
        try {
          await api.post(`/api/avatars/${newAvatar.id}/train`)
          toast.success('Avatar created and training started! This may take a few minutes.')
        } catch (trainError: any) {
          console.error('Failed to start training automatically:', trainError)
          toast.error('Avatar created, but failed to start training automatically. Please start training manually.')
        }

        // Refresh immediately and again after a delay to ensure it shows up
        await loadAvatars()
        invalidateLooksCache()
        
        // Also refresh after a short delay to catch any backend processing
        setTimeout(async () => {
          await loadAvatars()
        }, 2000)
      } else {
        // If no avatar in response, refresh to see if it appears
        await loadAvatars()
        invalidateLooksCache()
        
        // Try again after delay
        setTimeout(async () => {
          await loadAvatars()
        }, 2000)
      }

      setAiGenerationStage('completed')
      setShowGenerateAIModal(false)
      setAiGenerationPhotos([])
      setAiSelectedPhotoIndex(null)
      setAiGenerationId(null)
      setAiRequestName(null)
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      setAiGenerationError(errorMessage)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setAiConfirmingPhoto(false)
    }
  }, [
    aiGenerationId,
    aiSelectedPhotoIndex,
    aiGenerationPhotos,
    aiRequestName,
    addAvatar,
    loadAvatars,
    invalidateLooksCache,
    toast,
  ])

  // Handle look generation
  const handleGenerateLook = useCallback(async (data: {
    avatar: Avatar
    prompt: string
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
  }) => {
    await generateLook(data)
    panel.closePanel()
  }, [generateLook, panel])

  // Quick generate from prompt bar
  const handleQuickGenerate = useCallback(async (prompt: string) => {
    if (!selectedAvatarId) return
    
    const avatar = avatars.find(a => a.id === selectedAvatarId)
    if (!avatar) return

    await handleGenerateLook({
      avatar,
      prompt,
      pose: 'close_up',
      style: 'Realistic',
    })
  }, [selectedAvatarId, avatars, handleGenerateLook])

  // Handle look click
  const handleLookClick = useCallback((look: any, avatar: Avatar) => {
    panel.openLookDetails(look, avatar)
  }, [panel])

  // Handle adding public avatar to user's list
  const handleAddPublicAvatar = useCallback(async (avatar: Avatar) => {
    try {
      const response = await api.post('/api/avatars/public', {
        heygen_avatar_id: avatar.heygen_avatar_id,
        avatar_name: avatar.avatar_name,
        avatar_url: avatar.avatar_url,
      })
      const newAvatar = response.data?.avatar as Avatar | undefined

      toast.success(`Added "${avatar.avatar_name}" to your avatars!`)

      // Switch to my avatars tab, reload, and select the new avatar so looks view opens
      setActiveTab('my-avatars')
      await loadAvatars()
      if (newAvatar?.id) {
        setSelectedAvatarId(newAvatar.id)
      }
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage || 'Failed to add public avatar')
    }
  }, [toast, loadAvatars, setSelectedAvatarId])

  // Handle add motion to look
  const [addingMotionLookIds, setAddingMotionLookIds] = useState<Set<string>>(new Set())
  const handleAddMotion = useCallback(async (look: PhotoAvatarLook, avatar: Avatar) => {
    if (addingMotionLookIds.has(look.id)) return
    
    try {
      setAddingMotionLookIds(prev => new Set(prev).add(look.id))
      await api.post(`/api/avatars/${avatar.id}/looks/${look.id}/add-motion`, {
        motion_type: 'expressive',
        prompt: 'Full body motion with expressive hand gestures, natural head movements, engaging body language, waving, pointing, and emphasis gestures throughout',
      })
      toast.success('Motion added successfully to look!')
      invalidateLooksCache()
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, {
        showToast: true,
        logError: true,
        customMessage: errorMessage,
      })
      toast.error(errorMessage || 'Failed to add motion to look')
    } finally {
      setAddingMotionLookIds(prev => {
        const next = new Set(prev)
        next.delete(look.id)
        return next
      })
    }
  }, [toast, invalidateLooksCache, addingMotionLookIds])

  // Handle train avatar
  const [trainingAvatarId, setTrainingAvatarId] = useState<string | null>(null)
  const handleTrainAvatar = useCallback(async (avatar: Avatar) => {
    try {
      setTrainingAvatarId(avatar.id)
      await api.post(`/api/avatars/${avatar.id}/train`)
      toast.success('Avatar training started! This may take a few minutes.')
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
      setTrainingAvatarId(null)
    }
  }, [toast, loadAvatars, invalidateLooksCache])

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

  // Determine which avatars to show based on active tab
  const displayedAvatars = activeTab === 'public-avatars' ? publicAvatars : avatars
  const displayedLoading = activeTab === 'public-avatars' ? loadingPublicAvatars : loading

  return (
    <Layout>
      <div className="h-[calc(100vh-12rem)] flex flex-col">
        {/* Tab Toggle */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <button
            onClick={() => handleTabChange('my-avatars')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'my-avatars'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            My Avatars
          </button>
          <button
            onClick={() => handleTabChange('public-avatars')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'public-avatars'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Public Avatars
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <AvatarWorkspace
            avatars={displayedAvatars}
            loading={displayedLoading}
            allLooks={activeTab === 'my-avatars' ? allLooks : []} // Public avatars don't have looks
            loadingLooks={activeTab === 'my-avatars' ? loadingLooks : false}
            selectedAvatarId={selectedAvatarId}
            onSelectAvatar={setSelectedAvatarId}
            onCreateAvatarClick={() => panel.openCreateAvatar()}
            onCreateAvatar={handleCreateAvatar}
            onGenerateLook={handleGenerateLook}
            onLookClick={handleLookClick}
            onAddMotion={handleAddMotion}
            onQuickGenerate={handleQuickGenerate}
            onGenerateAIClick={() => setShowGenerateAIModal(true)}
            onAvatarClick={(avatar) => {
              if (activeTab === 'public-avatars') {
                // For public avatars, show option to add to user's list
                handleAddPublicAvatar(avatar)
              } else {
                // For user avatars, open details panel
                panel.openAvatarDetails(avatar)
                setSelectedAvatarId(avatar.id)
              }
            }}
            onTrainAvatar={activeTab === 'my-avatars' ? handleTrainAvatar : undefined}
            trainingAvatarId={trainingAvatarId}
            generating={generating}
            generatingLookIds={generatingLookIds}
            addingMotionLookIds={addingMotionLookIds}
            isPublicAvatars={activeTab === 'public-avatars'}
          />
        </div>
      </div>

      {/* AI Generation Modal (kept as modal for complex flow) */}
      <AIGenerationModal
        isOpen={showGenerateAIModal}
        onClose={() => {
          setShowGenerateAIModal(false)
          setAiGenerationStage('idle')
          setAiGenerationError(null)
          setAiGenerationPhotos([])
          setAiSelectedPhotoIndex(null)
          setAiGenerationId(null)
        }}
        onGenerate={handleGenerateAI}
        checkingStatus={checkingStatus}
        stage={aiGenerationStage}
        error={aiGenerationError}
        photos={aiGenerationPhotos}
        selectedIndex={aiSelectedPhotoIndex}
        onSelectPhoto={setAiSelectedPhotoIndex}
        onConfirmPhoto={handleConfirmAIPhoto}
        confirmingPhoto={aiConfirmingPhoto}
      />
    </Layout>
  )
}

export default function Avatars() {
  return (
    <AvatarWorkspaceProvider>
      <AvatarsContent />
    </AvatarWorkspaceProvider>
  )
}

