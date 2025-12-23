import { Request } from 'express'
import axios from 'axios'
import { AvatarService } from '../services/avatarService.js'
import {
  generateAIAvatar,
  checkGenerationStatus,
  addLooksToAvatarGroup,
  checkTrainingStatus,
  generateAvatarLook,
  uploadImageToHeyGen,
  type GenerateAIAvatarRequest,
  type AddLooksRequest,
  type GenerateLookRequest,
} from '../lib/heygen.js'
import { assignAvatarSource, executeWithAvatarSourceFallback } from '../lib/avatarSourceColumn.js'
import { jobManager } from '../lib/jobManager.js'
import { validateRequired, validateStringLength, validateBase64Image, validateEnum, validateOrThrow } from '../lib/validators.js'
import { lookCache } from '../lib/lookCache.js'
import { createErrorResponse, ErrorCode, ApiError } from '../lib/apiErrorHandler.js'
import type { Avatar } from '../services/avatarService.js'

// Configuration
const POLL_LOOK_GENERATION_TIMEOUT = parseInt(process.env.POLL_LOOK_GENERATION_TIMEOUT || '300', 10) * 1000
const POLL_INTERVAL = parseInt(process.env.POLL_LOOK_GENERATION_INTERVAL || '10', 10) * 1000
const TRAINING_STATUS_CHECK_TIMEOUT = parseInt(process.env.TRAINING_STATUS_CHECK_TIMEOUT || '15', 10) * 1000
const TRAINING_STATUS_CHECK_RETRIES = parseInt(process.env.TRAINING_STATUS_CHECK_RETRIES || '3', 10)

/**
 * Background polling for look generation status
 */
async function pollLookGenerationStatus(
  generationId: string,
  groupId: string,
  lookName?: string,
  userId?: string,
  avatarId?: string
): Promise<void> {
  const maxAttempts = Math.ceil(POLL_LOOK_GENERATION_TIMEOUT / POLL_INTERVAL)
  const pollInterval = POLL_INTERVAL

  const jobId = jobManager.createJob('look_generation', generationId, {
    groupId,
    userId,
    avatarId,
    metadata: { lookName },
  })

  jobManager.updateJob(jobId, { status: 'in_progress' })
  const cancellationToken = jobManager.getCancellationToken(jobId)

  console.log(`[Generate Look] Starting background polling for generation ${generationId} (job: ${jobId})`)

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (cancellationToken?.signal.aborted || jobManager.isCancelled(jobId)) {
        console.log(`[Generate Look] Job ${jobId} was cancelled`)
        jobManager.updateJob(jobId, { status: 'cancelled' })
        return
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), pollInterval)
        const checkInterval = setInterval(() => {
          if (cancellationToken?.signal.aborted || jobManager.isCancelled(jobId)) {
            clearTimeout(timeout)
            clearInterval(checkInterval)
            reject(new Error('Job cancelled'))
          }
        }, 1000)

        cancellationToken?.signal.addEventListener('abort', () => {
          clearTimeout(timeout)
          clearInterval(checkInterval)
          reject(new Error('Job cancelled'))
        })
      }).catch(() => {
        throw new Error('Job cancelled')
      })

      try {
        const status = await checkGenerationStatus(generationId)
        console.log(`[Generate Look] Poll attempt ${attempt}/${maxAttempts} - Status:`, status)

        if (status.status === 'success') {
          console.log(`[Generate Look] ✅ Generation completed successfully!`, {
            generationId,
            groupId,
            imageCount: status.image_url_list?.length || 0,
          })

          if (status.image_key_list && status.image_key_list.length > 0) {
            try {
              console.log(`[Generate Look] Adding ${status.image_key_list.length} generated images as looks to group ${groupId}`)

              const addLooksRequest: AddLooksRequest = {
                group_id: groupId,
                image_keys: status.image_key_list,
                name: lookName || `Generated Look ${new Date().toISOString().split('T')[0]}`,
              }

              const addLooksResult = await addLooksToAvatarGroup(addLooksRequest)
              console.log(`[Generate Look] ✅ Successfully added ${addLooksResult.photo_avatar_list?.length || 0} looks to avatar group!`, {
                groupId,
                lookIds: addLooksResult.photo_avatar_list?.map(l => l.id),
              })

              // Invalidate look cache so new looks show up immediately
              if (avatarId) {
                lookCache.invalidate(avatarId)
                console.log(`[Generate Look] Invalidated look cache for avatar ${avatarId}`)
              }

              jobManager.updateJob(jobId, {
                status: 'completed',
                metadata: {
                  ...jobManager.getJob(jobId)?.metadata,
                  looksAdded: addLooksResult.photo_avatar_list?.length || 0,
                },
              })
            } catch (addError: any) {
              console.error(`[Generate Look] ❌ Failed to add generated images as looks:`, addError.response?.data || addError.message)
              jobManager.updateJob(jobId, {
                status: 'failed',
                error: addError.message || 'Failed to add looks',
              })
            }
          } else {
            console.warn(`[Generate Look] ⚠️ Generation succeeded but no image keys returned`)
            jobManager.updateJob(jobId, {
              status: 'failed',
              error: 'No image keys returned',
            })
          }
          return
        } else if (status.status === 'failed') {
          console.error(`[Generate Look] ❌ Generation failed:`, {
            generationId,
            groupId,
            error: status.msg,
          })
          jobManager.updateJob(jobId, {
            status: 'failed',
            error: status.msg || 'Generation failed',
          })
          return
        }
      } catch (error: any) {
        if (error.message === 'Job cancelled') {
          return
        }
        console.warn(`[Generate Look] Poll attempt ${attempt} failed:`, error.message)
        if (cancellationToken?.signal.aborted || jobManager.isCancelled(jobId)) {
          return
        }
      }
    }

    console.warn(`[Generate Look] ⚠️ Polling timed out after ${maxAttempts} attempts for generation ${generationId}`)
    jobManager.updateJob(jobId, {
      status: 'failed',
      error: `Polling timed out after ${POLL_LOOK_GENERATION_TIMEOUT / 1000} seconds`,
    })
  } catch (error: any) {
    if (error.message !== 'Job cancelled') {
      console.error(`[Generate Look] Polling error:`, error)
      jobManager.updateJob(jobId, {
        status: 'failed',
        error: error.message || 'Unknown error',
      })
    }
  }
}

