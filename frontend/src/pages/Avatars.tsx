import { useState, useEffect, useRef, useCallback } from 'react'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import {
  RefreshCw,
  Star,
  User,
  Upload,
  Plus,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  Circle,
} from 'lucide-react'
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
type AiStageVisualState = 'done' | 'current' | 'pending'

export default function Avatars() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [, setDefaultAvatarId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [avatarName, setAvatarName] = useState('')
  const MAX_PHOTOS = 5
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  // Always show only user-created avatars (removed "All Avatars" option)
  const [showGenerateAIModal, setShowGenerateAIModal] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [aiGenerationStage, setAiGenerationStage] = useState<AiGenerationStage>('idle')
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null)
  const [showLooksModal, setShowLooksModal] = useState<Avatar | null>(null)
  const [showAddLooksModal, setShowAddLooksModal] = useState(false)
  const [showGenerateLookModal, setShowGenerateLookModal] = useState(false)
  const [generateLookStep, setGenerateLookStep] = useState<'select-avatar' | 'generate'>('select-avatar')
  const [selectedAvatarForLook, setSelectedAvatarForLook] = useState<Avatar | null>(null)
  const [addingLooks, setAddingLooks] = useState(false)
  const [generatingLook, setGeneratingLook] = useState(false)
  const [lookImageFiles, setLookImageFiles] = useState<File[]>([])
  const [lookImagePreviews, setLookImagePreviews] = useState<string[]>([])
  const [lookSelectionModal, setLookSelectionModal] = useState<{ avatar: Avatar; looks: PhotoAvatarLook[] } | null>(null)
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null)
  const [selectedAvatarFilter, setSelectedAvatarFilter] = useState<string | null>(null) // null = "All"
  const [quickPrompt, setQuickPrompt] = useState('') // Quick prompt input for generating looks
  const [showTrainingModal, setShowTrainingModal] = useState(false)
  const [trainingAvatar, setTrainingAvatar] = useState<Avatar | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<'training' | 'pending' | 'ready' | 'failed' | null>(null)
  
  // Get all looks from all avatars for the grid display
  const [allLooks, setAllLooks] = useState<Array<{ look: PhotoAvatarLook; avatar: Avatar }>>([])
  const [loadingLooks, setLoadingLooks] = useState(false)
  const [generatingLookIds, setGeneratingLookIds] = useState<Set<string>>(new Set()) // Track avatars with generating looks

  const aiStageFlow: Array<{ key: 'creating' | 'photosReady' | 'completing'; title: string; description: string }> = [
    { key: 'creating', title: 'Generating reference photos', description: 'HeyGen creates a photo set from your description' },
    { key: 'photosReady', title: 'Building the talking photo', description: 'We convert the best look into a HeyGen avatar' },
    { key: 'completing', title: 'Saving to your workspace', description: 'Avatar is synced and ready for video generation' },
  ]
  const aiStageOrder: Array<'creating' | 'photosReady' | 'completing'> = ['creating', 'photosReady', 'completing']
  const aiStageWeights: Record<AiGenerationStage, number> = {
    idle: -1,
    creating: 0,
    photosReady: 1,
    completing: 2,
    completed: 3,
  }
  const getAiStageState = (stageKey: (typeof aiStageOrder)[number]): AiStageVisualState => {
    const currentWeight = aiStageWeights[aiGenerationStage]
    const targetIndex = aiStageOrder.indexOf(stageKey)
    if (currentWeight > targetIndex) return 'done'
    if (currentWeight === targetIndex) return 'current'
    return 'pending'
  }
  
  // AI Generation form fields
  const [aiName, setAiName] = useState('')
  type AIAgeOption = 'Young Adult' | 'Early Middle Age' | 'Late Middle Age' | 'Senior' | 'Unspecified'
  const [aiAge, setAiAge] = useState<AIAgeOption>('Unspecified')
  const [aiGender, setAiGender] = useState<'Man' | 'Woman'>('Man')
  const AI_ETHNICITY_OPTIONS = [
    'Unspecified',
    'White',
    'Black',
    'Asian American',
    'East Asian',
    'South East Asian',
    'South Asian',
    'Middle Eastern',
    'Pacific',
    'Hispanic',
  ] as const
  const [aiEthnicity, setAiEthnicity] = useState<(typeof AI_ETHNICITY_OPTIONS)[number]>('Unspecified')
  // Always use square orientation for AI avatar generation (will be converted to vertical looks)
  const aiOrientation = 'square' as const
  const [aiPose, setAiPose] = useState<'half_body' | 'full_body' | 'close_up'>('close_up')
  const [aiStyle, setAiStyle] = useState<'Realistic' | 'Cartoon' | 'Anime'>('Realistic')
  const [aiAppearance, setAiAppearance] = useState('')
  
  // Generate look form fields
  const [lookPrompt, setLookPrompt] = useState('')
  // Always use vertical orientation for looks
  const lookOrientation = 'vertical' as const
  const [lookPose, setLookPose] = useState<'half_body' | 'full_body' | 'close_up'>('close_up')
  const [lookStyle, setLookStyle] = useState<'Realistic' | 'Cartoon' | 'Anime'>('Realistic')
  
  const createPhotoInputRef = useRef<HTMLInputElement>(null)
  const addLooksInputRef = useRef<HTMLInputElement>(null)
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const trainingStatusIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()
  const toastRef = useRef(toast)
  
  // Update ref when toast changes
  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  // Helper function to check if avatar is user-created
  const isUserCreatedAvatar = (avatar: Avatar): boolean => {
    if (avatar.source === 'user_photo' || avatar.source === 'ai_generated') {
      return true
    }
    if (avatar.source === 'synced') {
      return false
    }
    // Fallback heuristics for older records without source metadata
    if (avatar.avatar_url && avatar.avatar_url.includes('supabase.co/storage')) {
      return true
    }
    if (avatar.status === 'generating') {
      return true
    }
    if (
      (avatar.status === 'training' || avatar.status === 'pending') &&
      (!avatar.avatar_url || !avatar.avatar_url.includes('heygen'))
    ) {
      return true
    }
    if (!avatar.avatar_url && (avatar.status === 'training' || avatar.status === 'pending')) {
      return true
    }
    return false
  }

  const checkForUnselectedLooks = useCallback(async (avatarsList: Avatar[]) => {
    try {
      // Don't check if modal is already open
      if (lookSelectionModal) {
        return
      }

      // Check user-created avatars that don't have a default_look_id
      const userCreatedAvatars = avatarsList.filter(avatar => 
        avatar && isUserCreatedAvatar(avatar) && avatar.status === 'active'
      )

      for (const avatar of userCreatedAvatars) {
        try {
          // Check if avatar has default_look_id in database
          const detailsResponse = await api.get(`/api/avatars/${avatar.id}/details`)
          const looks = detailsResponse.data?.looks || []
          const defaultLookId = detailsResponse.data?.default_look_id

          // If avatar has looks but no default_look_id, show selection modal
          if (looks.length > 0 && !defaultLookId) {
            console.log('Found avatar without selected look:', avatar.id, 'showing selection modal')
            setLookSelectionModal({ avatar, looks })
            return // Only show for first avatar that needs selection
          }
        } catch (error: any) {
          console.error('Failed to check looks for avatar:', avatar.id, error)
          // Continue checking other avatars
        }
      }
    } catch (error: any) {
      console.error('Error in checkForUnselectedLooks:', error)
      // Don't throw - just log the error
    }
  }, [lookSelectionModal])

  const loadAvatars = useCallback(async () => {
    try {
      setLoading(true)
      // Only show user-created avatars
      const response = await api.get('/api/avatars')
      const avatarsList = response.data?.avatars || []
      setAvatars(avatarsList)
      setDefaultAvatarId(response.data?.default_avatar_id || null)
      
      // After loading, check if any avatars need look selection (don't block on errors)
      if (avatarsList.length > 0 && checkForUnselectedLooks) {
        // Run this asynchronously without blocking
        checkForUnselectedLooks(avatarsList).catch(err => {
          console.error('Error checking for unselected looks:', err)
        })
      }
    } catch (error: any) {
      console.error('Failed to load avatars:', error)
      toastRef.current.error(error.response?.data?.error || 'Failed to load avatars')
    } finally {
      setLoading(false)
    }
  }, [checkForUnselectedLooks])

  useEffect(() => {
    loadAvatars()
  }, [loadAvatars])

  // Load all looks for all avatars (for the HeyGen-style grid)
  const loadAllLooks = useCallback(async (avatarsList: Avatar[]) => {
    setLoadingLooks(true)
    const looks: Array<{ look: PhotoAvatarLook; avatar: Avatar }> = []
    
    for (const avatar of avatarsList) {
      try {
        const response = await api.get(`/api/avatars/${avatar.id}/details`)
        // API returns data directly, not wrapped in 'details'
        const details = response.data
        if (details?.looks && Array.isArray(details.looks)) {
          for (const look of details.looks) {
            looks.push({ look, avatar })
          }
        }
      } catch (error) {
        // Silently skip avatars that fail to load
        console.error(`Failed to load looks for avatar ${avatar.id}:`, error)
      }
    }
    
    setAllLooks(looks)
    setLoadingLooks(false)
  }, [])

  // Load looks when avatars change
  useEffect(() => {
    if (avatars.length > 0) {
      loadAllLooks(avatars)
    }
  }, [avatars, loadAllLooks])

  // Cleanup status check interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
      }
      if (trainingStatusIntervalRef.current) {
        clearInterval(trainingStatusIntervalRef.current)
      }
    }
  }, [])


  const handleRefreshTrainingStatus = useCallback(
    async (avatar: Avatar, options: { silent?: boolean } = {}) => {
      if (!avatar) return
      try {
        const response = await api.get(`/api/avatars/training-status/${avatar.heygen_avatar_id}`)
        const status = response.data?.status
        const normalizedStatus = status === 'ready' ? 'active' : status || avatar.status

        setAvatars(prev =>
          prev.map(item =>
            item.id === avatar.id
              ? {
                  ...item,
                  status: normalizedStatus,
                }
              : item
          )
        )

        // Update training modal if this avatar is being tracked
        if (trainingAvatar && trainingAvatar.id === avatar.id) {
          // Convert 'active' to 'ready' for trainingStatus since it only accepts 'training' | 'pending' | 'ready' | 'failed'
          let newStatus: 'training' | 'pending' | 'ready' | 'failed' = 'training'
          if (normalizedStatus === 'active') {
            newStatus = 'ready'
          } else if (['training', 'pending', 'ready', 'failed'].includes(normalizedStatus)) {
            newStatus = normalizedStatus as 'training' | 'pending' | 'ready' | 'failed'
          }
          setTrainingStatus(newStatus)
          setTrainingAvatar(prev => prev ? { ...prev, status: normalizedStatus } : null)
          
          if (newStatus === 'ready') {
            // Training completed, close modal after a short delay
            toast.success('Avatar training completed! Your avatar is now ready to use.')
            setTimeout(() => {
              setShowTrainingModal(false)
              setTrainingAvatar(null)
              setTrainingStatus(null)
            }, 2000)
          }
        }

        if (!options.silent) {
          if (status === 'ready') {
            toastRef.current.success('Avatar training completed!')
          } else {
            toastRef.current.info(`Status updated: ${status}`)
          }
        }
      } catch (error: any) {
        console.error('Failed to refresh training status:', error)
        if (!options.silent) {
          toastRef.current.error(error.response?.data?.error || 'Failed to refresh training status')
        }
      }
    },
    [trainingAvatar]
  )


  useEffect(() => {
    if (trainingStatusIntervalRef.current) {
      clearInterval(trainingStatusIntervalRef.current)
      trainingStatusIntervalRef.current = null
    }

    const avatarsNeedingUpdate = avatars.filter(avatar =>
      ['pending', 'training', 'generating'].includes(avatar.status)
    )

    if (avatarsNeedingUpdate.length === 0) {
        return
      }

    trainingStatusIntervalRef.current = setInterval(() => {
      avatarsNeedingUpdate.forEach(avatar => {
        handleRefreshTrainingStatus(avatar, { silent: true })
      })
    }, 30000)

    return () => {
      if (trainingStatusIntervalRef.current) {
        clearInterval(trainingStatusIntervalRef.current)
        trainingStatusIntervalRef.current = null
      }
    }
  }, [avatars, handleRefreshTrainingStatus])

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) {
        return
      }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10MB`)
        return false
      }
      return true
    })

    if (!validFiles.length) {
        return
      }

    const availableSlots = Math.max(0, MAX_PHOTOS - photoFiles.length)
    if (availableSlots === 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} photos`)
      return
    }

    const filesToAdd = validFiles.slice(0, availableSlots)
    if (filesToAdd.length < validFiles.length) {
      toast.info(`Only the first ${filesToAdd.length} photo(s) were added (max ${MAX_PHOTOS})`)
    }

    try {
      const previews = await Promise.all(filesToAdd.map(fileToDataUrl))
      setPhotoFiles(prev => [...prev, ...filesToAdd])
      setPhotoPreviews(prev => [...prev, ...previews])
    } catch (err: any) {
      toast.error(err.message || 'Failed to process selected photos')
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSetPrimaryPhoto = (index: number) => {
    if (index === 0) return
    setPhotoFiles(prev => {
      const next = [...prev]
      const [selected] = next.splice(index, 1)
      return [selected, ...next]
    })
    setPhotoPreviews(prev => {
      const next = [...prev]
      const [selected] = next.splice(index, 1)
      return [selected, ...next]
    })
  }

  const handleCreateAvatar = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    console.log('handleCreateAvatar called', { avatarName, photoCount: photoFiles.length })
    
    if (!avatarName.trim()) {
      toast.error('Please enter an avatar name')
      return
    }
    if (photoFiles.length === 0) {
      toast.error('Please select at least one photo')
      return
    }

    setCreating(true)
    
    try {
      const base64Photos = await Promise.all(photoFiles.map(fileToDataUrl))
      const [primaryPhoto, ...additionalPhotos] = base64Photos
      
      console.log('Primary photo prepared, sending to API...', { additionalCount: additionalPhotos.length })
      
      // Send to API - upload photo and create avatar
      console.log('Uploading photo and creating avatar...')
      
      // Add timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutes
      
      let response
      try {
        response = await api.post(
          '/api/avatars/upload-photo',
          {
            photo_data: primaryPhoto,
          avatar_name: avatarName,
            additional_photos: additionalPhotos.length ? additionalPhotos : undefined,
          },
          {
          signal: controller.signal,
          }
        )
        
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
        setPhotoFiles([])
        setPhotoPreviews([])
        if (createPhotoInputRef.current) {
          createPhotoInputRef.current.value = ''
        }
        
        // Wait a bit for looks to be created, then show look selection
        setTimeout(async () => {
          try {
            const detailsResponse = await api.get(`/api/avatars/${response.data.avatar.id}/details`)
            const looks = detailsResponse.data?.looks || []
            const defaultLookId = detailsResponse.data?.default_look_id
            
            // Only show modal if there are looks and no default look is set
            if (looks.length > 0 && !defaultLookId) {
              setLookSelectionModal({ avatar: response.data.avatar, looks })
            }
          } catch (err) {
            console.error('Failed to fetch looks for selection:', err)
          }
        }, 3000)
        
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
      setPhotoFiles([])
      setPhotoPreviews([])
      if (createPhotoInputRef.current) {
        createPhotoInputRef.current.value = ''
      }
    }
  }

  const handleGenerateAI = async () => {
  if (!aiName.trim() || !aiAppearance.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setGeneratingAI(true)
    setAiGenerationStage('creating')
    setAiGenerationError(null)
    try {
      const requestedAiName = aiName
      console.log('Sending AI avatar generation request to:', '/api/avatars/generate-ai')
      console.log('Request payload:', {
        name: aiName,
        age: aiAge,
        gender: aiGender,
        ethnicity: aiEthnicity,
        orientation: aiOrientation,
        pose: aiPose,
        style: aiStyle,
        appearance: aiAppearance,
      })
      
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

      console.log('AI avatar generation response:', response.data)
      const genId = response.data.generation_id
      toast.success('AI avatar generation started! This may take a few minutes.')
      
      // Start polling for status
      startStatusCheck(genId, requestedAiName)
    } catch (error: any) {
      console.error('Failed to generate AI avatar - Full error:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        },
      })
      
      let errorMessage = 'Failed to generate AI avatar'
      
      if (error.response?.status === 404) {
        errorMessage = error.response?.data?.error || 
          'AI avatar generation endpoint not found (404). Please check if the feature is available.'
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
      setGeneratingAI(false)
      setAiGenerationStage('idle')
      setAiGenerationError(errorMessage)
    }
  }

  const startStatusCheck = (genId: string, avatarNameOverride?: string) => {
    setCheckingStatus(true)
    setAiGenerationStage('creating')
    setAiGenerationError(null)
    
    // Check status every 5 seconds
    statusCheckIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/api/avatars/generation-status/${genId}`)
        const status = response.data
        
        if (status.status === 'success') {
          setAiGenerationStage('photosReady')
          // Generation complete - create avatar group
          if (statusCheckIntervalRef.current) {
            clearInterval(statusCheckIntervalRef.current)
            statusCheckIntervalRef.current = null
          }
          
          if (status.image_key_list && status.image_key_list.length > 0) {
            try {
              setAiGenerationStage('completing')
                await api.post('/api/avatars/complete-ai-generation', {
                generation_id: genId,
                image_keys: status.image_key_list,
                image_urls: status.image_url_list,
                avatar_name: avatarNameOverride || aiName,
              })
              
                setAiGenerationStage('completed')
                toast.success('AI avatar created successfully!')
                setShowGenerateAIModal(false)
                resetAIGenerationForm()
                await loadAvatars()
            } catch (err: any) {
              console.error('Failed to complete AI avatar:', err)
              setAiGenerationStage('idle')
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
          const failureMessage = status.msg || 'Avatar generation failed'
          toast.error(failureMessage)
          setAiGenerationError(failureMessage)
          setAiGenerationStage('idle')
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
    setAiAge('Unspecified')
    setAiGender('Man')
    setAiEthnicity('Unspecified')
    setAiPose('close_up')
    setAiStyle('Realistic')
    setAiAppearance('')
    setAiGenerationStage('idle')
    setAiGenerationError(null)
  }

  const handleCloseGenerateAIModal = () => {
    if (!generatingAI && !checkingStatus) {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
      setShowGenerateAIModal(false)
      resetAIGenerationForm()
    } else {
      setShowGenerateAIModal(false)
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
      setCheckingStatus(false)
      setGeneratingAI(false)
      setAiGenerationStage('idle')
      setAiGenerationError(null)
      resetAIGenerationForm()
    }
  }

  const handleAddLooks = async () => {
    if (!showLooksModal || lookImageFiles.length === 0) {
      toast.error('Please select at least one image')
      return
    }

    setAddingLooks(true)
    try {
      // Upload images and get image_keys
      const imageKeys: string[] = []
      for (const file of lookImageFiles) {
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
          reader.readAsDataURL(file)
        })

        // Upload to HeyGen via backend endpoint
        // The backend will handle uploading to HeyGen and return image_key
        const uploadResponse = await api.post('/api/avatars/upload-look-image', {
          photo_data: base64Data,
        })
        imageKeys.push(uploadResponse.data.image_key)
      }

      // Add looks to avatar group
      await api.post('/api/avatars/add-looks', {
        group_id: showLooksModal.heygen_avatar_id,
        image_keys: imageKeys,
        name: showLooksModal.avatar_name,
      })

      toast.success('Looks added successfully!')
      setShowAddLooksModal(false)
      setLookImageFiles([])
      setLookImagePreviews([])
      
      // Refresh avatars and looks
      await loadAvatars()
    } catch (error: any) {
      console.error('Failed to add looks:', error)
      toast.error(error.response?.data?.error || 'Failed to add looks')
    } finally {
      setAddingLooks(false)
    }
  }

  // Poll for look generation status
  const pollLookGenerationStatus = async (generationId: string, avatarId: string, attempt = 1, maxAttempts = 60) => {
    if (attempt > maxAttempts) {
      console.error('Look generation polling timeout')
      setGeneratingLookIds(prev => {
        const next = new Set(prev)
        next.delete(avatarId)
        return next
      })
      toast.error('Look generation is taking longer than expected. Please check back later or refresh the page.')
      return
    }

    try {
      const response = await api.get(`/api/avatars/generation-status/${generationId}`)
      const status = response.data?.status

      if (status === 'success') {
        // Generation complete, refresh looks
        setGeneratingLookIds(prev => {
          const next = new Set(prev)
          next.delete(avatarId)
          return next
        })
        toast.success('Look generation completed!')
        // Refresh avatars first, then looks will be refreshed via useEffect
        await loadAvatars()
      } else if (status === 'failed') {
        setGeneratingLookIds(prev => {
          const next = new Set(prev)
          next.delete(avatarId)
          return next
        })
        toast.error('Look generation failed')
      } else if (status === 'in_progress') {
        // Still generating, poll again after delay
        setTimeout(() => {
          pollLookGenerationStatus(generationId, avatarId, attempt + 1, maxAttempts)
        }, 5000) // Poll every 5 seconds
      }
    } catch (error: any) {
      console.error('Failed to check generation status:', error)
      // For 502 errors or network issues, continue polling (these are temporary)
      // For other errors, also continue but log them
      if (error.response?.status === 502 || error.code === 'ECONNRESET' || error.message?.includes('Bad Gateway')) {
        // Temporary server issue, continue polling
        setTimeout(() => {
          pollLookGenerationStatus(generationId, avatarId, attempt + 1, maxAttempts)
        }, 5000)
      } else if (attempt < maxAttempts) {
        // Other errors, continue polling but with longer delay
        setTimeout(() => {
          pollLookGenerationStatus(generationId, avatarId, attempt + 1, maxAttempts)
        }, 10000) // Wait 10 seconds on error
      } else {
        // Max attempts reached
        setGeneratingLookIds(prev => {
          const next = new Set(prev)
          next.delete(avatarId)
          return next
        })
        toast.error('Unable to check generation status. Please refresh the page to see if looks were generated.')
      }
    }
  }

  // Quick generate look from bottom prompt bar
  const handleQuickGenerateLook = async () => {
    if (!selectedAvatarFilter || !quickPrompt.trim()) {
      toast.error('Please select an avatar and enter a prompt')
      return
    }

    const targetAvatar = avatars.find(a => a.id === selectedAvatarFilter)
    if (!targetAvatar) {
      toast.error('Avatar not found')
      return
    }

    // Check if avatar is trained
    if (targetAvatar.status !== 'active' && targetAvatar.status !== 'ready') {
      toast.error('Avatar must be trained before generating looks. Please train the avatar first.')
      return
    }

    setGeneratingLook(true)
    try {
      const response = await api.post('/api/avatars/generate-look', {
        group_id: targetAvatar.heygen_avatar_id,
        prompt: quickPrompt.trim(),
        orientation: 'vertical',
        pose: 'half_body',
        style: 'Realistic',
      })

      console.log('Quick look generation response:', response.data)
      const generationId = response.data?.generation_id
      
      if (generationId) {
        // Mark this avatar as generating
        setGeneratingLookIds(prev => new Set(prev).add(targetAvatar.id))
        
        // Start polling for generation status
        pollLookGenerationStatus(generationId, targetAvatar.id)
      }
      
      toast.success('Look generation started! This may take a few minutes.')
      
      // Clear the prompt
      setQuickPrompt('')
    } catch (error: any) {
      console.error('Failed to generate look:', error)
      // Remove from generating state on error
      setGeneratingLookIds(prev => {
        const next = new Set(prev)
        next.delete(targetAvatar.id)
        return next
      })
      
      // Handle specific error types
      const errorData = error.response?.data
      const errorCode = errorData?.code || errorData?.error?.code
      const errorMessage = errorData?.error?.message || errorData?.error || errorData?.message || error.message
      
      if (errorCode === 'insufficient_credit' || errorMessage?.includes('Insufficient credit')) {
        toast.error('Insufficient credit. Please add credits to your HeyGen account to generate looks.')
      } else if (errorData?.error) {
        toast.error(typeof errorData.error === 'string' ? errorData.error : (errorData.error.message || 'Failed to generate look'))
      } else if (error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.')
      } else {
        toast.error(errorMessage || 'Failed to generate look')
      }
    } finally {
      setGeneratingLook(false)
    }
  }

  const handleGenerateLook = async () => {
    // Use selectedAvatarForLook (from the new flow) or fall back to showLooksModal
    const targetAvatar = selectedAvatarForLook || showLooksModal
    
    if (!targetAvatar || !lookPrompt.trim()) {
      toast.error('Please select an avatar and enter a prompt for the look')
      return
    }

    setGeneratingLook(true)
    try {
      console.log('Generating look with:', {
        group_id: targetAvatar.heygen_avatar_id,
        prompt: lookPrompt,
        orientation: lookOrientation,
        pose: lookPose,
        style: lookStyle,
      })

      const response = await api.post('/api/avatars/generate-look', {
        group_id: targetAvatar.heygen_avatar_id,
        prompt: lookPrompt,
        orientation: lookOrientation,
        pose: lookPose,
        style: lookStyle,
      })

      console.log('Look generation response:', response.data)
      const generationId = response.data?.generation_id
      
      if (generationId) {
        // Mark this avatar as generating
        setGeneratingLookIds(prev => new Set(prev).add(targetAvatar.id))
        
        // Start polling for generation status
        pollLookGenerationStatus(generationId, targetAvatar.id)
      }
      
      toast.success('Look generation started! This may take a few minutes.')
      
      // Reset all modal states
      setShowGenerateLookModal(false)
      setGenerateLookStep('select-avatar')
      setSelectedAvatarForLook(null)
      setLookPrompt('')
      setLookPose('close_up')
      setLookStyle('Realistic')
    } catch (error: any) {
      console.error('Failed to generate look:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      // Remove from generating state on error
      if (targetAvatar) {
        setGeneratingLookIds(prev => {
          const next = new Set(prev)
          next.delete(targetAvatar.id)
          return next
        })
      }
      
      // Handle specific error types
      const errorData = error.response?.data
      const errorCode = errorData?.code || errorData?.error?.code
      const errorMessage = errorData?.error?.message || errorData?.error || errorData?.message || error.message
      
      if (errorCode === 'insufficient_credit' || errorMessage?.includes('Insufficient credit')) {
        toast.error('Insufficient credit. Please add credits to your HeyGen account to generate looks.')
      } else if (errorData?.error) {
        toast.error(typeof errorData.error === 'string' ? errorData.error : (errorData.error.message || 'Failed to generate look'))
      } else if (error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.')
      } else {
        toast.error(errorMessage || 'Failed to generate look')
      }
    } finally {
      setGeneratingLook(false)
    }
  }

  const handleLookFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10MB`)
        return false
      }
      return true
    })

    setLookImageFiles(prev => [...prev, ...validFiles])
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          setLookImagePreviews(prev => [...prev, reader.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // Get status badge styling
  // Filter looks based on selected avatar
  const filteredLooks = selectedAvatarFilter 
    ? allLooks.filter(item => item.avatar.id === selectedAvatarFilter)
    : allLooks
  
  // Count how many more avatars beyond the visible ones
  const visibleAvatarCount = 7
  const extraAvatarsCount = Math.max(0, avatars.length - visibleAvatarCount)

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          {/* Avatar selector skeleton */}
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-20 h-20 rounded-xl bg-slate-200 animate-pulse"></div>
                <div className="h-3 w-12 bg-slate-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
          {/* Grid skeleton */}
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
      <div className="space-y-6">
        {/* HeyGen-style Avatar Selector */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* "All" button */}
          <button
            onClick={() => setSelectedAvatarFilter(null)}
            className={`flex flex-col items-center gap-2 flex-shrink-0 group transition-all duration-200`}
          >
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
              selectedAvatarFilter === null 
                ? 'border-cyan-400 bg-white shadow-lg shadow-cyan-100' 
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
              <span className={`text-sm font-semibold ${
                selectedAvatarFilter === null ? 'text-slate-900' : 'text-slate-600'
              }`}>All</span>
          </div>
          </button>
          
          {/* Avatar rounded squares */}
          {avatars.slice(0, visibleAvatarCount).map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => setSelectedAvatarFilter(avatar.id === selectedAvatarFilter ? null : avatar.id)}
              className="flex flex-col items-center gap-2 flex-shrink-0 group transition-all duration-200"
            >
              <div className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                selectedAvatarFilter === avatar.id 
                  ? 'border-cyan-400 shadow-lg shadow-cyan-100' 
                  : 'border-transparent hover:border-slate-300'
              }`}>
                {avatar.thumbnail_url || avatar.preview_url ? (
                  <img
                    src={avatar.thumbnail_url || avatar.preview_url || ''}
                    alt={avatar.avatar_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400">
                    <User className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium max-w-[72px] truncate ${
                selectedAvatarFilter === avatar.id ? 'text-slate-900' : 'text-slate-600'
              }`}>
                {avatar.avatar_name}
              </span>
            </button>
          ))}
          
          {/* Create Avatar button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex flex-col items-center gap-2 flex-shrink-0 group transition-all duration-200"
          >
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-dashed border-cyan-300 hover:border-cyan-400 hover:from-cyan-100 hover:to-blue-100 flex items-center justify-center transition-all duration-200">
              <Plus className="h-8 w-8 text-cyan-600" />
            </div>
            <span className="text-xs font-medium max-w-[72px] truncate text-slate-600">
              Create Avatar
            </span>
          </button>
          
          {/* "+N more" button */}
          {extraAvatarsCount > 0 && (
            <button
              onClick={() => {
                // Show a modal or expand to show all avatars
                // For now, just cycle through or show first hidden avatar
                const hiddenAvatars = avatars.slice(visibleAvatarCount)
                if (hiddenAvatars.length > 0) {
                  setSelectedAvatarFilter(hiddenAvatars[0].id)
                }
              }}
              className="flex flex-col items-center gap-2 flex-shrink-0 group"
            >
              <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center border-2 border-transparent hover:border-slate-600 transition-all duration-200">
                <span className="text-white font-semibold">+{extraAvatarsCount}</span>
              </div>
            </button>
          )}
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">
            {selectedAvatarFilter ? `${avatars.find(a => a.id === selectedAvatarFilter)?.avatar_name}'s looks` : 'All avatar looks'}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowGenerateAIModal(true)}
              variant="secondary"
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {/* Create new card */}
            <button
              onClick={() => {
                if (selectedAvatarFilter) {
                  // Generate look for selected avatar
                  const avatar = avatars.find(a => a.id === selectedAvatarFilter)
                  if (avatar) {
                    setSelectedAvatarForLook(avatar)
                    setGenerateLookStep('generate')
                    setShowGenerateLookModal(true)
                  }
                } else {
                  // Show avatar selection first
                  setGenerateLookStep('select-avatar')
                  setSelectedAvatarForLook(null)
                  setShowGenerateLookModal(true)
                }
              }}
              className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-300 hover:from-slate-100 hover:to-slate-150 flex flex-col items-center justify-center gap-3 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700">Create new</span>
            </button>
            
            {/* Generating indicators */}
            {Array.from(generatingLookIds)
              .filter(avatarId => !selectedAvatarFilter || avatarId === selectedAvatarFilter)
              .map(avatarId => {
                const avatar = avatars.find(a => a.id === avatarId)
                if (!avatar) return null
              return (
                <div
                    key={`generating-${avatarId}`}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 flex flex-col items-center justify-center gap-3"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                    <div className="text-center px-4">
                      <p className="text-sm font-medium text-slate-700">Generating...</p>
                      <p className="text-xs text-slate-500 mt-1">{avatar.avatar_name}</p>
                    </div>
                  </div>
                )
              })}
            
            {/* Look cards */}
            {loadingLooks ? (
              // Loading skeleton for looks
              [1, 2, 3].map(i => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse"></div>
              ))
            ) : filteredLooks.length === 0 && avatars.length > 0 ? (
              // No looks yet for this avatar
              <div className="col-span-full flex flex-col items-center justify-center py-12">
                <p className="text-sm text-slate-500 mb-4">No looks yet for this avatar</p>
                <Button 
                  onClick={() => {
                    const avatar = selectedAvatarFilter 
                      ? avatars.find(a => a.id === selectedAvatarFilter)
                      : avatars[0]
                    if (avatar) {
                      setSelectedAvatarForLook(avatar)
                      setGenerateLookStep('generate')
                      setShowGenerateLookModal(true)
                    }
                  }}
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Look
                </Button>
              </div>
            ) : (
              filteredLooks.map(({ look, avatar }) => (
                <div
                  key={`${avatar.id}-${look.id}`}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 hover:shadow-xl transition-all duration-300"
                >
                  {look.image_url || look.preview_url || look.thumbnail_url ? (
                      <img
                      src={look.image_url || look.preview_url || look.thumbnail_url || ''}
                      alt={look.name || avatar.avatar_name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                      <User className="h-12 w-12 text-slate-400" />
                      </div>
                    )}
                    
                  {/* Default look indicator */}
                  {look.is_default && (
                    <div className="absolute top-3 right-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                        <Star className="h-4 w-4 text-white fill-current" />
                        </div>
                      </div>
                    )}
                    
                  {/* Look name and avatar name at bottom */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8">
                    <p className="text-white text-sm font-medium truncate">
                      {look.name || 'Look'}
                    </p>
                    <p className="text-white/70 text-xs truncate mt-0.5">
                      {avatar.avatar_name}
                    </p>
                      </div>
                </div>
              ))
                        )}
                      </div>
                    )}
                    
        {/* Bottom prompt bar (HeyGen style) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          {selectedAvatarFilter ? (
            // Show input field when avatar is selected
            <div className="bg-white rounded-full shadow-2xl border border-slate-200 px-4 py-2 flex items-center gap-3 max-w-2xl w-full">
              {(() => {
                const selectedAvatar = avatars.find(a => a.id === selectedAvatarFilter)
                return selectedAvatar ? (
                  <>
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border-2 border-slate-200">
                      {selectedAvatar.thumbnail_url || selectedAvatar.avatar_url ? (
                        <img
                          src={selectedAvatar.thumbnail_url || selectedAvatar.avatar_url || ''}
                          alt={selectedAvatar.avatar_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                      </div>
                    )}
                    </div>
                    <input
                      type="text"
                      value={quickPrompt}
                      onChange={(e) => setQuickPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleQuickGenerateLook()
                        }
                      }}
                      placeholder="Describe the look you'd like to generate..."
                      className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                      disabled={generatingLook}
                    />
                    <button
                      onClick={handleQuickGenerateLook}
                      disabled={!quickPrompt.trim() || generatingLook}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0 hover:from-cyan-500 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingLook ? (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                    </button>
                  </>
                ) : null
              })()}
                    </div>
          ) : (
            // Show default prompt when no avatar is selected
            <div className="bg-white rounded-full shadow-2xl border border-slate-200 px-5 py-3 flex items-center gap-4 max-w-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-white" />
                  </div>
              <p className="text-sm text-slate-600 flex-1">
                Choose an identity to customize with new styles and scenes
              </p>
              <button 
                onClick={() => {
                  setGenerateLookStep('select-avatar')
                  setSelectedAvatarForLook(null)
                  setShowGenerateLookModal(true)
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
          </div>
        )}
        </div>
      </div>

      {/* Create Avatar Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          title="Create Avatar from Photo"
          size="md"
        >
          <div className="space-y-6">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Upload a front-facing photo to create a personalized avatar for your videos.
              </p>
            </div>

            <Input
              label="Avatar Name"
              value={avatarName}
              onChange={(e) => setAvatarName(e.target.value)}
              placeholder="Enter avatar name (e.g., Professional Business Person)"
              disabled={creating}
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Photos * (upload 1–5 best shots)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Front-facing, good lighting, no heavy filters. Add multiple angles to improve training success.
              </p>
              {photoPreviews.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {photoPreviews.map((preview, index) => (
                      <div key={`${preview}-${index}`} className="relative rounded-lg border-2 border-slate-200 overflow-hidden">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute top-2 left-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${index === 0 ? 'bg-brand-500 text-white' : 'bg-white/90 text-slate-700'}`}>
                            {index === 0 ? 'Primary' : 'Secondary'}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1">
                          {index !== 0 && (
                            <button
                              onClick={() => handleSetPrimaryPhoto(index)}
                              className="rounded-full bg-white/90 text-slate-700 hover:bg-brand-50 px-2 py-1 text-xs font-medium"
                            >
                              Make Primary
                            </button>
                          )}
                          <button
                            onClick={() => handleRemovePhoto(index)}
                            className="rounded-full bg-red-500 text-white hover:bg-red-600 p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => createPhotoInputRef.current?.click()}
                    disabled={creating}
                  >
                    Add More Photos
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => createPhotoInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-500 transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600 mb-1">
                    Click to upload your best photo
                  </p>
                  <p className="text-xs text-slate-500">
                    PNG/JPG up to 10MB each. You can add more after the first upload.
                  </p>
                </div>
              )}
                  <input
                ref={createPhotoInputRef}
                    type="file"
                    accept="image/*"
                multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={creating}
                  />
              <p className="mt-2 text-xs text-slate-500">
                We upload your photo to HeyGen exactly as provided—no automatic cropping or enhancement is applied.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Don&apos;t have a usable photo?</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowGenerateAIModal(true)
                  }}
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Generate an AI avatar instead
                </button>
                </div>
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
                    hasFile: photoFiles.length > 0,
                    avatarName,
                    photoCount: photoFiles.length
                  })
                  handleCreateAvatar(e).catch((err) => {
                    console.error('Error in handleCreateAvatar:', err)
                  })
                }}
                disabled={creating || !avatarName.trim() || photoFiles.length === 0}
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
          size="md"
        >
          <div className="space-y-6">
            {checkingStatus ? (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <RefreshCw className="h-10 w-10 mx-auto text-brand-500 animate-spin mb-3" />
                  <p className="text-lg font-semibold text-slate-900 mb-1">
                  Generating your avatar...
                </p>
                <p className="text-sm text-slate-600">
                    This runs in the background—you can close this window and we&apos;ll keep working.
                  </p>
                  {aiGenerationError && (
                    <p className="mt-3 text-sm text-red-600">
                      {aiGenerationError}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {aiStageFlow.map(({ key, title, description }) => {
                    const state = getAiStageState(key)
                    const colorClasses =
                      state === 'done'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : state === 'current'
                          ? 'border-brand-200 bg-brand-50 text-brand-900'
                          : 'border-slate-200 bg-white text-slate-600'
                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${colorClasses}`}
                      >
                        <div className="mt-0.5">
                          {state === 'done' && <CheckCircle2 className="h-4 w-4" />}
                          {state === 'current' && <Loader2 className="h-4 w-4 animate-spin" />}
                          {state === 'pending' && <Circle className="h-4 w-4 text-slate-300" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{title}</p>
                          <p className="mt-1 text-xs text-slate-600">{description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200 p-4 mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">Optimized for TikTok & Vertical Video</p>
                      <p className="text-xs text-slate-600">
                        Your AI avatar will be generated in vertical format (9:16), perfect for TikTok, Instagram Reels, and YouTube Shorts.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
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
                      { value: 'Early Middle Age', label: 'Early Middle Age' },
                      { value: 'Late Middle Age', label: 'Late Middle Age' },
                      { value: 'Senior', label: 'Senior' },
                      { value: 'Unspecified', label: 'Unspecified' },
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

                  <Select
                    label="Ethnicity *"
                    value={aiEthnicity}
                    onChange={(e) => setAiEthnicity(e.target.value as (typeof AI_ETHNICITY_OPTIONS)[number])}
                    options={AI_ETHNICITY_OPTIONS.map(value => ({ value, label: value }))}
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
                <p className="text-xs text-slate-500">
                  Tip: include outfit, camera framing, vibe (e.g., &ldquo;vertical close-up, confident smile, soft office lighting&rdquo;).
                </p>

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

        {/* Manage Looks Modal */}
        <Modal
          isOpen={!!showLooksModal}
          onClose={() => {
            setShowLooksModal(null)
            setShowAddLooksModal(false)
            setShowGenerateLookModal(false)
          }}
          title={`Manage Looks - ${showLooksModal?.avatar_name || ''}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Add new looks to this avatar by uploading photos or generating them with AI.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowAddLooksModal(true)
                  setShowGenerateLookModal(false)
                }}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Looks
              </Button>
              <Button
                onClick={() => {
                  // Skip avatar selection since we already have an avatar selected
                  if (showLooksModal) {
                    setSelectedAvatarForLook(showLooksModal)
                    setGenerateLookStep('generate')
                  }
                  setShowGenerateLookModal(true)
                  setShowAddLooksModal(false)
                }}
                variant="secondary"
                className="flex-1"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Look
              </Button>
            </div>
          </div>
        </Modal>

        {/* Add Looks Modal */}
        <Modal
          isOpen={showAddLooksModal && !!showLooksModal}
          onClose={() => {
            setShowAddLooksModal(false)
            setLookImageFiles([])
            setLookImagePreviews([])
          }}
          title="Add Looks to Avatar"
          size="md"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Upload Photos *
              </label>
              {lookImagePreviews.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {lookImagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <div
                          className="rounded-lg border-2 border-slate-200 overflow-hidden"
                          style={{ aspectRatio: '9 / 16' }}
                        >
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => {
                            setLookImageFiles(lookImageFiles.filter((_, i) => i !== index))
                            setLookImagePreviews(lookImagePreviews.filter((_, i) => i !== index))
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addLooksInputRef.current?.click()}
                    disabled={addingLooks}
                  >
                    Add More Photos
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => addLooksInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-500 transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600 mb-1">
                    Click to upload photos
                  </p>
                  <p className="text-xs text-slate-500">
                    PNG, JPG up to 10MB. You can upload multiple photos.
                  </p>
                </div>
              )}
              <input
                ref={addLooksInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleLookFileSelect}
                className="hidden"
                disabled={addingLooks}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddLooksModal(false)
                  setLookImageFiles([])
                  setLookImagePreviews([])
                }}
                disabled={addingLooks}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddLooks}
                disabled={addingLooks || lookImageFiles.length === 0}
                loading={addingLooks}
              >
                {addingLooks ? 'Adding Looks...' : 'Add Looks'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Generate Look Modal - Two Step Flow */}
        <Modal
          isOpen={showGenerateLookModal}
          onClose={() => {
            setShowGenerateLookModal(false)
            setGenerateLookStep('select-avatar')
            setSelectedAvatarForLook(null)
            setLookPrompt('')
            setLookPose('close_up')
            setLookStyle('Realistic')
          }}
          title={generateLookStep === 'select-avatar' ? 'Select Avatar' : 'Generate AI Look'}
          size={generateLookStep === 'select-avatar' ? 'xl' : 'md'}
        >
          {generateLookStep === 'select-avatar' ? (
            /* Step 1: Select Avatar */
            <div className="space-y-4">
            <p className="text-sm text-slate-600">
                Choose an avatar to generate a new look for. Only trained avatars can have new looks generated.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                {avatars
                  .filter(avatar => avatar.status === 'active')
                  .map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => {
                        setSelectedAvatarForLook(avatar)
                        setShowLooksModal(avatar)
                        setGenerateLookStep('generate')
                      }}
                      className="relative rounded-xl border-2 border-slate-200 bg-white p-3 transition-all hover:scale-105 hover:border-brand-300 hover:shadow-md text-left"
                    >
                      {avatar.thumbnail_url || avatar.preview_url ? (
                        <img
                          src={avatar.thumbnail_url || avatar.preview_url || ''}
                          alt={avatar.avatar_name}
                          className="w-full aspect-[3/4] object-cover rounded-lg mb-2 bg-slate-50"
                        />
                      ) : (
                        <div className="w-full aspect-[3/4] bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center mb-2">
                          <User className="h-12 w-12 text-white opacity-50" />
                        </div>
                      )}
                      <p className="text-xs font-medium text-slate-700 truncate text-center">
                        {avatar.avatar_name}
                      </p>
                    </button>
                  ))}
              </div>

              {avatars.filter(avatar => avatar.status === 'active').length === 0 && (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-1">No trained avatars available</p>
                  <p className="text-xs text-slate-500">
                    Train an avatar first before generating looks
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowGenerateLookModal(false)
                    setGenerateLookStep('select-avatar')
                    setSelectedAvatarForLook(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* Step 2: Generate Look Form (Avatar is locked) */
            <div className="space-y-6">
              {/* Selected Avatar Display - Locked, no option to change */}
              {selectedAvatarForLook && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {selectedAvatarForLook.thumbnail_url || selectedAvatarForLook.preview_url ? (
                    <img
                      src={selectedAvatarForLook.thumbnail_url || selectedAvatarForLook.preview_url || ''}
                      alt={selectedAvatarForLook.avatar_name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center">
                      <User className="h-6 w-6 text-white opacity-50" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{selectedAvatarForLook.avatar_name}</p>
                    <p className="text-xs text-slate-500">Selected avatar</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              )}

            <Textarea
              label="Look Description *"
              value={lookPrompt}
              onChange={(e) => setLookPrompt(e.target.value)}
              placeholder="e.g., Professional business suit, formal attire, confident expression"
              rows={4}
              disabled={generatingLook}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Pose *"
                value={lookPose}
                onChange={(e) => setLookPose(e.target.value as any)}
                options={[
                  { value: 'close_up', label: 'Close Up' },
                  { value: 'half_body', label: 'Half Body' },
                  { value: 'full_body', label: 'Full Body' },
                ]}
                disabled={generatingLook}
              />

              <Select
                label="Style *"
                value={lookStyle}
                onChange={(e) => setLookStyle(e.target.value as any)}
                options={[
                  { value: 'Realistic', label: 'Realistic' },
                  { value: 'Cartoon', label: 'Cartoon' },
                  { value: 'Anime', label: 'Anime' },
                ]}
                disabled={generatingLook}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowGenerateLookModal(false)
                    setGenerateLookStep('select-avatar')
                    setSelectedAvatarForLook(null)
                  setLookPrompt('')
                  setLookPose('close_up')
                  setLookStyle('Realistic')
                }}
                disabled={generatingLook}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateLook}
                disabled={generatingLook || !lookPrompt.trim()}
                loading={generatingLook}
              >
                {generatingLook ? 'Generating...' : 'Generate Look'}
              </Button>
            </div>
            </div>
          )}
        </Modal>

        {/* Look Selection Modal - shown after avatar creation or when returning to platform */}
        <Modal
          isOpen={!!lookSelectionModal}
          onClose={() => {
            // Prevent closing without selecting - user must choose a look
            if (!selectedLookId) {
              toast.warning('Please select a look to continue. This selection is required.')
              return
            }
            setLookSelectionModal(null)
            setSelectedLookId(null)
          }}
          title="Choose Your Avatar Look"
          size="lg"
          closeOnOverlayClick={false}
          showCloseButton={false}
        >
          {lookSelectionModal && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Select the look you want to use for this avatar. This choice is permanent and cannot be changed later.
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {lookSelectionModal.looks.map((look: PhotoAvatarLook) => (
                  <div
                    key={look.id}
                    onClick={() => setSelectedLookId(look.id)}
                    className={`relative flex-shrink-0 w-32 rounded-lg border-2 overflow-hidden transition-all cursor-pointer ${
                      selectedLookId === look.id
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-slate-200 bg-white hover:border-brand-300'
                    }`}
                  >
                    {look.thumbnail_url || look.image_url ? (
                      <div className="w-full aspect-[9/16] bg-slate-50 flex items-center justify-center overflow-hidden">
                        <img
                          src={look.thumbnail_url || look.image_url || ''}
                          alt={look.name || 'Look'}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-[9/16] bg-slate-100 flex items-center justify-center">
                        <User className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {look.name || 'Unnamed Look'}
                      </p>
                    </div>
                    {selectedLookId === look.id && (
                      <div className="absolute top-1.5 right-1.5 bg-brand-500 text-white px-1.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('Confirm Selection button clicked', { selectedLookId, lookSelectionModal })
                    if (!selectedLookId || !lookSelectionModal) {
                      toast.warning('Please select a look to continue')
                      return
                    }
                    // Use async IIFE to handle the API call
                    (async () => {
                      if (!lookSelectionModal) return
                      
                      const avatarToProcess = lookSelectionModal.avatar
                      const avatarIdToTrain = avatarToProcess.id
                      
                      try {
                        console.log('Calling API:', `/api/avatars/${avatarIdToTrain}/set-default-look`, { look_id: selectedLookId })
                        const response = await api.post(`/api/avatars/${avatarIdToTrain}/set-default-look`, {
                          look_id: selectedLookId,
                        })
                        console.log('Set default look response:', response.data)
                        toast.success('Look selected! Starting avatar training...')
                        
                        setLookSelectionModal(null)
                        setSelectedLookId(null)
                        await loadAvatars()
                        
                        // Auto-trigger training after look selection
                        try {
                          const trainResponse = await api.post(`/api/avatars/${avatarIdToTrain}/train`)
                          console.log('Train avatar response:', trainResponse.data)
                          
                          // Reload avatars to get updated status
                          await loadAvatars()
                          
                          // Get the updated avatar from the fresh load
                          const avatarResponse = await api.get('/api/avatars')
                          const updatedAvatar = avatarResponse.data.avatars.find((a: Avatar) => a.id === avatarIdToTrain)
                          
                          if (updatedAvatar) {
                            // Use status from trainResponse if available, otherwise use updatedAvatar status, default to 'training'
                            const responseStatus = trainResponse.data?.status
                            const avatarStatus = updatedAvatar.status
                            const newStatus = responseStatus === 'ready' ? 'active' : (responseStatus || avatarStatus || 'training')
                            const avatarToTrain = { ...updatedAvatar, status: newStatus }
                            
                            // Update avatar in state
                            setAvatars(prev =>
                              prev.map(item =>
                                item.id === avatarIdToTrain ? avatarToTrain : item
                              )
                            )
                            
                            // Set training modal state
                            // Convert 'active' to 'ready' for trainingStatus since it only accepts 'training' | 'pending' | 'ready' | 'failed'
                            let trainingStatusValue: 'training' | 'pending' | 'ready' | 'failed' = 'training'
                            if (newStatus === 'active') {
                              trainingStatusValue = 'ready'
                            } else if (['training', 'pending', 'ready', 'failed'].includes(newStatus)) {
                              trainingStatusValue = newStatus as 'training' | 'pending' | 'ready' | 'failed'
                            }
                            console.log('Setting training modal:', { newStatus, trainingStatusValue, avatarToTrain })
                            setTrainingAvatar(avatarToTrain)
                            setTrainingStatus(trainingStatusValue)
                            setShowTrainingModal(true)
                            
                            // If already ready, close modal after short delay
                            if (trainingStatusValue === 'ready') {
                              setTimeout(() => {
                                setShowTrainingModal(false)
                                setTrainingAvatar(null)
                                setTrainingStatus(null)
                              }, 2000)
                            }
                          } else {
                            // If avatar not found, still show modal with training status
                            // Find the avatar from current state as fallback
                            const currentAvatar = avatars.find(a => a.id === avatarIdToTrain)
                            if (currentAvatar) {
                              const responseStatus = trainResponse.data?.status || 'training'
                              const newStatus = responseStatus === 'ready' ? 'active' : responseStatus
                              let trainingStatusValue: 'training' | 'pending' | 'ready' | 'failed' = 'training'
                              if (newStatus === 'active') {
                                trainingStatusValue = 'ready'
                              } else if (['training', 'pending', 'ready', 'failed'].includes(newStatus)) {
                                trainingStatusValue = newStatus as 'training' | 'pending' | 'ready' | 'failed'
                              }
                              console.log('Setting training modal (fallback):', { newStatus, trainingStatusValue, currentAvatar })
                              const avatarToTrain = { ...currentAvatar, status: newStatus }
                              setTrainingAvatar(avatarToTrain)
                              setTrainingStatus(trainingStatusValue)
                              setShowTrainingModal(true)
                            } else {
                              console.error('Avatar not found for training modal:', avatarIdToTrain)
                            }
                          }
                        } catch (trainError: any) {
                          console.error('Failed to start training:', trainError)
                          // If training fails, still show success for look selection
                          if (trainError.response?.data?.message) {
                            toast.info(trainError.response.data.message)
                          } else {
                            toast.warning('Look selected, but training could not be started automatically. You can train it manually later.')
                          }
                        }
                      } catch (error: any) {
                        console.error('Failed to set default look:', error)
                        console.error('Error details:', {
                          message: error.message,
                          response: error.response?.data,
                          status: error.response?.status,
                          url: error.config?.url,
                        })
                        toast.error(error.response?.data?.error || error.message || 'Failed to set default look')
                      }
                    })()
                  }}
                  disabled={!selectedLookId}
                  type="button"
                >
                  Confirm Selection
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Training Status Modal */}
        <Modal
          isOpen={showTrainingModal}
          onClose={() => {
            // Only allow closing if training is complete
            if (trainingStatus === 'ready') {
              setShowTrainingModal(false)
              setTrainingAvatar(null)
              setTrainingStatus(null)
            }
          }}
          title="Avatar Training in Progress"
          size="md"
          closeOnOverlayClick={trainingStatus === 'ready'}
          showCloseButton={trainingStatus === 'ready'}
        >
          {trainingAvatar && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl overflow-hidden border-2 border-slate-200">
                  {trainingAvatar.thumbnail_url || trainingAvatar.preview_url ? (
                    <img
                      src={trainingAvatar.thumbnail_url || trainingAvatar.preview_url || ''}
                      alt={trainingAvatar.avatar_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400">
                      <User className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  {trainingAvatar.avatar_name}
                </h3>
              </div>

              <div className="space-y-4">
                {trainingStatus === 'training' || trainingStatus === 'pending' ? (
                  <>
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
                      <p className="text-base font-medium text-slate-900">
                        Training your avatar...
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 text-center">
                      This process typically takes a few minutes. Your avatar will be ready to use once training completes.
                    </p>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 text-center">
                        You can close this window - training will continue in the background. You'll be notified when it's ready.
                      </p>
                    </div>
                  </>
                ) : trainingStatus === 'ready' ? (
                  <>
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      <p className="text-base font-medium text-slate-900">
                        Training completed!
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 text-center">
                      Your avatar is now ready to use for video generation.
                    </p>
                  </>
                ) : trainingStatus === 'failed' ? (
                  <>
                    <div className="flex items-center justify-center gap-3">
                      <X className="h-6 w-6 text-red-500" />
                      <p className="text-base font-medium text-slate-900">
                        Training failed
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 text-center">
                      There was an error during training. Please try training again manually.
                    </p>
                  </>
                ) : null}
              </div>

              {trainingStatus === 'ready' && (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <Button
                    onClick={() => {
                      setShowTrainingModal(false)
                      setTrainingAvatar(null)
                      setTrainingStatus(null)
                      loadAvatars()
                    }}
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal>
    </Layout>
  )
}

