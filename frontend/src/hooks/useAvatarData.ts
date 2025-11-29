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
      const response = await api.get('/api/avatars')
      const avatarsList = (response.data?.avatars || []).filter(
        (avatar: Avatar) => {
          if (avatar.status !== 'active') return false
          if (!avatar.heygen_avatar_id || avatar.heygen_avatar_id.trim() === '') return false
          return true
        }
      )
      setAvatars(avatarsList)
    } catch (error: any) {
      const errorMessage = handleError(error, {
        showToast: true,
        logError: true,
      })
      console.error('Failed to load avatars:', errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAllLooks = useCallback(async (avatarsList: Avatar[]) => {
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
        }
      } catch (error) {
        handleError(error, {
          showToast: false,
          logError: true,
          silent: true,
        })
      }
    }

    // Add cached looks
    for (const avatar of avatarsList) {
      const cachedLooks = looksCacheRef.current.get(avatar.id)
      if (cachedLooks) {
        for (const look of cachedLooks) {
          looks.push({ look, avatar })
        }
      }
    }

    setAllLooks(looks)
    setLoadingLooks(false)
    console.log('[useAvatarData] Loaded looks:', looks.length, 'for', avatarsList.length, 'avatars')
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

  return {
    avatars,
    loading,
    allLooks,
    loadingLooks,
    loadAvatars,
    loadLooksForAvatar,
    invalidateLooksCache,
  }
}

