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
  const [defaultAvatarId, setDefaultAvatarId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [avatarName, setAvatarName] = useState('')
  const MAX_PHOTOS = 5
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [onlyCreated, setOnlyCreated] = useState(true) // Default to showing only user-created avatars
  const [showGenerateAIModal, setShowGenerateAIModal] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [aiGenerationStage, setAiGenerationStage] = useState<AiGenerationStage>('idle')
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null)
  const [showLooksModal, setShowLooksModal] = useState<Avatar | null>(null)
  const [showAddLooksModal, setShowAddLooksModal] = useState(false)
  const [showGenerateLookModal, setShowGenerateLookModal] = useState(false)
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
  }, [])

  const loadAvatars = useCallback(async () => {
    try {
      setLoading(true)
      // Backend expects 'all=true' to show all avatars, default shows only user-created
      const params = onlyCreated ? {} : { all: 'true' }
      const response = await api.get('/api/avatars', { params })
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
  }, [onlyCreated, checkForUnselectedLooks])

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

  const handleSync = async () => {
    setSyncing(true)
    try {
      console.log('Syncing avatars...')
      const response = await api.post('/api/avatars/sync')
      console.log('Sync response:', response.data)
      
      if (response.data.count === 0) {
        toast.error('No avatars found. Please check your API configuration.')
      } else {
        toast.success(`Synced ${response.data.count || 0} avatars`)
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
      
      toast.error(errorMessage + '. Please check your API configuration.')
    } finally {
      setSyncing(false)
    }
  }

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
            if (looks.length > 0) {
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
    if (!showLooksModal || !lookPrompt.trim()) {
      toast.error('Please enter a prompt for the look')
      return
    }

    setGeneratingLook(true)
    try {
      console.log('Generating look with:', {
        group_id: showLooksModal.heygen_avatar_id,
        prompt: lookPrompt,
        orientation: lookOrientation,
        pose: lookPose,
        style: lookStyle,
      })

      const response = await api.post('/api/avatars/generate-look', {
        group_id: showLooksModal.heygen_avatar_id,
        prompt: lookPrompt,
        orientation: lookOrientation,
        pose: lookPose,
        style: lookStyle,
      })

      console.log('Look generation response:', response.data)
      toast.success('Look generation started! This may take a few minutes.')
      setShowGenerateLookModal(false)
      setLookPrompt('')
      setLookPose('close_up')
      setLookStyle('Realistic')
      
      // Refresh looks after a delay to show the new look
      setTimeout(async () => {
        if (showLooksModal) {
          await handleViewDetails(showLooksModal)
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
      <div>
        {avatars.length === 0 ? (
          <div className="p-12 text-center">
            <User className="h-16 w-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {onlyCreated ? 'No avatars created yet' : 'No avatars found'}
            </h3>
            <p className="text-slate-600 mb-6">
              {onlyCreated 
                ? 'Create an avatar from a photo to get started'
                : 'Sync avatars or create one from a photo to get started'}
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
                  Sync Avatars
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {avatars.map((avatar) => (
                <div
                  key={avatar.id}
                  onClick={() => handleViewDetails(avatar)}
                  className="relative flex-shrink-0 w-24 cursor-pointer rounded-lg overflow-hidden transition-all hover:opacity-80"
                >
                  {avatar.thumbnail_url || avatar.preview_url ? (
                    <img
                      src={avatar.thumbnail_url || avatar.preview_url || ''}
                      alt={avatar.avatar_name}
                      className="w-24 h-32 object-contain bg-slate-50 rounded-lg"
                    />
                  ) : (
                    <div className="w-24 h-32 bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center rounded-lg">
                      <User className="h-8 w-8 text-white opacity-50" />
                    </div>
                  )}
                  {avatar.is_default && (
                    <div className="absolute top-1 right-1 bg-brand-500 text-white px-1 py-0.5 rounded text-xs font-semibold flex items-center gap-0.5">
                      <Star className="h-2 w-2 fill-current" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                <div className="rounded-lg bg-brand-50 border border-brand-200 p-4 mb-2">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">AI Avatar Generation:</span> Describe the avatar you want to generate. AI will create a unique avatar based on your detailed description.
                  </p>
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

        {/* Generate Look Modal */}
        <Modal
          isOpen={showGenerateLookModal && !!showLooksModal}
          onClose={() => {
            setShowGenerateLookModal(false)
            setLookPrompt('')
            setLookPose('close_up')
            setLookStyle('Realistic')
          }}
          title="Generate AI Look"
          size="md"
        >
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Generate a new look for this avatar using AI. Describe the look you want to create.
            </p>

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
        </Modal>

        {/* Avatar Details Modal */}
        <Modal
          isOpen={!!detailsModal}
          onClose={handleCloseDetailsModal}
          title={`Avatar Details${detailsModal?.avatar ? ` - ${detailsModal.avatar.avatar_name}` : ''}`}
          size="md"
        >
          {!detailsModal ? null : detailsModal.error ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-red-500 mb-2">
                <X className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Failed to load avatar details</p>
              <p className="text-sm text-slate-600">{detailsModal.error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleViewDetails(detailsModal.avatar)}
                className="mt-4"
                disabled={detailsLoadingId === detailsModal.avatar.id}
              >
                {detailsLoadingId === detailsModal.avatar.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  'Retry'
                )}
              </Button>
            </div>
          ) : detailData ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-4">
                {detailData.image_url || detailData.preview_url ? (
                  <img
                    src={detailData.image_url || detailData.preview_url || ''}
                    alt="Avatar preview"
                    className="w-full sm:w-40 h-40 object-cover rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="w-full sm:w-40 h-40 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="h-12 w-12 text-slate-400" />
                  </div>
                )}
                <dl className="flex-1 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Photo Avatar ID</dt>
                    <dd className="flex items-center gap-1 text-slate-900">
                      <span className="font-mono text-xs">{detailData.id}</span>
                      <button
                        onClick={() => handleCopyToClipboard(detailData.id)}
                        className="text-slate-500 hover:text-slate-900"
                        title="Copy ID"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Group ID</dt>
                    <dd className="flex items-center gap-1 text-slate-900">
                      <span className="font-mono text-xs">{detailData.group_id || '—'}</span>
                      {detailData.group_id && (
                        <button
                          onClick={() => handleCopyToClipboard(detailData.group_id)}
                          className="text-slate-500 hover:text-slate-900"
                          title="Copy Group ID"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Status</dt>
                    <dd>{detailData.status || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Created</dt>
                    <dd>{formatTimestamp(detailData.created_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Updated</dt>
                    <dd>{formatTimestamp(detailData.updated_at)}</dd>
                  </div>
                </dl>
              </div>

              <dl className="space-y-2 text-sm">
                {detailData.image_url && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Image URL</dt>
                    <dd className="text-right">
                      <a
                        href={detailData.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:text-brand-700 text-xs break-all"
                      >
                        Open in new tab
                      </a>
                    </dd>
                  </div>
                )}
                {detailData.preview_url && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Preview URL</dt>
                    <dd className="text-right">
                      <a
                        href={detailData.preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:text-brand-700 text-xs break-all"
                      >
                        Open in new tab
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              {/* Display all looks from the avatar group */}
              {(() => {
                const looks = detailData.looks || []
                console.log('Rendering looks section:', { looksCount: looks.length, looks, detailData })
                if (looks.length === 0) {
                  return (
                    <div className="pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-500 text-center py-4">
                        No looks available. Use "Manage Looks" to add looks to this avatar.
                      </p>
                    </div>
                  )
                }
                return (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">
                        Available Looks ({looks.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Select which look to use for video generation
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      {looks.map((look: PhotoAvatarLook) => (
                      <div
                        key={look.id}
                        className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                          look.is_default
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
                            <User className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-xs font-medium text-slate-900 truncate">
                            {look.name || 'Unnamed Look'}
                          </p>
                          {look.status && (
                            <p className="text-xs text-slate-500 capitalize">{look.status}</p>
                          )}
                        </div>
                        {look.is_default && (
                          <div className="absolute top-2 right-2 bg-brand-500 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                              Selected
                          </div>
                        )}
                        {!look.is_default && (
                            <div className="p-2 pt-0 flex gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSetDefaultLook(detailsModal.avatar.id, look.id)
                              }}
                                className="flex-1 text-xs"
                            >
                              <Star className="h-3 w-3 mr-1" />
                                Select
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (!confirm(`Are you sure you want to delete this look? This action cannot be undone.`)) {
                                    return
                                  }
                                  try {
                                    // Delete look from HeyGen
                                    await api.delete(`/api/avatars/${detailsModal.avatar.id}/looks/${look.id}`)
                                    toast.success('Look deleted successfully')
                                    // Refresh details
                                    if (detailsModal) {
                                      await handleViewDetails(detailsModal.avatar)
                                    }
                                  } catch (error: any) {
                                    console.error('Failed to delete look:', error)
                                    toast.error(error.response?.data?.error || 'Failed to delete look')
                                  }
                                }}
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )
              })()}

              <div className="flex flex-wrap items-center gap-3 justify-end pt-4 border-t border-slate-200">
                {isUserCreatedAvatar(detailsModal.avatar) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleManageLooks(detailsModal.avatar)}
                    className="flex items-center gap-2"
                  >
                    <Image className="h-4 w-4" />
                    Manage Looks
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRefreshTrainingStatus(detailsModal.avatar)}
                  disabled={!!statusLoadingMap[detailsModal.avatar.id]}
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      statusLoadingMap[detailsModal.avatar.id] ? 'animate-spin text-brand-600' : ''
                    }`}
                  />
                  Refresh Status
                </Button>
                <Button
                  onClick={() => handleUpscaleAvatar(detailsModal.avatar)}
                  disabled={upscalingId === detailsModal.avatar.id}
                  className="flex items-center gap-2"
                >
                  <ArrowUpCircle
                    className={`h-4 w-4 ${upscalingId === detailsModal.avatar.id ? 'animate-spin' : ''}`}
                  />
                  {upscalingId === detailsModal.avatar.id ? 'Upscaling...' : 'Request Upscale'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="h-8 w-8 mx-auto text-brand-500 animate-spin" />
              <p className="text-sm text-slate-600">Loading avatar details...</p>
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
              <div className="grid grid-cols-2 gap-4">
                {lookSelectionModal.looks.map((look: PhotoAvatarLook) => (
                  <div
                    key={look.id}
                    onClick={() => setSelectedLookId(look.id)}
                    className={`relative rounded-lg border-2 overflow-hidden transition-all cursor-pointer ${
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
                        <User className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {look.name || 'Unnamed Look'}
                      </p>
                    </div>
                    {selectedLookId === look.id && (
                      <div className="absolute top-2 right-2 bg-brand-500 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <Button
                  onClick={async () => {
                    if (!selectedLookId || !lookSelectionModal) {
                      toast.warning('Please select a look to continue')
                      return
                    }
                    try {
                      await api.post(`/api/avatars/${lookSelectionModal.avatar.id}/set-default-look`, {
                        look_id: selectedLookId,
                      })
                      toast.success('Look selected! This is now your permanent avatar look.')
                      setLookSelectionModal(null)
                      setSelectedLookId(null)
                      await loadAvatars()
                    } catch (error: any) {
                      console.error('Failed to set default look:', error)
                      toast.error(error.response?.data?.error || 'Failed to set default look')
                    }
                  }}
                  disabled={!selectedLookId}
                >
                  Confirm Selection
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  )
}

