import { useCallback, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { AvatarWorkspaceProvider, useAvatarWorkspace } from '../contexts/AvatarWorkspaceContext'
import { AvatarWorkspace } from '../components/avatars/workspace/AvatarWorkspace'
import { useAvatarWorkspaceState } from '../hooks/avatars/useAvatarWorkspace'
import { useContextPanel } from '../hooks/avatars/useContextPanel'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { handleError, formatSpecificError } from '../lib/errorHandler'
import { Avatar } from '../types/avatar'
import { AIGenerationModal } from '../components/avatars/AIGenerationModal'

function AvatarsContent() {
  const { toast } = useToast()
  const { selectedAvatarId, setSelectedAvatarId } = useAvatarWorkspace()
  const panel = useContextPanel()
  
  // AI Generation state (kept as modal for now)
  const [showGenerateAIModal, setShowGenerateAIModal] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [aiGenerationStage, setAiGenerationStage] = useState<'idle' | 'creating' | 'photosReady' | 'completing' | 'completed'>('idle')
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null)

  const {
    avatars,
    allLooks,
    loading,
    loadingLooks,
    loadAvatars,
    invalidateLooksCache,
    generateLook,
    generating,
    generatingLookIds,
  } = useAvatarWorkspaceState(selectedAvatarId)

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

      await api.post('/api/avatars/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success('Avatar created successfully!')
      panel.closePanel()
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

  return (
    <Layout>
      <div className="h-[calc(100vh-12rem)]">
        <AvatarWorkspace
          avatars={avatars}
          loading={loading}
          allLooks={allLooks}
          loadingLooks={loadingLooks}
          selectedAvatarId={selectedAvatarId}
          onSelectAvatar={setSelectedAvatarId}
          onCreateAvatarClick={() => panel.openCreateAvatar()}
          onCreateAvatar={handleCreateAvatar}
          onGenerateLook={handleGenerateLook}
          onLookClick={handleLookClick}
          onQuickGenerate={handleQuickGenerate}
          generating={generating}
          generatingLookIds={generatingLookIds}
        />
      </div>

      {/* AI Generation Modal (kept as modal for complex flow) */}
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

