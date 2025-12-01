import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api'
import { handleError } from '../lib/errorHandler'

interface Avatar {
  id: string
  avatar_name: string
  heygen_avatar_id: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
  status: string
  gender: string | null
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

interface UseAvatarDataOptions {
  lazyLoadLooks?: boolean
  selectedAvatarId?: string | null
}

export function useAvatarData({ lazyLoadLooks = false, selectedAvatarId }: UseAvatarDataOptions = {}) {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [allLooks, setAllLooks] = useState<Array<{ look: PhotoAvatarLook; avatar: Avatar }>>([])
  const [loadingLooks, setLoadingLooks] = useState(false)
  const looksCacheRef = useRef<Map<string, PhotoAvatarLook[]>>(new Map())

  const loadAvatars = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/avatars', {
        timeout: 300000, // 5 minutes timeout for avatar loading
      })
      const allAvatars = response.data?.avatars || []
      
      const avatarsList = allAvatars.filter((avatar: Avatar) => {
        // Exclude deleted/inactive avatars
        if (avatar.status === 'deleted' || avatar.status === 'inactive') {
          return false
        }
        
        // Exclude explicitly synced avatars
        if (avatar.source === 'synced') {
          return false
        }
        
        // Show everything else - all other avatars are user-created
        return true
      })
      
      // Merge with existing avatars to preserve pending/training/generating avatars
      // that might not be in the new response (e.g., due to timing issues)
      setAvatars((prevAvatars: Avatar[]) => {
        // Create a map of new avatars by ID (prioritize new data)
        const avatarsMap = new Map<string, Avatar>(avatarsList.map((avatar: Avatar) => [avatar.id, avatar]))
        
        // Add back any pending/training/generating avatars from previous state
        // that aren't in the new response (they might still be processing)
        prevAvatars.forEach((avatar: Avatar) => {
          if (['pending', 'training', 'generating'].includes(avatar.status) && !avatarsMap.has(avatar.id)) {
            avatarsMap.set(avatar.id, avatar)
          }
        })
        
        return Array.from(avatarsMap.values()) as Avatar[]
      })
    } catch (error: any) {
      // On error, preserve existing avatars (especially pending ones)
      // Only show error if it's not a timeout (timeouts are expected for long operations)
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout')
      
      if (!isTimeout) {
        const errorMessage = handleError(error, {
          showToast: true,
          logError: true,
        })
        console.error('Failed to load avatars:', errorMessage)
      } else {
        // For timeouts, silently preserve existing avatars
        console.warn('Avatar loading timeout - preserving existing avatars')
      }
      
      // Don't clear avatars on error - keep existing ones
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAllLooks = useCallback(async (avatarsList: Avatar[]) => {
    if (avatarsList.length === 0) {
      setAllLooks([])
      setLoadingLooks(false)
      return
    }

    setLoadingLooks(true)
    const looks: Array<{ look: PhotoAvatarLook; avatar: Avatar }> = []

    // Check cache first
    const uncachedAvatars = avatarsList.filter(avatar => !looksCacheRef.current.has(avatar.id))

    // Load looks for uncached avatars
    for (const avatar of uncachedAvatars) {
      try {
        const response = await api.get(`/api/avatars/${avatar.id}/details`)
        const details = response.data
        if (details?.looks && Array.isArray(details.looks)) {
          looksCacheRef.current.set(avatar.id, details.looks)
          for (const look of details.looks) {
            looks.push({ look, avatar })
          }
        } else {
          // Cache empty array to prevent repeated requests
          looksCacheRef.current.set(avatar.id, [])
        }
      } catch (error) {
        handleError(error, {
          showToast: false,
          logError: true,
          silent: true,
        })
        // Cache empty array to prevent repeated failed requests
        looksCacheRef.current.set(avatar.id, [])
      }
    }

    // Add cached looks
    for (const avatar of avatarsList) {
      const cachedLooks = looksCacheRef.current.get(avatar.id)
      if (cachedLooks && cachedLooks.length > 0) {
        for (const look of cachedLooks) {
          looks.push({ look, avatar })
        }
      }
    }

    setAllLooks(looks)
    setLoadingLooks(false)
  }, [])

  const loadLooksForAvatar = useCallback(async (avatarId: string) => {
    // Check cache first
    if (looksCacheRef.current.has(avatarId)) {
      return looksCacheRef.current.get(avatarId)!
    }

    try {
      const response = await api.get(`/api/avatars/${avatarId}/details`)
      const details = response.data
      if (details?.looks && Array.isArray(details.looks)) {
        looksCacheRef.current.set(avatarId, details.looks)
        return details.looks
      }
      return []
    } catch (error) {
      handleError(error, {
        showToast: false,
        logError: true,
        silent: true,
      })
      return []
    }
  }, [])

  // Load avatars on mount
  useEffect(() => {
    loadAvatars()
  }, [loadAvatars])

  // Load looks based on lazy loading setting
  useEffect(() => {
    if (lazyLoadLooks) {
      // Only load looks when avatar is selected
      if (selectedAvatarId) {
        loadLooksForAvatar(selectedAvatarId).then((looks: PhotoAvatarLook[]) => {
          const avatar = avatars.find(a => a.id === selectedAvatarId)
          if (avatar) {
            setAllLooks(looks.map((look: PhotoAvatarLook) => ({ look, avatar })))
          }
        })
      } else {
        // Load all looks if no avatar selected
        if (avatars.length > 0) {
          loadAllLooks(avatars)
        }
      }
    } else {
      // Load all looks immediately
      if (avatars.length > 0) {
        loadAllLooks(avatars)
      }
    }
  }, [avatars, selectedAvatarId, lazyLoadLooks, loadAllLooks, loadLooksForAvatar])

  const invalidateLooksCache = useCallback((avatarId?: string) => {
    if (avatarId) {
      looksCacheRef.current.delete(avatarId)
    } else {
      looksCacheRef.current.clear()
    }
  }, [])

  const addAvatar = useCallback((avatar: Avatar) => {
    setAvatars((prevAvatars: Avatar[]) => {
      // Check if avatar already exists
      if (prevAvatars.find(a => a.id === avatar.id)) {
        // Update existing avatar
        return prevAvatars.map(a => a.id === avatar.id ? avatar : a)
      }
      // Add new avatar
      return [...prevAvatars, avatar]
    })
  }, [])

  return {
    avatars,
    loading,
    allLooks,
    loadingLooks,
    loadAvatars,
    loadLooksForAvatar,
    invalidateLooksCache,
    addAvatar,
  }
}

