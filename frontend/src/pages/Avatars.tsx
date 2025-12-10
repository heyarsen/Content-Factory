import { useCallback, useState, useMemo } from 'react'
import { MoreVertical, Star, Pencil, Trash2 } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { AvatarWorkspaceProvider, useAvatarWorkspace } from '../contexts/AvatarWorkspaceContext'
import { useAvatarWorkspaceState } from '../hooks/avatars/useAvatarWorkspace'
import { useContextPanel } from '../hooks/avatars/useContextPanel'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { handleError, formatSpecificError } from '../lib/errorHandler'
import { Avatar, PhotoAvatarLook } from '../types/avatar'
import { AIGenerationModal } from '../components/avatars/AIGenerationModal'
import { AvatarImage } from '../components/avatars/AvatarImage'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { LookGenerationModal } from '../components/avatars/LookGenerationModal'
import { ManageLooksModal } from '../components/avatars/ManageLooksModal'
import { Modal } from '../components/ui/Modal'

// (Motion metadata removed for simplicity; show all looks as-is)

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

  // My avatars filters & UI state
  const [mySearch, setMySearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'training' | 'failed'>('all')
  const [sortOption, setSortOption] = useState<'recent' | 'name'>('recent')
  const [manageAvatar, setManageAvatar] = useState<Avatar | null>(null)
  const [showManageModal, setShowManageModal] = useState(false)
  const [lookGenModalOpen, setLookGenModalOpen] = useState(false)
  const [lookGenStep, setLookGenStep] = useState<'select-avatar' | 'generate'>('select-avatar')
  const [lookGenAvatar, setLookGenAvatar] = useState<Avatar | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<Avatar | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Avatar | null>(null)
  
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
    loadAvatars,
    invalidateLooksCache,
    addAvatar,
    generateLook,
    generating,
  } = useAvatarWorkspaceState(selectedAvatarId)

  const filteredAllLooks = allLooks

  const filteredMyAvatars = useMemo(() => {
    const normalizedStatus = (status: string | null | undefined) => {
      if (!status) return 'unknown'
      if (status === 'ready') return 'active'
      return status.toLowerCase()
    }

    let list = avatars
    if (mySearch.trim()) {
      list = list.filter(a => a.avatar_name.toLowerCase().includes(mySearch.trim().toLowerCase()))
    }
    if (statusFilter !== 'all') {
      list = list.filter(a => normalizedStatus(a.status) === statusFilter)
    }

    const sortByTimestamp = (value?: string | null) => {
      if (!value) return 0
      const ts = new Date(value).getTime()
      return Number.isNaN(ts) ? 0 : ts
    }

    if (sortOption === 'recent') {
      list = [...list].sort((a, b) => {
        const aTime = sortByTimestamp((a as any).updated_at || (a as any).created_at)
        const bTime = sortByTimestamp((b as any).updated_at || (b as any).created_at)
        return bTime - aTime
      })
    } else {
      list = [...list].sort((a, b) => a.avatar_name.localeCompare(b.avatar_name))
    }

    return list
  }, [avatars, mySearch, statusFilter, sortOption])

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

      // Group public avatars by base name so grid shows one tile per character, with all variants
      const groupMap = new Map<string, { id: string; name: string; avatars: Avatar[]; categories: string[]; motionLookIds: Set<string> }>()
      for (const avatar of normalizedAvatars) {
        const baseName = getPublicAvatarBaseName(avatar.avatar_name)
        const key = baseName.toLowerCase()
        let group = groupMap.get(key)
        if (!group) {
          group = { id: key, name: baseName, avatars: [], categories: [], motionLookIds: new Set() }
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

      // Motion: load locally stored motion looks and attach to groups
      let motionLookSet = new Set<string>()
      try {
        if (typeof window !== 'undefined') {
          const rawLooks = window.localStorage.getItem('motion_applied_look_ids')
          const lookArr: string[] = rawLooks ? JSON.parse(rawLooks) : []
          motionLookSet = new Set(lookArr)
        }
      } catch (e) {
        console.warn('[Motion] Could not read motion look flags from localStorage')
      }

      groupsArray.forEach((group) => {
        group.motionLookIds = new Set(
          group.avatars
            .filter(a => a.id && motionLookSet.has(a.id)) // if avatars are stored as looks; if looks have separate IDs, adjust below
            .map(a => a.id)
        )
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
  }) => {
    await generateLook({
      ...data,
      pose: 'close_up',
      style: 'Realistic',
    })
    panel.closePanel()
  }, [generateLook, panel])

  const openGenerateLookModal = useCallback((avatar?: Avatar) => {
    if (avatar) {
      setLookGenAvatar(avatar)
      setLookGenStep('generate')
    } else {
      setLookGenAvatar(null)
      setLookGenStep('select-avatar')
    }
    setLookGenModalOpen(true)
  }, [])

  const closeGenerateLookModal = useCallback(() => {
    setLookGenModalOpen(false)
    setLookGenAvatar(null)
    setLookGenStep('select-avatar')
  }, [])

  const openManageLooks = useCallback((avatar: Avatar) => {
    setManageAvatar(avatar)
    setShowManageModal(true)
  }, [])

  const closeManageLooks = useCallback(() => {
    setManageAvatar(null)
    setShowManageModal(false)
  }, [])

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

  const handleSetDefaultAvatar = useCallback(async (avatar: Avatar) => {
    try {
      await api.post(`/api/avatars/${avatar.id}/set-default`)
      toast.success(`"${avatar.avatar_name}" is now your default avatar`)
      await loadAvatars()
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, { showToast: true, logError: true, customMessage: errorMessage })
      toast.error(errorMessage || 'Failed to set default avatar')
    }
  }, [toast, loadAvatars])

  const handleRenameAvatar = useCallback(async () => {
    if (!renameTarget) return
    const nextName = renameValue.trim()
    if (!nextName) {
      toast.error('Name cannot be empty')
      return
    }
    try {
      await api.patch(`/api/avatars/${renameTarget.id}`, { avatar_name: nextName })
      toast.success('Avatar renamed')
      setRenameTarget(null)
      setRenameValue('')
      await loadAvatars()
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, { showToast: true, logError: true, customMessage: errorMessage })
      toast.error(errorMessage || 'Failed to rename avatar')
    }
  }, [renameTarget, renameValue, toast, loadAvatars])

  const handleDeleteAvatar = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/avatars/${deleteTarget.id}`)
      toast.success(`Deleted "${deleteTarget.avatar_name}"`)
      setDeleteTarget(null)
      await loadAvatars()
      invalidateLooksCache()
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, { showToast: true, logError: true, customMessage: errorMessage })
      toast.error(errorMessage || 'Failed to delete avatar')
    }
  }, [deleteTarget, toast, loadAvatars, invalidateLooksCache])

  const handleSetDefaultLook = useCallback(async (avatarId: string, lookId: string) => {
    try {
      await api.post(`/api/avatars/${avatarId}/set-default-look`, { look_id: lookId })
      toast.success('Default look updated')
      await loadAvatars()
      invalidateLooksCache()
    } catch (error: any) {
      const errorMessage = formatSpecificError(error)
      handleError(error, { showToast: true, logError: true, customMessage: errorMessage })
      toast.error(errorMessage || 'Failed to set default look')
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

  const getAvatarLooks = useCallback(
    (avatarId: string) => filteredAllLooks.filter((entry) => entry.avatar.id === avatarId),
    [filteredAllLooks],
  )

  return (
    <Layout>
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-2">
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

        {activeTab === 'my-avatars' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <Input
                  value={mySearch}
                  onChange={(e) => setMySearch(e.target.value)}
                  placeholder="Search avatars..."
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'training' | 'failed')}
                options={[
                  { value: 'all', label: 'Status: All' },
                  { value: 'active', label: 'Status: Active' },
                  { value: 'training', label: 'Status: Training' },
                  { value: 'failed', label: 'Status: Failed' },
                ]}
                className="min-w-[160px]"
              />
              <Select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as 'recent' | 'name')}
                options={[
                  { value: 'recent', label: 'Sort: Recent' },
                  { value: 'name', label: 'Sort: Name' },
                ]}
                className="min-w-[150px]"
              />
              <div className="flex-1" />
              <Button onClick={() => setShowGenerateAIModal(true)}>
                Create/Train Avatar
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="aspect-[3/4] bg-slate-200 animate-pulse rounded-xl" />
                    <div className="mt-3 h-4 w-24 bg-slate-200 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : filteredMyAvatars.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                <p className="text-sm font-semibold text-slate-700">No avatars yet</p>
                <p className="text-sm mt-1">Create or train your first avatar to get started.</p>
                <div className="mt-4">
                  <Button onClick={() => setShowGenerateAIModal(true)}>Create/Train Avatar</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredMyAvatars.map((avatar) => {
                  const lookCount = getAvatarLooks(avatar.id).length
                  const status = (avatar.status || '').toLowerCase()
                  const isTraining = status === 'training' || status === 'pending'
                  const isFailed = status === 'failed'
                  return (
                    <div
                      key={avatar.id}
                      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="relative aspect-[3/4] bg-slate-50">
                        <AvatarImage avatar={avatar} className="w-full h-full rounded-none" />
                        {isTraining && (
                          <span className="absolute top-3 right-3 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                            Training
                          </span>
                        )}
                        {isFailed && (
                          <span className="absolute top-3 right-3 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                            Failed
                          </span>
                        )}
                        <button
                          className="absolute top-3 left-3 rounded-full bg-white/80 p-2 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === avatar.id ? null : avatar.id)
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuOpenId === avatar.id && (
                          <div className="absolute left-3 top-12 z-10 w-44 rounded-xl border border-slate-200 bg-white shadow-lg">
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setMenuOpenId(null)
                                handleSetDefaultAvatar(avatar)
                              }}
                            >
                              <Star className="h-4 w-4 text-amber-500" />
                              Set default
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setMenuOpenId(null)
                                setRenameTarget(avatar)
                                setRenameValue(avatar.avatar_name)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Rename
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setMenuOpenId(null)
                                setDeleteTarget(avatar)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{avatar.avatar_name}</p>
                            <p className="text-xs text-slate-500">{lookCount} look{lookCount === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <div className="mt-auto flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => openGenerateLookModal(avatar)}
                          >
                            Generate Look
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => openManageLooks(avatar)}
                          >
                            Manage Looks
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <Input
                  value={publicSearch}
                  onChange={(e) => setPublicSearch(e.target.value)}
                  placeholder="Search avatars..."
                />
              </div>
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

            <div className="flex-1 min-h-0">
              {selectedPublicGroupId === null ? (
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
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex items-center justify-between">
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
        )}
      </div>

      {/* AI Generation Modal */}
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

      {/* Generate Look Modal */}
      <LookGenerationModal
        isOpen={lookGenModalOpen}
        onClose={closeGenerateLookModal}
        avatar={lookGenAvatar}
        avatars={avatars}
        step={lookGenStep}
        onSelectAvatar={(avatar) => {
          setLookGenAvatar(avatar)
          setLookGenStep('generate')
        }}
        onGenerate={async (data) => {
          await handleGenerateLook(data)
          closeGenerateLookModal()
        }}
        generating={generating}
      />

      {/* Manage Looks Modal */}
      <ManageLooksModal
        isOpen={showManageModal}
        onClose={closeManageLooks}
        avatar={manageAvatar}
        looks={manageAvatar ? getAvatarLooks(manageAvatar.id).map((entry) => entry.look) : []}
        onUploadLooks={() => toast.info('Upload looks is not available yet.')}
        onGenerateLook={() => {
          closeManageLooks()
          openGenerateLookModal(manageAvatar || undefined)
        }}
        onSetDefaultLook={async (lookId) => {
          if (manageAvatar) {
            await handleSetDefaultLook(manageAvatar.id, lookId)
          }
        }}
      />

      {/* Rename Modal */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => {
          setRenameTarget(null)
          setRenameValue('')
        }}
        title="Rename Avatar"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="New name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter a new name"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setRenameTarget(null)
                setRenameValue('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameAvatar} disabled={!renameValue.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete avatar"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will remove the avatar permanently. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAvatar}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
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
