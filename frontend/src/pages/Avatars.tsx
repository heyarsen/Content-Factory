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
  Trash2,
  User,
  Upload,
  Plus,
  Sparkles,
  Image,
  X,
  ArrowUpCircle,
  Loader2,
  Copy,
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

interface PhotoAvatarDetails {
  id: string
  group_id?: string
  status?: string
  image_url?: string
  preview_url?: string
  thumbnail_url?: string
  created_at?: number
  updated_at?: number | null
  looks?: PhotoAvatarLook[]
  default_look_id?: string | null
  [key: string]: any
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
  const [statusLoadingMap, setStatusLoadingMap] = useState<Record<string, boolean>>({})
  const [detailsModal, setDetailsModal] = useState<{ avatar: Avatar; data: PhotoAvatarDetails | null; error?: string } | null>(null)
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null)
  const [upscalingId, setUpscalingId] = useState<string | null>(null)
  const [lookSelectionModal, setLookSelectionModal] = useState<{ avatar: Avatar; looks: PhotoAvatarLook[] } | null>(null)
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null)
  const [trainingId, setTrainingId] = useState<string | null>(null)
  const detailData = detailsModal?.data ?? null

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

  const formatTimestamp = (value?: number | string | null) => {
    if (!value) return '—'
    let date: Date
    if (typeof value === 'number') {
      date = new Date(value < 1e12 ? value * 1000 : value)
    } else {
      const numeric = Number(value)
      date = new Date(Number.isFinite(numeric) && numeric > 0 ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(value))
    }
    if (Number.isNaN(date.getTime())) {
      return '—'
    }
    return date.toLocaleString()
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
      setStatusLoadingMap(prev => ({ ...prev, [avatar.id]: true }))
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
      } finally {
        setStatusLoadingMap(prev => {
          const next = { ...prev }
          delete next[avatar.id]
          return next
        })
      }
    },
    []
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

  const handleTriggerTraining = async (avatar: Avatar) => {
    setTrainingId(avatar.id)
    try {
      const response = await api.post(`/api/avatars/${avatar.id}/train`)
      toast.success(response.data.message || 'Training started!')
      
      // Refresh the avatar details
      await handleViewDetails(avatar)
      
      // Also refresh the avatars list
      await loadAvatars()
    } catch (error: any) {
      console.error('Failed to trigger training:', error)
      toast.error(error.response?.data?.error || 'Failed to start training')
    } finally {
      setTrainingId(null)
    }
  }

  const handleViewDetails = async (avatar: Avatar) => {
    console.log('Opening details modal for avatar:', avatar.id)
    setDetailsModal({ avatar, data: null })
    setDetailsLoadingId(avatar.id)
    try {
      console.log('Fetching avatar details from API...')
      const response = await api.get(`/api/avatars/${avatar.id}/details`, {
        timeout: 15000, // 15 second timeout
      })
      console.log('Received avatar details:', response.data)
      console.log('Looks in response:', response.data?.looks, 'Count:', response.data?.looks?.length)
      setDetailsModal({ avatar, data: response.data, error: undefined })
      
      // Update the avatar status in the list if it changed
      const newStatus = response.data?.status
      if (newStatus && newStatus !== avatar.status) {
        console.log(`[Avatar Details] Status changed from ${avatar.status} to ${newStatus}`)
        setAvatars(prev => prev.map(a => 
          a.id === avatar.id ? { ...a, status: newStatus } : a
        ))
      }
    } catch (error: any) {
      console.error('Failed to fetch avatar details:', error)
      console.error('Error response:', error.response)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load avatar details'
      // Set error state so modal shows error instead of loading forever
      setDetailsModal({ avatar, data: null, error: errorMessage })
      toastRef.current.error(errorMessage)
    } finally {
      setDetailsLoadingId(null)
    }
  }

  const handleUpscaleAvatar = async (avatar: Avatar) => {
    setUpscalingId(avatar.id)
    try {
      const response = await api.post(`/api/avatars/${avatar.id}/upscale`)
      toastRef.current.success(response.data?.message || 'Upscale requested successfully')
    } catch (error: any) {
      console.error('Failed to upscale avatar:', error)
      toastRef.current.error(error.response?.data?.error || 'Failed to upscale avatar')
    } finally {
      setUpscalingId(null)
    }
  }

  const handleCloseDetailsModal = () => {
    setDetailsModal(null)
    setDetailsLoadingId(null)
  }

  const handleCopyToClipboard = async (value?: string | null) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toastRef.current.success('Copied to clipboard')
    } catch (error) {
      console.error('Clipboard copy failed:', error)
      toastRef.current.error('Failed to copy')
    }
  }

  const handleSetDefaultLook = async (avatarId: string, lookId: string) => {
    try {
      // Update the default_look_id in the database via API
      await api.post(`/api/avatars/${avatarId}/set-default-look`, { look_id: lookId })
      toast.success('Default look updated successfully!')
      
      // Refresh the details to show updated default look
      if (detailsModal) {
        const response = await api.get(`/api/avatars/${avatarId}/details`)
        setDetailsModal({ ...detailsModal, data: response.data })
      }
    } catch (error: any) {
      console.error('Failed to set default look:', error)
      toast.error(error.response?.data?.error || 'Failed to set default look')
    }
  }

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

  const handleManageLooks = (avatar: Avatar) => {
    setShowLooksModal(avatar)
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
      
      // Refresh avatar details to show new looks
      if (showLooksModal) {
        await handleViewDetails(showLooksModal)
      }
      
      await loadAvatars()
    } catch (error: any) {
      console.error('Failed to add looks:', error)
      toast.error(error.response?.data?.error || 'Failed to add looks')
    } finally {
      setAddingLooks(false)
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
      toast.success('Look generation started! This may take a few minutes.')
      
      // Reset all modal states
      setShowGenerateLookModal(false)
      setGenerateLookStep('select-avatar')
      setSelectedAvatarForLook(null)
      setLookPrompt('')
      setLookPose('close_up')
      setLookStyle('Realistic')
      
      // Refresh looks after a delay to show the new look
      setTimeout(async () => {
        if (targetAvatar) {
          await handleViewDetails(targetAvatar)
        }
      }, 5000)
    } catch (error: any) {
      console.error('Failed to generate look:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      toast.error(error.response?.data?.error || error.message || 'Failed to generate look')
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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'ready':
        return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' }
      case 'training':
        return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Training' }
      case 'pending':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending' }
      case 'generating':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Generating' }
      case 'empty':
        return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Not Trained' }
      case 'failed':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' }
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', label: status }
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-slate-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-slate-200 rounded w-72"></div>
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-slate-200 rounded-xl mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
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
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">Library</p>
            <h1 className="text-2xl font-bold text-slate-900">Avatars</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your AI avatars for video generation
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        {/* Stats Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <span className="text-sm text-slate-500">
            {avatars.length} avatar{avatars.length !== 1 ? 's' : ''} in your library
          </span>
        </div>

        {/* Avatar Grid or Empty State */}
        {avatars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-100 to-indigo-100 flex items-center justify-center mb-6">
              <User className="h-10 w-10 text-brand-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 text-center">
              No avatars yet
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-md mb-6">
              Create your first avatar by uploading a photo or generating one with AI. Your avatars will be optimized for TikTok and vertical video formats.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={() => setShowCreateModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </Button>
              <Button onClick={() => setShowGenerateAIModal(true)} variant="secondary">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Avatar
              </Button>
              <Button 
                onClick={() => {
                  setGenerateLookStep('select-avatar')
                  setSelectedAvatarForLook(null)
                  setShowGenerateLookModal(true)
                }} 
                variant="secondary"
              >
                <Image className="h-4 w-4 mr-2" />
                Generate Look
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {avatars.map((avatar) => {
              const statusBadge = getStatusBadge(avatar.status)
              const isProcessing = ['training', 'pending', 'generating'].includes(avatar.status)
              
              return (
                <div
                  key={avatar.id}
                  onClick={() => handleViewDetails(avatar)}
                  className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-brand-300 hover:-translate-y-0.5"
                >
                  {/* Avatar Image */}
                  <div className="relative aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden">
                    {avatar.thumbnail_url || avatar.preview_url ? (
                      <img
                        src={avatar.thumbnail_url || avatar.preview_url || ''}
                        alt={avatar.avatar_name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-400 to-indigo-500">
                        <User className="h-12 w-12 text-white/70" />
                      </div>
                    )}
                    
                    {/* Processing overlay */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                          <span className="text-xs font-medium text-slate-700">{statusBadge.label}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Default badge */}
                    {avatar.is_default && (
                      <div className="absolute top-2 left-2 bg-brand-500 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-sm">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </div>
                    )}
                    
                    {/* Source badge */}
                    {isUserCreatedAvatar(avatar) && !avatar.is_default && (
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-slate-700 px-2 py-1 rounded-md text-xs font-medium shadow-sm">
                        {avatar.source === 'ai_generated' ? (
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-500" />
                            AI
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Upload className="h-3 w-3 text-brand-500" />
                            Photo
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Quick actions on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                      <span className="text-white text-xs font-medium bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        View Details
                      </span>
                    </div>
                  </div>
                  
                  {/* Avatar Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-slate-900 text-sm truncate mb-1">
                      {avatar.avatar_name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                        {statusBadge.label}
                      </span>
                      {avatar.gender && (
                        <span className="text-xs text-slate-400 capitalize">{avatar.gender}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

        {/* Avatar Details Modal - Redesigned */}
        <Modal
          isOpen={!!detailsModal}
          onClose={handleCloseDetailsModal}
          title={detailsModal?.avatar?.avatar_name || 'Avatar Details'}
          size="lg"
        >
          {!detailsModal ? null : detailsModal.error ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">Failed to load avatar</p>
                <p className="text-sm text-slate-500 mt-1">{detailsModal.error}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => handleViewDetails(detailsModal.avatar)}
                disabled={detailsLoadingId === detailsModal.avatar.id}
              >
                {detailsLoadingId === detailsModal.avatar.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  'Try Again'
                )}
              </Button>
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              {/* Hero Section */}
              <div className="flex gap-6">
                {/* Main Avatar Preview */}
                <div className="w-32 shrink-0">
                  {detailData.image_url || detailData.preview_url ? (
                    <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <img
                        src={detailData.image_url || detailData.preview_url || ''}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center">
                      <User className="h-12 w-12 text-white/70" />
                    </div>
                  )}
                </div>
                
                {/* Avatar Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {detailsModal.avatar.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(detailData.status || 'active').bg} ${getStatusBadge(detailData.status || 'active').text}`}>
                          {getStatusBadge(detailData.status || 'active').label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Created {formatTimestamp(detailData.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRefreshTrainingStatus(detailsModal.avatar)}
                      disabled={!!statusLoadingMap[detailsModal.avatar.id]}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1.5 ${statusLoadingMap[detailsModal.avatar.id] ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    {(detailData.status === 'empty' || detailData.status === 'failed') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleTriggerTraining(detailsModal.avatar)}
                        disabled={trainingId === detailsModal.avatar.id}
                      >
                        <Sparkles className={`h-4 w-4 mr-1.5 ${trainingId === detailsModal.avatar.id ? 'animate-spin' : ''}`} />
                        {trainingId === detailsModal.avatar.id ? 'Starting...' : 'Train Avatar'}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleUpscaleAvatar(detailsModal.avatar)}
                      disabled={upscalingId === detailsModal.avatar.id}
                    >
                      <ArrowUpCircle className={`h-4 w-4 mr-1.5 ${upscalingId === detailsModal.avatar.id ? 'animate-spin' : ''}`} />
                      Upscale
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(detailData.id)}
                    >
                      <Copy className="h-4 w-4 mr-1.5" />
                      Copy ID
                    </Button>
                  </div>
                </div>
              </div>

              {/* Training Warning Banner */}
              {(detailData.status === 'empty' || detailData.status === 'failed') && (
                <div className="border-t border-slate-200 pt-6">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <Sparkles className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-800">
                          {detailData.status === 'failed' ? 'Training Failed' : 'Avatar Not Trained'}
                        </h4>
                        <p className="text-xs text-amber-700 mt-1">
                          {detailData.status === 'failed' 
                            ? 'The avatar training failed. Please try training again.'
                            : 'This avatar needs to be trained before you can generate new looks. Click the "Train Avatar" button above to start training.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Looks Section */}
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Avatar Looks</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Different styles and poses for your avatar
                    </p>
                  </div>
                  {isUserCreatedAvatar(detailsModal.avatar) && detailData.status !== 'empty' && detailData.status !== 'failed' && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          handleManageLooks(detailsModal.avatar)
                          setShowAddLooksModal(true)
                        }}
                      >
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload Look
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          // Skip avatar selection since we're in avatar details
                          setSelectedAvatarForLook(detailsModal.avatar)
                          setGenerateLookStep('generate')
                          handleManageLooks(detailsModal.avatar)
                          setShowGenerateLookModal(true)
                        }}
                      >
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Generate Look
                      </Button>
                    </div>
                  )}
                </div>
                
                {(() => {
                  const looks = detailData.looks || []
                  if (looks.length === 0) {
                    return (
                      <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Image className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-600 mb-1">No looks yet</p>
                        <p className="text-xs text-slate-500 mb-4">
                          Add different looks to customize your avatar&apos;s appearance
                        </p>
                        {isUserCreatedAvatar(detailsModal.avatar) && (
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                handleManageLooks(detailsModal.avatar)
                                setShowAddLooksModal(true)
                              }}
                            >
                              <Upload className="h-4 w-4 mr-1.5" />
                              Upload
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                // Skip avatar selection since we're in avatar details
                                setSelectedAvatarForLook(detailsModal.avatar)
                                setGenerateLookStep('generate')
                                handleManageLooks(detailsModal.avatar)
                                setShowGenerateLookModal(true)
                              }}
                            >
                              <Sparkles className="h-4 w-4 mr-1.5" />
                              Generate with AI
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {looks.map((look: PhotoAvatarLook) => (
                        <div
                          key={look.id}
                          className={`group relative rounded-xl overflow-hidden transition-all cursor-pointer ${
                            look.is_default
                              ? 'ring-2 ring-brand-500 ring-offset-2'
                              : 'border border-slate-200 hover:border-brand-300 hover:shadow-md'
                          }`}
                          onClick={() => {
                            if (!look.is_default) {
                              handleSetDefaultLook(detailsModal.avatar.id, look.id)
                            }
                          }}
                        >
                          {look.thumbnail_url || look.image_url ? (
                            <div className="aspect-[3/4] bg-slate-100">
                              <img
                                src={look.thumbnail_url || look.image_url || ''}
                                alt={look.name || 'Look'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center">
                              <User className="h-8 w-8 text-slate-400" />
                            </div>
                          )}
                          
                          {/* Selected Badge */}
                          {look.is_default && (
                            <div className="absolute top-2 right-2 bg-brand-500 text-white p-1 rounded-full shadow-sm">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                          
                          {/* Hover Overlay */}
                          {!look.is_default && (
                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-medium bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                Set as Active
                              </span>
                            </div>
                          )}
                          
                          {/* Delete Button */}
                          {!look.is_default && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm('Delete this look?')) return
                                try {
                                  await api.delete(`/api/avatars/${detailsModal.avatar.id}/looks/${look.id}`)
                                  toast.success('Look deleted')
                                  await handleViewDetails(detailsModal.avatar)
                                } catch (error: any) {
                                  toast.error(error.response?.data?.error || 'Failed to delete')
                                }
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          
                          {/* Look Name */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 to-transparent p-2 pt-6">
                            <p className="text-xs font-medium text-white truncate">
                              {look.name || 'Look'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="h-10 w-10 mx-auto text-brand-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading avatar details...</p>
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
                      try {
                        console.log('Calling API:', `/api/avatars/${lookSelectionModal.avatar.id}/set-default-look`, { look_id: selectedLookId })
                        const response = await api.post(`/api/avatars/${lookSelectionModal.avatar.id}/set-default-look`, {
                          look_id: selectedLookId,
                        })
                        console.log('Set default look response:', response.data)
                        toast.success('Look selected! This is now your permanent avatar look.')
                        setLookSelectionModal(null)
                        setSelectedLookId(null)
                        await loadAvatars()
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
    </Layout>
  )
}

