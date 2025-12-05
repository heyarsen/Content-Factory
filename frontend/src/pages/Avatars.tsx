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
import { AvatarImage } from '../components/avatars/AvatarImage'
import { Button } from '../components/ui/Button'

function AvatarsContent() {
  const { toast } = useToast()
  const { selectedAvatarId, setSelectedAvatarId } = useAvatarWorkspace()
  const panel = useContextPanel()
  
  // Tab state: 'my-avatars' or 'public-avatars'
  const [activeTab, setActiveTab] = useState<'my-avatars' | 'public-avatars'>('my-avatars')
  const [publicAvatars, setPublicAvatars] = useState<Avatar[]>([])
  const [loadingPublicAvatars, setLoadingPublicAvatars] = useState(false)
  const [publicAvatarGroups, setPublicAvatarGroups] = useState<
    Array<{ id: string; name: string; avatars: Avatar[]; categories: string[] }>
  >([])
  const [selectedPublicGroupId, setSelectedPublicGroupId] = useState<string | null>(null)
  const [publicSearch, setPublicSearch] = useState('')
  const [publicCategories, setPublicCategories] = useState<string[]>(['All'])
  const [selectedPublicCategory, setSelectedPublicCategory] = useState<string>('All')
  
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

  // Helper to derive a base name for grouping public avatars (e.g. "Abigail Office Front" -> "Abigail", "Silvia" -> "Silvia")
  const getPublicAvatarBaseName = (name: string): string => {
    if (!name) return 'Unknown'
    // Try multiple strategies to extract base name:
    // 1. Cut off at first '(' or '-' if present
    // 2. Use first word if it's a simple name like "Silvia"
    // 3. Otherwise use first word before common separators
    const bracketIndex = name.indexOf('(')
    const dashIndex = name.indexOf('-')
    let endIndex = -1
    if (bracketIndex >= 0 && dashIndex >= 0) {
      endIndex = Math.min(bracketIndex, dashIndex)
    } else if (bracketIndex >= 0) {
      endIndex = bracketIndex
    } else if (dashIndex >= 0) {
      endIndex = dashIndex
    }
    
    let raw = endIndex > 0 ? name.slice(0, endIndex) : name
    raw = raw.trim()
    
    // If the name is simple (one or two words), use it as-is
    const words = raw.split(' ')
    if (words.length <= 2) {
      // Check if second word is a common descriptor (Office, Sofa, etc.)
      const descriptors = ['office', 'sofa', 'front', 'side', 'upper', 'body', 'full', 'half', 'close']
      if (words.length === 2 && descriptors.includes(words[1].toLowerCase())) {
        return words[0] // Just use first word
      }
      return raw // Use both words for names like "Santa Claus"
    }
    
    // For longer names, use first word
    return words[0] || raw || 'Unknown'
  }

  // Load public avatars
  const loadPublicAvatars = useCallback(async () => {
    try {
      setLoadingPublicAvatars(true)
      const response = await api.get('/api/avatars?public=true')
      const publicAvatarsList = response.data?.avatars || []
      
      // Convert HeyGen avatar format to our Avatar format
      const normalizedAvatars: Avatar[] = publicAvatarsList.map((avatar: any) => {
        // Use tags from HeyGen API (backend extracts tags and puts them in both tags and categories fields)
        // Priority: tags field > categories field
        const tags = Array.isArray(avatar.tags) && avatar.tags.length > 0
          ? avatar.tags
          : (Array.isArray(avatar.categories) && avatar.categories.length > 0 ? avatar.categories : [])
        
        const base: Avatar = {
          id: avatar.avatar_id, // Use HeyGen avatar_id as our id
          heygen_avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name || 'Unnamed Avatar',
          avatar_url: avatar.avatar_url || null,
          preview_url: avatar.preview_url || avatar.preview_image_url || avatar.avatar_url || null,
          thumbnail_url: avatar.thumbnail_url || avatar.preview_image_url || avatar.avatar_url || null,
          gender: avatar.gender || null,
          status: avatar.status || 'active',
          is_default: false,
          created_at: new Date().toISOString(),
          source: null,
          categories: tags.length > 0 ? tags : null,
        }
        return base
      })
      
      console.log('[Public Avatars] Sample avatar tags:', normalizedAvatars.slice(0, 3).map(a => ({
        name: a.avatar_name,
        tags: a.categories,
      })))
      
      setPublicAvatars(normalizedAvatars)

      // Group public avatars by base name so sidebar shows one entry per character
      const groupMap = new Map<string, { id: string; name: string; avatars: Avatar[]; categories: string[] }>()
      for (const avatar of normalizedAvatars) {
        const baseName = getPublicAvatarBaseName(avatar.avatar_name)
        const key = baseName.toLowerCase()
        let group = groupMap.get(key)
        if (!group) {
          group = { id: key, name: baseName, avatars: [], categories: [] }
          groupMap.set(key, group)
        }
        group.avatars.push(avatar)
        if (avatar.categories) {
          for (const c of avatar.categories) {
            if (c && !group.categories.includes(c)) {
              group.categories.push(c)
            }
          }
        }
      }

      // Map HeyGen tags to user-friendly category names
      const tagToCategoryMap: Record<string, string> = {
        'NEW': 'New',
        'AVATAR_IV': 'Avatar IV',
        'PREMIUM': 'Premium',
        'PROFESSIONAL': 'Professional',
        'LIFESTYLE': 'Lifestyle',
        'UGC': 'UGC',
        'COMMUNITY': 'Community',
        // Add more mappings as needed based on actual HeyGen tags
      }
      
      // Ensure each group has exactly ONE category for filtering
      const fallbackCategories = ['Professional', 'Lifestyle', 'UGC', 'Community', 'Favorites']
      const groupsArray = Array.from(groupMap.values())

      // Assign exactly ONE category per group
      groupsArray.forEach((group, index) => {
        if (group.categories.length === 0) {
          // No tags/categories from HeyGen, use fallback
          const cat = fallbackCategories[index % fallbackCategories.length]
          group.categories = [cat]
          group.avatars.forEach((avatar) => {
            avatar.categories = [cat]
          })
        } else {
          // Has tags from HeyGen - map them to user-friendly category names
          // Try to find a mapped category, otherwise use the first tag as-is
          let primaryCategory: string | null = null
          for (const tag of group.categories) {
            const mapped = tagToCategoryMap[tag.toUpperCase()]
            if (mapped) {
              primaryCategory = mapped
              break
            }
          }
          
          // If no mapping found, use the first tag as category name (capitalize it nicely)
          if (!primaryCategory) {
            const firstTag = group.categories[0]
            // Convert "AVATAR_IV" to "Avatar IV", "NEW" to "New", etc.
            primaryCategory = firstTag
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
          }
          
          group.categories = [primaryCategory]
        }
      })

      // Build category list from groups
      const categorySet = new Set<string>()
      groupsArray.forEach((group) => {
        group.categories.forEach((c) => {
          if (c && c.trim()) categorySet.add(c.trim())
        })
      })
      const derivedCategories = Array.from(categorySet)
      setPublicCategories(['All', ...derivedCategories])
      setSelectedPublicCategory('All')

      const groups = groupsArray.sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      setPublicAvatarGroups(groups)
      // Select first group by default
      if (groups.length > 0) {
        setSelectedPublicGroupId(groups[0].id)
      }

      console.log('[Public Avatars] Loaded', normalizedAvatars.length, 'avatar looks/variants in', groups.length, 'avatar groups')
      console.log('[Public Avatars] Sample groups:', groups.slice(0, 5).map(g => ({ name: g.name, looks: g.avatars.length })))
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
          {activeTab === 'public-avatars' ? (
            // Public avatars view: grid of avatars, then looks for a selected avatar
            <div className="flex flex-col h-full">
              {/* Search + categories row */}
              <div className="mb-4 flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Search avatars..."
                  value={publicSearch}
                  onChange={(e) => setPublicSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <div className="flex flex-wrap gap-2">
                  {publicCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedPublicCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedPublicCategory === cat
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 min-h-0">
                {selectedPublicGroupId === null ? (
                  // Avatar grid (like HeyGen gallery)
                  <>
                    {loadingPublicAvatars ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div
                            key={i}
                            className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {publicAvatarGroups
                          .filter((group) => {
                            const matchesSearch = publicSearch
                              ? group.name.toLowerCase().includes(publicSearch.toLowerCase())
                              : true
                            const matchesCategory =
                              selectedPublicCategory === 'All'
                                ? true
                                : group.categories && group.categories.length > 0 && group.categories.includes(selectedPublicCategory)
                            return matchesSearch && matchesCategory
                          })
                          .map((group) => {
                            const heroAvatar = group.avatars[0]
                            return (
                              <button
                                key={group.id}
                                onClick={() => setSelectedPublicGroupId(group.id)}
                                className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 hover:shadow-xl transition-all duration-300 text-left"
                              >
                                <div className="relative w-full h-full">
                                  <AvatarImage
                                    avatar={heroAvatar}
                                    className="w-full h-full rounded-none"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
                                    <p className="text-white text-sm font-semibold truncate">
                                      {group.name}
                                    </p>
                                    <p className="text-white/80 text-xs mt-0.5">
                                      {group.avatars.length} looks
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        {publicAvatarGroups.length === 0 && !loadingPublicAvatars && (
                          <div className="text-sm text-slate-500">
                            No public avatars found.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // Looks view for a selected public avatar
                  <div className="flex flex-col h-full">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                          {publicAvatarGroups.find((g) => g.id === selectedPublicGroupId)?.name ||
                            'Public Avatars'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                          Click a look to add it to your avatars.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedPublicGroupId(null)}
                      >
                        Back to all avatars
                      </Button>
                    </div>

                    {loadingPublicAvatars ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div
                            key={i}
                            className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {publicAvatarGroups
                          .find((g) => g.id === selectedPublicGroupId)
                          ?.avatars.map((avatar) => (
                            <div
                              key={avatar.heygen_avatar_id}
                              className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-cyan-500 hover:shadow-lg transition-all duration-300 flex flex-col"
                            >
                              <div className="relative flex-1">
                                <AvatarImage
                                  avatar={avatar}
                                  className="w-full h-full rounded-none"
                                />
                              </div>
                              <div className="p-3 bg-white">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {avatar.avatar_name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Studio avatar
                                </p>
                                <Button
                                  size="sm"
                                  className="mt-2 w-full"
                                  onClick={() => handleAddPublicAvatar(avatar)}
                                >
                                  Use this look
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <AvatarWorkspace
              avatars={displayedAvatars}
              loading={displayedLoading}
              allLooks={allLooks}
              loadingLooks={loadingLooks}
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
                panel.openAvatarDetails(avatar)
                setSelectedAvatarId(avatar.id)
              }}
              onTrainAvatar={handleTrainAvatar}
              trainingAvatarId={trainingAvatarId}
              generating={generating}
              generatingLookIds={generatingLookIds}
              addingMotionLookIds={addingMotionLookIds}
            />
          )}
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