export class AvatarController {
  /**
   * List all avatars for a user
   */
  static async listAvatars(userId: string, options: { includeSynced?: boolean } = {}) {
    const showAll = options.includeSynced ?? false

    const avatars = showAll
      ? await AvatarService.getUserAvatars(userId)
      : await AvatarService.getUserCreatedAvatars(userId)

    const defaultAvatar = showAll
      ? await AvatarService.getDefaultAvatar(userId)
      : (await AvatarService.getUserCreatedAvatars(userId)).find(a => a.is_default) || null

    return {
      avatars,
      default_avatar_id: defaultAvatar?.id || null,
      only_created: !showAll,
    }
  }

  /**
   * Get public avatars from HeyGen
   */
  static async getPublicAvatars() {
    const { listPublicAvatars } = await import('../lib/heygen.js')
    const result = await listPublicAvatars()
    return {
      avatars: result.avatars,
      is_public: true,
    }
  }

  /**
   * Add a public avatar to user's avatar list
   */
  static async addPublicAvatar(userId: string, heygenAvatarId: string, avatarName?: string, avatarUrl?: string) {
    const avatar = await AvatarService.addPublicAvatar(userId, heygenAvatarId, avatarName, avatarUrl)
    return { avatar }
  }

  /**
   * Get a specific avatar
   */
  static async getAvatar(userId: string, avatarId: string) {
    const avatar = await AvatarService.getAvatarById(avatarId, userId)
    if (!avatar) {
      throw new ApiError('Avatar not found', ErrorCode.NOT_FOUND, 404)
    }
    return { avatar }
  }

