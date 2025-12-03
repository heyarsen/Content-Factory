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
      
      console.log('[Avatar Load] Received avatars from API:', {
        total: allAvatars.length,
        byStatus: allAvatars.reduce((acc: Record<string, number>, a: Avatar) => {
          acc[a.status] = (acc[a.status] || 0) + 1
          return acc
        }, {}),
        bySource: allAvatars.reduce((acc: Record<string, number>, a: Avatar) => {
          acc[a.source || 'null'] = (acc[a.source || 'null'] || 0) + 1
          return acc
        }, {}),
      })
      
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
      
      console.log('[Avatar Load] Filtered avatars list:', {
        total: avatarsList.length,
        byStatus: avatarsList.reduce((acc: Record<string, number>, a: Avatar) => {
          acc[a.status] = (acc[a.status] || 0) + 1
          return acc
        }, {}),
        avatars: avatarsList.map((a: Avatar) => ({ id: a.id, name: a.avatar_name, status: a.status, source: a.source }))
      })
      
      // Simply set avatars from API response - this is the source of truth
      // We'll add merge logic back later if needed for pending avatars
      setAvatars(avatarsList)
      console.log('[Avatar Load] Set avatars in state:', avatarsList.length)
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

    // Deduplicate looks by look.id to prevent duplicates
    const uniqueLooks = looks.filter((item, index, self) => 
      index === self.findIndex((t) => t.look.id === item.look.id && t.avatar.id === item.avatar.id)
    )
    
    setAllLooks(uniqueLooks)
    setLoadingLooks(false)
  }, [])

  const loadLooksForAvatar = useCallback(async (avatarId: string, forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh && looksCacheRef.current.has(avatarId)) {
      const cachedLooks = looksCacheRef.current.get(avatarId)!
      return cachedLooks
    }

    try {
      console.log(`[useAvatarData] Loading looks for avatar ${avatarId}${forceRefresh ? ' (force refresh)' : ''}`)
      const response = await api.get(`/api/avatars/${avatarId}/details`)
      const details = response.data
      if (details?.looks && Array.isArray(details.looks)) {
        console.log(`[useAvatarData] Loaded ${details.looks.length} looks for avatar ${avatarId}`)
        looksCacheRef.current.set(avatarId, details.looks)
        return details.looks
      }
      console.log(`[useAvatarData] No looks found for avatar ${avatarId}`)
      return []
    } catch (error) {
      console.error(`[useAvatarData] Failed to load looks for avatar ${avatarId}:`, error)
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

  // Track previous selectedAvatarId to detect changes
  const prevSelectedAvatarIdRef = useRef<string | null>(null)

  // Load looks based on lazy loading setting
  useEffect(() => {
    if (lazyLoadLooks) {
      // Only load looks when avatar is selected
      if (selectedAvatarId) {
        const avatarChanged = prevSelectedAvatarIdRef.current !== selectedAvatarId
        prevSelectedAvatarIdRef.current = selectedAvatarId
        
        console.log(`[useAvatarData] Avatar selected: ${selectedAvatarId}, loading looks... (changed: ${avatarChanged})`)
        
        // Find avatar in current list, or fetch it if not available
        let avatar = avatars.find(a => a.id === selectedAvatarId)
        
        // If avatar not found, try to fetch it from API
        if (!avatar) {
          console.log(`[useAvatarData] Avatar ${selectedAvatarId} not in list, fetching from API...`)
          api.get(`/api/avatars/${selectedAvatarId}`)
            .then(response => {
              if (response.data) {
                avatar = response.data
                // Load looks for this avatar with force refresh
                return loadLooksForAvatar(selectedAvatarId, true)
              }
              return []
            })
            .then((looks: PhotoAvatarLook[]) => {
              if (avatar) {
                if (looks.length > 0) {
                  const newLooks = looks.map((look: PhotoAvatarLook) => ({ look, avatar: avatar! }))
                  setAllLooks(prevLooks => {
                    // Remove old looks for this avatar first
                    const filtered = prevLooks.filter(item => item.avatar.id !== selectedAvatarId)
                    const combined = [...filtered, ...newLooks]
                    // Deduplicate by look.id
                    return combined.filter((item, index, self) => 
                      index === self.findIndex((t) => t.look.id === item.look.id && t.avatar.id === item.avatar.id)
                    )
                  })
                  console.log(`[useAvatarData] Added ${newLooks.length} looks for avatar ${selectedAvatarId}`)
                } else {
                  // No looks found, clear any stale looks for this avatar
                  setAllLooks(prevLooks => prevLooks.filter(item => item.avatar.id !== selectedAvatarId))
                  console.log(`[useAvatarData] No looks found for avatar ${selectedAvatarId}, cleared stale looks`)
                }
              }
            })
            .catch(error => {
              console.error(`[useAvatarData] Failed to fetch avatar ${selectedAvatarId}:`, error)
            })
        } else {
          // Avatar is in list, load looks (force refresh if avatar just changed)
          loadLooksForAvatar(selectedAvatarId, avatarChanged).then((looks: PhotoAvatarLook[]) => {
            if (avatar) {
              if (looks.length > 0) {
                const newLooks = looks.map((look: PhotoAvatarLook) => ({ look, avatar }))
                // Deduplicate by look.id and replace looks for this avatar
                setAllLooks(prevLooks => {
                  // Remove old looks for this avatar first
                  const filtered = prevLooks.filter(item => item.avatar.id !== selectedAvatarId)
                  const combined = [...filtered, ...newLooks]
                  return combined.filter((item, index, self) => 
                    index === self.findIndex((t) => t.look.id === item.look.id && t.avatar.id === item.avatar.id)
                  )
                })
                console.log(`[useAvatarData] Updated ${newLooks.length} looks for avatar ${selectedAvatarId}`)
              } else {
                // No looks found, but ensure we clear any stale looks for this avatar
                setAllLooks(prevLooks => prevLooks.filter(item => item.avatar.id !== selectedAvatarId))
                console.log(`[useAvatarData] No looks found for avatar ${selectedAvatarId}, cleared stale looks`)
              }
            }
          })
        }
      } else {
        // Clear previous selection when no avatar is selected
        prevSelectedAvatarIdRef.current = null
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

  // Function to refresh looks for a specific avatar and update state
  const refreshLooksForAvatar = useCallback(async (avatarId: string) => {
    console.log(`[useAvatarData] Refreshing looks for avatar ${avatarId}`)
    // Invalidate cache first
    invalidateLooksCache(avatarId)
    
    // Load fresh looks
    const looks = await loadLooksForAvatar(avatarId, true)
    
    // Find avatar in current list
    const avatar = avatars.find(a => a.id === avatarId)
    
    if (avatar) {
      if (looks.length > 0) {
        const newLooks = looks.map((look: PhotoAvatarLook) => ({ look, avatar }))
        // Update state: remove old looks for this avatar and add new ones
        setAllLooks(prevLooks => {
          const filtered = prevLooks.filter(item => item.avatar.id !== avatarId)
          const combined = [...filtered, ...newLooks]
          // Deduplicate by look.id
          return combined.filter((item, index, self) => 
            index === self.findIndex((t) => t.look.id === item.look.id && t.avatar.id === item.avatar.id)
          )
        })
        console.log(`[useAvatarData] Updated state with ${newLooks.length} looks for avatar ${avatarId}`)
      } else {
        // No looks found, remove any stale looks for this avatar
        setAllLooks(prevLooks => prevLooks.filter(item => item.avatar.id !== avatarId))
        console.log(`[useAvatarData] No looks found, cleared looks for avatar ${avatarId}`)
      }
    } else {
      console.warn(`[useAvatarData] Avatar ${avatarId} not found in avatars list, cannot update looks state`)
    }
    
    return looks
  }, [avatars, loadLooksForAvatar, invalidateLooksCache])

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
    refreshLooksForAvatar,
    invalidateLooksCache,
    addAvatar,
  }
}

