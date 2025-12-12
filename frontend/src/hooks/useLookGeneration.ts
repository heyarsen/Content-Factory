import { useState, useCallback } from 'react'
import api from '../lib/api'
import { pollingManager } from '../lib/pollingManager'
import { handleError, formatSpecificError } from '../lib/errorHandler'
import { useToast } from './useToast'
import { useCredits } from './useCredits'

interface Avatar {
  id: string
  avatar_name: string
  heygen_avatar_id: string
  status: string
}

interface UseLookGenerationOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useLookGeneration({ onSuccess, onError }: UseLookGenerationOptions = {}) {
  const [generating, setGenerating] = useState(false)
  const [generatingLookIds, setGeneratingLookIds] = useState<Set<string>>(new Set())
  const pollingCleanupsRef = useState<Map<string, () => void>>(new Map())[0]
  const { toast } = useToast()
  const { refreshCredits } = useCredits()

  const pollLookGenerationStatus = useCallback(
    (generationId: string, avatarId: string) => {
      const pollingKey = `look-generation-${generationId}-${avatarId}`

      // Stop existing polling if any (deduplication)
      const existingCleanup = pollingCleanupsRef.get(pollingKey)
      if (existingCleanup) {
        existingCleanup()
      }

      // Start recursive polling
      const cleanup = pollingManager.startRecursivePolling<{ status: string }>(
        pollingKey,
        async () => {
          const response = await api.get(`/api/avatars/generation-status/${generationId}`)
          const status = response.data?.status

          if (status === 'success') {
            setGeneratingLookIds(prev => {
              const next = new Set(prev)
              next.delete(avatarId)
              return next
            })
            toast.success('Look generation completed!')
            onSuccess?.()
            return { status: 'complete' }
          } else if (status === 'failed') {
            setGeneratingLookIds(prev => {
              const next = new Set(prev)
              next.delete(avatarId)
              return next
            })
            const errorMessage = handleError(new Error('Look generation failed'), {
              showToast: true,
              logError: true,
            })
            toast.error(errorMessage)
            onError?.(errorMessage)
            return { status: 'complete' }
          }
          return { status: 'in_progress' }
        },
        5000, // Poll every 5 seconds
        {
          immediate: true,
          maxAttempts: 60, // Max 5 minutes
          shouldContinue: (result) => result?.status === 'in_progress',
          onError: (error) => {
            // Handle errors gracefully
            console.error('Look generation status check error:', error)
          },
          onComplete: () => {
            setGeneratingLookIds(prev => {
              const next = new Set(prev)
              next.delete(avatarId)
              return next
            })
          },
        }
      )

      pollingCleanupsRef.set(pollingKey, cleanup)

      // Handle timeout case
      setTimeout(() => {
        if (pollingManager.isPolling(pollingKey)) {
          cleanup()
          setGeneratingLookIds(prev => {
            const next = new Set(prev)
            next.delete(avatarId)
            return next
          })
          toast.error('Look generation is taking longer than expected. Please check back later or refresh the page.')
        }
      }, 300000) // 5 minutes timeout
    },
    [toast, onSuccess, onError, pollingCleanupsRef]
  )

  const generateLook = useCallback(
    async (data: {
      avatar: Avatar
      prompt: string
      pose: 'half_body' | 'full_body' | 'close_up'
      style: 'Realistic' | 'Cartoon' | 'Anime'
    }) => {
      const { avatar, prompt, pose, style } = data

      if (avatar.status !== 'active' && avatar.status !== 'ready') {
        toast.error('Avatar must be trained before generating looks. Please train the avatar first.')
        return
      }

      setGenerating(true)
      try {
        const response = await api.post('/api/avatars/generate-look', {
          group_id: avatar.heygen_avatar_id,
          prompt: prompt.trim(),
          orientation: 'vertical',
          pose,
          style,
        })

        const generationId = response.data?.generation_id

        if (generationId) {
          setGeneratingLookIds(prev => new Set(prev).add(avatar.id))
          pollLookGenerationStatus(generationId, avatar.id)
          toast.success('Look generation started! This may take a few minutes.')
        } else {
          throw new Error('No generation ID returned from server')
        }
      } catch (error: any) {
        setGeneratingLookIds(prev => {
          const next = new Set(prev)
          next.delete(avatar.id)
          return next
        })

        const errorMessage = formatSpecificError(error)
        handleError(error, {
          showToast: true,
          logError: true,
          customMessage: errorMessage,
        })
        toast.error(errorMessage)
        onError?.(errorMessage)
        
        // Refresh credits if it's a credit-related error (402 status)
        if (error?.response?.status === 402) {
          refreshCredits()
        }
        
        // Re-throw error so caller can handle it
        throw error
      } finally {
        setGenerating(false)
      }
    },
    [toast, pollLookGenerationStatus, onError]
  )

  return {
    generating,
    generatingLookIds,
    generateLook,
  }
}