  /**
   * Create avatar from photo upload
   */
  static async createFromPhoto(req: Request, userId: string) {
    const { photo_data, photo_url, avatar_name, additional_photos } = req.body

    // Validate required fields
    const requiredValidation = validateRequired(req.body, ['avatar_name'])
    validateOrThrow(requiredValidation, ErrorCode.MISSING_REQUIRED_FIELD)

    const nameValidation = validateStringLength(avatar_name, 1, 200, 'avatar_name')
    validateOrThrow(nameValidation, ErrorCode.VALIDATION_ERROR)

    if (!photo_data && !photo_url) {
      throw new ApiError('photo_data (base64) or photo_url is required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    if (photo_data) {
      const imageValidation = validateBase64Image(photo_data, 10)
      validateOrThrow(imageValidation, ErrorCode.INVALID_IMAGE)
    }

    if (Array.isArray(additional_photos)) {
      if (additional_photos.length > 4) {
        throw new ApiError('Maximum 4 additional photos allowed (5 total including primary)', ErrorCode.VALIDATION_ERROR, 400)
      }
      for (let i = 0; i < additional_photos.length; i++) {
        const photoValidation = validateBase64Image(additional_photos[i], 10)
        if (!photoValidation.valid) {
          throw new ApiError(`Additional photo ${i + 1}: ${photoValidation.errors.join(', ')}`, ErrorCode.INVALID_IMAGE, 400)
        }
      }
    }

    const primaryInput: string | null =
      typeof photo_data === 'string' && photo_data.length > 0
        ? photo_data
        : typeof photo_url === 'string' && photo_url.length > 0
          ? photo_url
          : null

    if (!primaryInput) {
      throw new ApiError('photo_data (base64) or photo_url is required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const { supabase } = await import('../lib/supabase.js')

    // Ensure bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    if (bucketError) {
      console.error('Error checking buckets:', bucketError)
    } else {
      const bucketExists = buckets?.some((b) => b.name === 'avatars')
      if (buckets && !bucketExists) {
        throw new ApiError(
          'Storage bucket "avatars" does not exist. Please create it in Supabase Dashboard > Storage with public access.',
          ErrorCode.INTERNAL_SERVER_ERROR,
          500
        )
      }
    }

    // Upload photo(s) to storage
    const uploadBase64Photo = async (dataUrl: string, label: string): Promise<string> => {
      const base64Regex = /^data:([^;]+);base64,(.+)$/
      const match = dataUrl.match(base64Regex)
      if (!match) {
        throw new ApiError('photo_data must be a base64-encoded data URL', ErrorCode.INVALID_IMAGE, 400)
      }
      let mimeType = match[1]
      const base64Data = match[2]
      let buffer: Buffer = Buffer.from(base64Data, 'base64')

      const normalizedMime = (mimeType || '').toLowerCase()
      let extension = 'jpg'
      if (normalizedMime.includes('png')) extension = 'png'
      else if (normalizedMime.includes('webp')) extension = 'webp'

      const safeLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'avatar'
      const fileName = `avatars/${userId}/${Date.now()}-${safeLabel}-${Math.random().toString(36).slice(2, 8)}.${extension}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, buffer, {
        contentType: mimeType || `image/${extension}`,
        upsert: false,
        cacheControl: '3600',
      })

      if (uploadError) {
        if (uploadError.message?.includes('Bucket') || uploadError.message?.includes('not found')) {
          throw new ApiError(
            `Storage bucket "avatars" not found. Please create it in Supabase Dashboard > Storage with public access. Error: ${uploadError.message}`,
            ErrorCode.INTERNAL_SERVER_ERROR,
            500
          )
        }
        throw new ApiError(`Failed to upload image to storage: ${uploadError.message}`, ErrorCode.INTERNAL_SERVER_ERROR, 500)
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) {
        throw new ApiError('Failed to get public URL for uploaded image', ErrorCode.INTERNAL_SERVER_ERROR, 500)
      }

      return publicUrl
    }

    const processPhotoInput = async (input: string, label: string): Promise<string> => {
      if (typeof input !== 'string' || input.trim().length === 0) {
        throw new ApiError('Invalid photo input', ErrorCode.INVALID_IMAGE, 400)
      }
      if (/^https?:\/\//i.test(input.trim())) {
        return input.trim()
      }
      return uploadBase64Photo(input, label)
    }

    const primaryPhotoUrl = await processPhotoInput(primaryInput, avatar_name)

    const extraPhotoUrls: string[] = []
    if (Array.isArray(additional_photos)) {
      for (const [index, extra] of additional_photos.entries()) {
        if (typeof extra !== 'string' || extra.trim().length === 0) continue
        try {
          const extraUrl = await processPhotoInput(extra, `${avatar_name}_extra_${index + 1}`)
          extraPhotoUrls.push(extraUrl)
        } catch (extraErr: any) {
          console.warn(`Failed to process additional photo #${index + 1}:`, extraErr?.message || extraErr)
        }
      }
    }

    let avatar
    let autoLookResult: { type: 'ai_generation' | 'photo_look'; id: string } | null = null
    try {
      avatar = await AvatarService.createAvatarFromPhoto(userId, primaryPhotoUrl, avatar_name, extraPhotoUrls)
      autoLookResult = await AvatarService.autoGenerateVerticalLook(
        avatar.heygen_avatar_id,
        primaryPhotoUrl,
        avatar_name
      )
    } catch (heygenError: any) {
      console.error('HeyGen avatar creation failed:', {
        message: heygenError?.message,
        stack: heygenError?.stack,
        response: heygenError?.response?.data,
        status: heygenError?.response?.status,
      })
      throw heygenError
    }

    return {
      message: 'Avatar created successfully. Please start training manually using the "Train Avatar" button.',
      avatar,
      photo_url: primaryPhotoUrl,
      additional_photo_urls: extraPhotoUrls,
      auto_look: autoLookResult
        ? {
          type: autoLookResult.type,
          id: autoLookResult.id,
          note:
            autoLookResult.type === 'ai_generation'
              ? 'AI-generated 9:16 look is being created based on your photo. This may take a few minutes.'
              : 'Photo added as look.',
        }
        : null,
    }
  }

  /**
   * Update avatar metadata
   */
  static async updateAvatar(userId: string, avatarId: string, updates: { avatar_name?: string; gender?: string }) {
    const { supabase } = await import('../lib/supabase.js')

    // Verify ownership
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, user_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      throw new ApiError('Avatar not found', ErrorCode.NOT_FOUND, 404)
    }

    const updateData: any = {}
    if (updates.avatar_name !== undefined) updateData.avatar_name = updates.avatar_name
    if (updates.gender !== undefined) updateData.gender = updates.gender

    const { data: updatedAvatar, error: updateError } = await supabase
      .from('avatars')
      .update(updateData)
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      throw new ApiError(updateError.message || 'Failed to update avatar', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }

    return {
      message: 'Avatar updated successfully',
      avatar: updatedAvatar,
    }
  }

  /**
   * Delete an avatar
   */
  static async deleteAvatar(userId: string, avatarId: string, options: { removeRemote?: boolean } = {}) {
    await AvatarService.deleteAvatar(avatarId, userId, options)
  }

  /**
   * Set avatar as default
   */
  static async setDefault(userId: string, avatarId: string) {
    const avatar = await AvatarService.setDefaultAvatar(avatarId, userId)
    return {
      message: 'Default avatar updated',
      avatar,
    }
  }

  /**
   * Sync avatars from HeyGen
   */
  static async syncFromHeyGen(userId: string) {
    const avatars = await AvatarService.syncAvatarsFromHeyGen(userId)
    return {
      message: 'Avatars synced successfully',
      avatars,
      count: avatars.length,
    }
  }

  /**
   * Generate AI avatar
   */
  static async generateAI(userId: string, request: GenerateAIAvatarRequest) {
    if (!request.name || !request.age || !request.gender || !request.ethnicity || !request.orientation || !request.pose || !request.style || !request.appearance) {
      throw new ApiError('All fields are required for AI avatar generation', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const result = await generateAIAvatar(request)

    const { supabase } = await import('../lib/supabase.js')
    const avatarPayload = {
      user_id: userId,
      heygen_avatar_id: result.generation_id,
      avatar_name: request.name,
      avatar_url: null,
      preview_url: null,
      thumbnail_url: null,
      gender: request.gender,
      age: request.age,
      ethnicity: request.ethnicity,
      status: 'generating',
      is_default: false,
    }

    assignAvatarSource(avatarPayload, 'ai_generated')

    const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
      avatarPayload,
      () =>
        supabase
          .from('avatars')
          .insert(avatarPayload)
          .select()
          .single()
    )

    if (error) {
      throw new ApiError(`Failed to save avatar generation: ${error.message}`, ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }

    return {
      message: 'AI avatar generation started. Once generation completes, you will need to manually start training.',
      generation_id: result.generation_id,
    }
  }

  /**
   * Get generation status
   */
  static async getGenerationStatus(generationId: string, userId?: string) {
    // Just return the raw status from HeyGen.
    // The frontend will:
    // 1) Show all generated photos to the user
    // 2) Call /complete-ai-generation with the selected image
    // 3) Optionally start training after avatar creation
    return await checkGenerationStatus(generationId)
  }

  /**
   * Complete AI generation
   */
  static async completeAIGeneration(userId: string, body: { generation_id: string; image_keys: string[]; avatar_name: string; image_urls?: string[] }) {
    const { generation_id, image_keys, avatar_name, image_urls } = body

    if (!generation_id || !image_keys || !Array.isArray(image_keys) || image_keys.length === 0 || !avatar_name) {
      throw new ApiError('generation_id, image_keys array, and avatar_name are required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const avatar = await AvatarService.completeAIAvatarGeneration(
      userId,
      generation_id,
      image_keys,
      avatar_name,
      image_urls
    )

    return {
      message: 'AI avatar created successfully',
      avatar,
    }
  }

  /**
   * Get avatar details including looks
   */
  static async getDetails(userId: string, avatarId: string) {
    const details = await AvatarService.fetchPhotoAvatarDetails(avatarId, userId)
    return details
  }

  /**
   * Set default look
   */
  static async setDefaultLook(userId: string, avatarId: string, lookId: string) {
    if (!lookId) {
      throw new ApiError('look_id is required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, user_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      throw new ApiError('Avatar not found', ErrorCode.NOT_FOUND, 404)
    }

    const { error: updateError } = await supabase
      .from('avatars')
      .update({ default_look_id: lookId })
      .eq('id', avatarId)
      .eq('user_id', userId)

    if (updateError) {
      throw new ApiError(updateError.message || 'Failed to set default look', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }

    return {
      message: 'Default look updated successfully',
      default_look_id: lookId,
    }
  }

  /**
   * Delete a look
   */
  static async deleteLook(userId: string, avatarId: string, lookId: string) {
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, user_id, default_look_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      throw new ApiError('Avatar not found', ErrorCode.NOT_FOUND, 404)
    }

    if (avatar.default_look_id === lookId) {
      throw new ApiError('Cannot delete the selected look. Please select a different look first.', ErrorCode.VALIDATION_ERROR, 400)
    }

    const { deletePhotoAvatar } = await import('../lib/heygen.js')
    await deletePhotoAvatar(lookId)
  }

  /**
   * Train an avatar
   */
  static async trainAvatar(userId: string, avatarId: string) {
    const { supabase } = await import('../lib/supabase.js')

    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      throw new ApiError('Avatar not found', ErrorCode.NOT_FOUND, 404)
    }

    const groupId = avatar.heygen_avatar_id
    const { checkTrainingStatus } = await import('../lib/heygen.js')

    // Check training status, but handle case where avatar might not be available in HeyGen yet
    let currentStatus: { status: string } | null = null
    try {
      currentStatus = await checkTrainingStatus(groupId)
    } catch (statusError: any) {
      console.warn(`[Train Avatar] Could not check training status for group ${groupId}:`, statusError.message)
      // If avatar isn't available in HeyGen yet, continue with photo readiness check
      // This can happen right after avatar creation
    }

    if (currentStatus?.status === 'ready') {
      try {
        const { getPhotoAvatarDetails } = await import('../lib/heygen.js')
        const avatarDetails = await getPhotoAvatarDetails(groupId)

        const updatePayload: any = { status: 'active' }
        if (avatarDetails.image_url) {
          updatePayload.avatar_url = avatarDetails.image_url
          updatePayload.preview_url = avatarDetails.preview_url || avatarDetails.image_url
          updatePayload.thumbnail_url = avatarDetails.thumbnail_url || avatarDetails.preview_url || avatarDetails.image_url
        }

        await supabase
          .from('avatars')
          .update(updatePayload)
          .eq('id', avatarId)

        return {
          message: 'Avatar is already trained and ready to use',
          status: 'ready'
        }
      } catch (detailsError: any) {
        await supabase
          .from('avatars')
          .update({ status: 'active' })
          .eq('id', avatarId)
        return {
          message: 'Avatar is already trained and ready to use',
          status: 'ready'
        }
      }
    }

    if (currentStatus?.status === 'training' || currentStatus?.status === 'pending') {
      // Update database status to match HeyGen status if it differs
      if (avatar.status !== currentStatus.status) {
        await supabase
          .from('avatars')
          .update({ status: currentStatus.status === 'training' ? 'training' : 'pending' })
          .eq('id', avatarId)
      }
      return {
        message: `Avatar is currently ${currentStatus.status}. Please wait for training to complete.`,
        status: currentStatus.status
      }
    }

    // Get looks for training - use proper function to fetch looks
    const { fetchAvatarGroupLooks, waitForLooksReady } = await import('../lib/heygen.js')

    let allLooks: any[] = []
    try {
      // Fetch all looks from the avatar group
      allLooks = await fetchAvatarGroupLooks(groupId)
      console.log(`[Train Avatar] Found ${allLooks.length} look(s) in group ${groupId}`)
    } catch (detailsError: any) {
      console.warn('[Train Avatar] Could not get avatar looks:', detailsError.message)
      // If avatar group doesn't exist yet or looks aren't available, provide helpful error
      // Don't update avatar status - keep it as pending so user can retry
      const errorMessage = detailsError.response?.status === 404
        ? 'Avatar is still being created. Please wait a moment and try again.'
        : 'Failed to fetch avatar looks. The avatar may still be processing. Please try again in a moment.'
      throw new ApiError(errorMessage, ErrorCode.VALIDATION_ERROR, 400)
    }

    if (allLooks.length === 0) {
      // Don't update avatar status on error - keep it as pending so user can retry
      throw new ApiError(
        'No photos found for this avatar yet. The photos may still be uploading. Please wait a moment and try again.',
        ErrorCode.VALIDATION_ERROR,
        400
      )
    }

    // Extract look IDs from all looks
    const allLookIds = allLooks
      .filter((look: any) => look?.id)
      .map((look: any) => look.id)

    if (allLookIds.length === 0) {
      throw new ApiError('No valid look IDs found. Please add photos before training.', ErrorCode.VALIDATION_ERROR, 400)
    }

    // Wait for looks to be ready (if not using default_look_id)
    let readyLookIds: string[] = []
    if (avatar.default_look_id) {
      // If default_look_id is set, use it directly but verify it exists
      if (allLookIds.includes(avatar.default_look_id)) {
        readyLookIds = [avatar.default_look_id]
        console.log(`[Train Avatar] Using default_look_id: ${avatar.default_look_id}`)
      } else {
        console.warn(`[Train Avatar] Default look ID ${avatar.default_look_id} not found in group. Falling back to all looks.`)
        readyLookIds = allLookIds
      }
    } else {
      // Wait for at least one look to be ready
      try {
        console.log(`[Train Avatar] Waiting for looks to be ready for group ${groupId}...`)
        const waitResult = await waitForLooksReady(groupId, allLookIds, {
          minReadyLooks: 1,
          maxWaitTime: 120000, // Wait up to 120 seconds (2 minutes) for photos to upload
          pollInterval: 5000, // Poll every 5 seconds
        })
        readyLookIds = waitResult.readyLooks
          .filter((look: any) => look?.id)
          .map((look: any) => look.id)
        console.log(`[Train Avatar] Found ${readyLookIds.length} ready look(s) for training`)
      } catch (waitError: any) {
        console.warn('[Train Avatar] Looks may not be ready yet:', waitError.message)
        // Fallback: try to use all looks if they exist
        // Filter looks that are not failed or pending upload
        readyLookIds = allLooks
          .filter((look: any) => {
            if (!look?.id) return false
            const status = look.status?.toLowerCase()
            // Exclude failed looks
            if (status === 'failed') return false
            // Exclude looks that are clearly pending upload
            if (look.upscale_availability?.reason?.includes('upload')) return false
            return true
          })
          .map((look: any) => look.id)

        if (readyLookIds.length === 0) {
          // Don't update avatar status on error - keep it as pending so user can retry
          throw new ApiError(
            'No photos are ready for training yet. The photos may still be uploading. Please wait a minute and try again.',
            ErrorCode.VALIDATION_ERROR,
            400
          )
        }
        console.log(`[Train Avatar] Using ${readyLookIds.length} look(s) for training (fallback mode)`)
      }
    }

    if (readyLookIds.length === 0) {
      // Don't update avatar status on error - keep it as pending so user can retry
      throw new ApiError(
        'No photos are ready for training yet. Please wait for photo upload to complete and try again in a moment.',
        ErrorCode.VALIDATION_ERROR,
        400
      )
    }

    const lookIds = readyLookIds

    const { trainAvatarGroup } = await import('../lib/heygen.js')

    let trainResponse: any
    try {
      trainResponse = await trainAvatarGroup(groupId, lookIds)
    } catch (trainError: any) {
      console.error('[Train Avatar] Failed to start training:', trainError.response?.data || trainError.message)
      // Don't update avatar status on error - keep it as pending so user can retry
      const errorMessage = trainError.response?.data?.error?.message
        || trainError.response?.data?.message
        || 'Failed to start training. Please try again in a moment.'
      throw new ApiError(errorMessage, ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }

    // Only update status to training if the API call succeeded
    await supabase
      .from('avatars')
      .update({ status: 'training' })
      .eq('id', avatarId)

    return {
      message: 'Training started successfully. This may take a few minutes.',
      status: 'training',
      data: trainResponse.data?.data || trainResponse.data,
    }
  }

  /**
   * Get training status
   */
  static async getTrainingStatus(userId: string, groupId: string) {
    const status = await checkTrainingStatus(groupId)
    const normalizedStatus = status.status === 'ready' ? 'active' : status.status

    try {
      const { supabase } = await import('../lib/supabase.js')

      const updatePayload: any = {
        status: normalizedStatus,
        updated_at: new Date().toISOString(),
      }

      if (normalizedStatus === 'active') {
        try {
          const { getPhotoAvatarDetails } = await import('../lib/heygen.js')
          const avatarDetails = await getPhotoAvatarDetails(groupId)
          if (avatarDetails.image_url) {
            updatePayload.avatar_url = avatarDetails.image_url
            updatePayload.preview_url = avatarDetails.preview_url || avatarDetails.image_url
            updatePayload.thumbnail_url = avatarDetails.thumbnail_url || avatarDetails.preview_url || avatarDetails.image_url
          }
        } catch (detailsError: any) {
          console.warn('[Training Status] Could not fetch avatar details:', detailsError.message)
        }
      }

      await supabase
        .from('avatars')
        .update(updatePayload)
        .eq('user_id', userId)
        .eq('heygen_avatar_id', groupId)
    } catch (dbError) {
      console.warn('Failed to persist training status locally:', dbError)
    }

    return status
  }

  /**
   * Batch fetch looks
   */
  static async batchFetchLooks(userId: string, avatarIdsParam: string) {
    if (!avatarIdsParam || typeof avatarIdsParam !== 'string') {
      throw new ApiError('avatarIds query parameter is required (comma-separated)', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const avatarIdList = avatarIdsParam.split(',').map(id => id.trim()).filter(Boolean)

    if (avatarIdList.length === 0) {
      throw new ApiError('At least one avatar ID is required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    if (avatarIdList.length > 20) {
      throw new ApiError('Maximum 20 avatar IDs allowed per request', ErrorCode.VALIDATION_ERROR, 400)
    }

    const { supabase } = await import('../lib/supabase.js')
    const { data: avatars, error: avatarsError } = await supabase
      .from('avatars')
      .select('id, heygen_avatar_id')
      .eq('user_id', userId)
      .in('id', avatarIdList)

    if (avatarsError) {
      throw new ApiError(avatarsError.message || 'Failed to fetch avatars', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }

    if (!avatars || avatars.length === 0) {
      throw new ApiError('No avatars found', ErrorCode.NOT_FOUND, 404)
    }

    const axios = (await import('axios')).default
    const apiKey = process.env.HEYGEN_KEY
    const HEYGEN_V2_API_URL = process.env.HEYGEN_V2_API_URL || 'https://api.heygen.com/v2'

    if (!apiKey) {
      throw new ApiError('HeyGen API key not configured', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }

    const looksPromises = avatars.map(async (avatar) => {
      const cachedLooks = lookCache.get(avatar.id)
      if (cachedLooks) {
        return { avatarId: avatar.id, looks: cachedLooks }
      }

      try {
        const looksResponse = await axios.get(
          `${HEYGEN_V2_API_URL}/avatar_group/${avatar.heygen_avatar_id}/avatars`,
          {
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        )

        const avatarList =
          looksResponse.data?.data?.avatar_list ||
          looksResponse.data?.avatar_list ||
          looksResponse.data?.data ||
          []

        const looks = Array.isArray(avatarList)
          ? avatarList.map((look: any) => ({
            id: look.id,
            name: look.name,
            status: look.status,
            image_url: look.image_url,
            preview_url: look.image_url,
            thumbnail_url: look.image_url,
            created_at: look.created_at,
            updated_at: look.updated_at,
          }))
          : []

        lookCache.set(avatar.id, looks)

        return { avatarId: avatar.id, looks }
      } catch (error: any) {
        console.warn(`[Batch Looks] Failed to fetch looks for avatar ${avatar.id}:`, error.message)
        return { avatarId: avatar.id, looks: [], error: error.message }
      }
    })

    const results = await Promise.all(looksPromises)

    const looksByAvatar: Record<string, any[]> = {}
    for (const result of results) {
      looksByAvatar[result.avatarId] = result.looks
    }

    return { looks: looksByAvatar }
  }

  /**
   * Add looks to avatar group
   * NOTE: We do NOT automatically retrain after adding looks - retraining is expensive
   * and must be done manually by the user via the "Train Avatar" button if they want to.
   */
  static async addLooks(userId: string, request: AddLooksRequest) {
    if (!request.group_id || !request.image_keys || !Array.isArray(request.image_keys) || request.image_keys.length === 0) {
      throw new ApiError('group_id and image_keys array are required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const result = await addLooksToAvatarGroup(request)
    await AvatarService.syncAvatarsFromHeyGen(userId)

    // Invalidate look cache for all avatars with this group_id so new looks show up immediately
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatars } = await supabase
      .from('avatars')
      .select('id')
      .eq('heygen_avatar_id', request.group_id)
      .eq('user_id', userId)

    if (avatars && avatars.length > 0) {
      avatars.forEach(avatar => {
        lookCache.invalidate(avatar.id)
      })
      console.log(`[Add Looks] Invalidated look cache for ${avatars.length} avatar(s)`)
    }

    // IMPORTANT: We do NOT call trainAvatarGroup here - retraining is expensive
    // and must be done manually by the user if they want to include new looks in training

    return {
      message: 'Looks added successfully',
      photo_avatar_list: result.photo_avatar_list,
    }
  }

  /**
   * Generate a look
   * NOTE: We do NOT automatically retrain after generating looks - retraining is expensive
   * and must be done manually by the user via the "Train Avatar" button if they want to.
   */
  static async generateLook(userId: string, request: GenerateLookRequest) {
    const requiredValidation = validateRequired(request, ['group_id', 'prompt', 'orientation', 'pose', 'style'])
    validateOrThrow(requiredValidation, ErrorCode.MISSING_REQUIRED_FIELD)

    const promptValidation = validateStringLength(request.prompt, 1, 500, 'prompt')
    validateOrThrow(promptValidation, ErrorCode.VALIDATION_ERROR)

    const orientationValidation = validateEnum(request.orientation, ['vertical', 'horizontal', 'square'], 'orientation')
    validateOrThrow(orientationValidation, ErrorCode.VALIDATION_ERROR)

    const poseValidation = validateEnum(request.pose, ['half_body', 'full_body', 'close_up'], 'pose')
    validateOrThrow(poseValidation, ErrorCode.VALIDATION_ERROR)

    const styleValidation = validateEnum(request.style, ['Realistic', 'Cartoon', 'Anime'], 'style')
    validateOrThrow(styleValidation, ErrorCode.VALIDATION_ERROR)

    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar } = await supabase
      .from('avatars')
      .select('id, default_look_id, heygen_avatar_id, gender, avatar_name, age, ethnicity')
      .eq('heygen_avatar_id', request.group_id)
      .eq('user_id', userId)
      .single()

    // Check training status
    const checkTrainingStatusWithTimeout = async (): Promise<any> => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Training status check timed out after ${TRAINING_STATUS_CHECK_TIMEOUT / 1000}s`)), TRAINING_STATUS_CHECK_TIMEOUT)
      )

      return Promise.race([
        checkTrainingStatus(request.group_id),
        timeoutPromise
      ])
    }

    let lastError: any = null
    let trainingStatus: any = null

    for (let attempt = 1; attempt <= TRAINING_STATUS_CHECK_RETRIES; attempt++) {
      try {
        trainingStatus = await checkTrainingStatusWithTimeout()
        lastError = null
        break
      } catch (error: any) {
        lastError = error
        if (attempt < TRAINING_STATUS_CHECK_RETRIES) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
        }
      }
    }

    if (lastError) {
      throw new ApiError(
        `Failed to verify training status: ${lastError.message}. Please try again later.`,
        ErrorCode.INTERNAL_SERVER_ERROR,
        500
      )
    }

    if (trainingStatus && trainingStatus.status !== 'ready') {
      if (trainingStatus.status === 'empty') {
        throw new ApiError(
          'Avatar group is not trained yet. Please wait for training to complete before generating looks.',
          ErrorCode.VALIDATION_ERROR,
          400
        )
      } else if (trainingStatus.status === 'failed') {
        throw new ApiError(
          `Avatar training failed: ${trainingStatus.error_msg || 'Unknown error'}. Cannot generate looks.`,
          ErrorCode.VALIDATION_ERROR,
          400
        )
      } else if (trainingStatus.status === 'training' || trainingStatus.status === 'pending') {
        throw new ApiError(
          `Avatar is still training (status: ${trainingStatus.status}). Please wait for training to complete before generating looks.`,
          ErrorCode.VALIDATION_ERROR,
          400
        )
      }
    }

    // Fetch looks from the avatar group to use the selected photo as base for generation
    // This ensures generated looks match the original person's appearance
    const { fetchAvatarGroupLooks } = await import('../lib/heygen.js')

    // Initialize with default look ID if available (optimistic approach)
    // This ensures we have a base look even if the list fetch fails below
    let photoAvatarId: string | undefined = avatar?.default_look_id || undefined

    try {
      const looks = await fetchAvatarGroupLooks(request.group_id)
      if (looks && looks.length > 0) {
        // ALWAYS use the first look in the group as the base for generation.
        // The first look is the "ground truth" identity. Using subsequent looks
        // as a base can lead to identity drift and "mismatch" errors from HeyGen.
        photoAvatarId = looks[0].id
        console.log(`[Generate Look] Using the first look ${photoAvatarId} as base for generation to ensure maximum identity consistency`)
      } else {
        console.warn(`[Generate Look] No looks found in group ${request.group_id}. Using default look ID ${photoAvatarId} if available.`)
      }
    } catch (looksError: any) {
      console.warn(`[Generate Look] Failed to fetch looks for base reference:`, looksError.message)
      // If we have a default look ID, keep using it optimistically even if list fetch failed
      if (photoAvatarId) {
        console.log(`[Generate Look] Optimistically using default look ${photoAvatarId} despite list fetch failure`)
      }
    }

    // Enhance prompt with gender if available and not already present
    // This helps prevent gender drift in generated looks
    let enhancedPrompt = request.prompt
    if (avatar?.gender) {
      const genderTerm = String(avatar.gender).toLowerCase()
      const promptLower = enhancedPrompt.toLowerCase()

      // Check if gender is already mentioned (e.g. "man", "woman", "male", "female", "boy", "girl")
      const hasGenderContext =
        promptLower.includes('man') ||
        promptLower.includes('woman') ||
        promptLower.includes('male') ||
        promptLower.includes('female') ||
        promptLower.includes('boy') ||
        promptLower.includes('girl')

      if (!hasGenderContext) {
        // Include ethnicity and gender in the prompt to strongly reinforce identity preservation
        const ethnicityPrefix = avatar.ethnicity && avatar.ethnicity !== 'Unspecified' ? `${avatar.ethnicity} ` : ''
        enhancedPrompt = `A photo of the same ${ethnicityPrefix}${avatar.gender}, ${enhancedPrompt}, maintaining exact facial features and identity.`
        console.log(`[Generate Look] Enhanced prompt for identity preservation: "${enhancedPrompt}"`)
      }
    }

    // Include photo_avatar_id in the request to ensure generated looks match the selected avatar photo
    const generateRequest = {
      ...request,
      prompt: enhancedPrompt,
      photo_avatar_id: photoAvatarId,
      name: request.prompt ? request.prompt.substring(0, 50) : `Look ${new Date().toISOString().split('T')[0]}`,
      age: avatar?.age || 'Young Adult',
      gender: avatar?.gender || 'Man',
      ethnicity: avatar?.ethnicity || 'White',
    }

    const result = await generateAvatarLook(generateRequest)

    if (result.generation_id) {
      const lookName = request.prompt || `Look ${new Date().toISOString().split('T')[0]}`
      const avatarId = avatar?.id
      pollLookGenerationStatus(result.generation_id, request.group_id, lookName, userId, avatarId).catch(err => {
        console.error('[Generate Look] Background polling failed:', err.message)
      })

      const job = jobManager.getJobByGenerationId(result.generation_id, 'look_generation')
      return {
        message: 'Look generation started',
        generation_id: result.generation_id,
        job_id: job?.id,
      }
    }

    return {
      message: 'Look generation started',
      generation_id: result.generation_id,
    }
  }

  /**
   * Upload look image
   */
  static async uploadLookImage(body: { photo_data: string }) {
    const { photo_data } = body

    if (!photo_data) {
      throw new ApiError('photo_data is required', ErrorCode.MISSING_REQUIRED_FIELD, 400)
    }

    const imageKey = await uploadImageToHeyGen(photo_data)

    return {
      image_key: imageKey,
    }
  }

  /**
   * Get jobs
   */
  static async getJobs(userId: string, type?: string) {
    const jobs = jobManager.getUserJobs(userId, type as any)
    return { jobs }
  }

  /**
   * Get a specific job
   */
  static async getJob(userId: string, jobId: string) {
    const job = jobManager.getJob(jobId)

    if (!job) {
      throw new ApiError('Job not found', ErrorCode.NOT_FOUND, 404)
    }

    if (job.userId && job.userId !== userId) {
      throw new ApiError('Access denied', ErrorCode.FORBIDDEN, 403)
    }

    return job
  }

  /**
   * Cancel a job
   */
  static async cancelJob(userId: string, jobId: string) {
    const job = jobManager.getJob(jobId)

    if (!job) {
      throw new ApiError('Job not found', ErrorCode.NOT_FOUND, 404)
    }

    if (job.userId && job.userId !== userId) {
      throw new ApiError('Access denied', ErrorCode.FORBIDDEN, 403)
    }

    const cancelled = jobManager.cancelJob(jobId)

    if (!cancelled) {
      throw new ApiError('Job cannot be cancelled (already completed, failed, or cancelled)', ErrorCode.VALIDATION_ERROR, 400)
    }

    return {
      message: 'Job cancelled successfully',
      job: jobManager.getJob(jobId),
    }
  }
}

