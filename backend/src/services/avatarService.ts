import { supabase } from '../lib/supabase.js'
import {
  listAvatars as listHeyGenAvatars,
  getAvatar as getHeyGenAvatar,
  getPhotoAvatarDetails,
  deletePhotoAvatar,
  deletePhotoAvatarGroup,
  upscalePhotoAvatar,
  generateAvatarLook,
  addLooksToAvatarGroup,
  uploadImageToHeyGen,
  checkTrainingStatus,
  checkGenerationStatus,
  trainAvatarGroup,
  fetchAvatarGroupLooks,
} from '../lib/heygen.js'
import type {
  HeyGenAvatar,
  PhotoAvatarDetails,
  GenerateLookRequest,
  GenerationStatus,
} from '../lib/heygen.js'
import {
  AvatarSource,
  assignAvatarSource,
  executeWithAvatarSourceFallback,
  isAvatarSourceColumnEnabled,
} from '../lib/avatarSourceColumn.js'

const AUTO_LOOKS_ENABLED =
  process.env.HEYGEN_AUTO_LOOKS_ENABLED?.toLowerCase() === 'false' ? false : true

const AUTO_LOOK_ORIENTATION: GenerateLookRequest['orientation'] =
  (process.env.HEYGEN_AUTO_LOOK_ORIENTATION as GenerateLookRequest['orientation']) || 'vertical'

const AUTO_LOOK_POSE: GenerateLookRequest['pose'] =
  (process.env.HEYGEN_AUTO_LOOK_POSE as GenerateLookRequest['pose']) || 'half_body'

const AUTO_LOOK_STYLE: GenerateLookRequest['style'] =
  (process.env.HEYGEN_AUTO_LOOK_STYLE as GenerateLookRequest['style']) || 'Realistic'

const AUTO_LOOK_PROMPT_TEMPLATE =
  process.env.HEYGEN_AUTO_LOOK_PROMPT?.trim() ||
  'Ultra-realistic vertical portrait of {{name}} in 9:16 aspect ratio, half-body shot, looking directly at camera, professional studio lighting, clean neutral background, high quality, cinematic framing.'

const AUTO_LOOK_GENERATION_TIMEOUT_MS =
  Number(process.env.HEYGEN_AUTO_LOOK_GENERATION_TIMEOUT_MS) || 5 * 60 * 1000

const AUTO_LOOK_GENERATION_POLL_INTERVAL_MS =
  Number(process.env.HEYGEN_AUTO_LOOK_GENERATION_POLL_INTERVAL_MS) || 5000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const buildAutoLookPrompt = (avatarName?: string): string => {
  const safeName = avatarName?.trim() || 'the speaker'
  const replaced = AUTO_LOOK_PROMPT_TEMPLATE.replace(/{{\s*name\s*}}/gi, safeName)
  if (replaced !== AUTO_LOOK_PROMPT_TEMPLATE) {
    return replaced
  }
  return `${AUTO_LOOK_PROMPT_TEMPLATE} ${safeName}`.trim()
}

export interface Avatar {
  id: string
  user_id: string
  heygen_avatar_id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
  gender: string | null
  status: string
  is_default: boolean
  created_at: string
  updated_at: string
  source: AvatarSource | null
}

export class AvatarService {
  /**
   * Sync available avatars from HeyGen API and save to database
   */
  static async syncAvatarsFromHeyGen(userId: string): Promise<Avatar[]> {
    try {
      const heygenAvatars = await listHeyGenAvatars()
      const syncedAvatars: Avatar[] = []

      for (const heygenAvatar of heygenAvatars.avatars) {
        // Check if avatar already exists for this user
        const { data: existing } = await supabase
          .from('avatars')
          .select('*')
          .eq('user_id', userId)
          .eq('heygen_avatar_id', heygenAvatar.avatar_id)
          .single()

        if (existing) {
          // Update existing avatar
          const { data, error } = await supabase
            .from('avatars')
            .update({
              avatar_name: heygenAvatar.avatar_name,
              avatar_url: heygenAvatar.avatar_url || null,
              preview_url: heygenAvatar.preview_url || null,
              thumbnail_url: heygenAvatar.thumbnail_url || null,
              gender: heygenAvatar.gender || null,
              status: heygenAvatar.status || 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (!error && data) {
            syncedAvatars.push(data)
          }
        } else {
          // Insert new avatar
          const newAvatarPayload = {
            user_id: userId,
            heygen_avatar_id: heygenAvatar.avatar_id,
            avatar_name: heygenAvatar.avatar_name,
            avatar_url: heygenAvatar.avatar_url || null,
            preview_url: heygenAvatar.preview_url || null,
            thumbnail_url: heygenAvatar.thumbnail_url || null,
            gender: heygenAvatar.gender || null,
            status: heygenAvatar.status || 'active',
            is_default: false,
          }

          assignAvatarSource(newAvatarPayload, 'synced')

          const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
            newAvatarPayload,
            () =>
              supabase
                .from('avatars')
                .insert(newAvatarPayload)
                .select()
                .single()
          )

          if (!error && data) {
            syncedAvatars.push(data)
          }
        }
      }

      return syncedAvatars
    } catch (error: any) {
      console.error('Sync avatars error:', error)
      throw new Error(`Failed to sync avatars: ${error.message}`)
    }
  }

  /**
   * Get all avatars for a user
   */
  static async getUserAvatars(userId: string): Promise<Avatar[]> {
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'training'])
      .neq('status', 'deleted') // Exclude deleted avatars
      .order('is_default', { ascending: false })
      .order('avatar_name', { ascending: true })

    if (error) throw error
    return data || []
  }

  /**
   * Get default avatar for a user
   */
  static async getDefaultAvatar(userId: string): Promise<Avatar | null> {
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data || null
  }

  /**
   * Get avatar by ID
   */
  static async getAvatarById(avatarId: string, userId: string): Promise<Avatar | null> {
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  }

  /**
   * Set avatar as default
   */
  static async setDefaultAvatar(avatarId: string, userId: string): Promise<Avatar> {
    // Verify ownership
    const avatar = await this.getAvatarById(avatarId, userId)
    if (!avatar) {
      throw new Error('Avatar not found')
    }

    // Update all avatars for this user to remove default flag
    await supabase
      .from('avatars')
      .update({ is_default: false })
      .eq('user_id', userId)

    // Set this avatar as default
    const { data, error } = await supabase
      .from('avatars')
      .update({ is_default: true })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Add a new avatar from HeyGen
   */
  static async addAvatarFromHeyGen(userId: string, heygenAvatarId: string): Promise<Avatar> {
    try {
      // Get avatar details from HeyGen
      const heygenAvatar = await getHeyGenAvatar(heygenAvatarId)

      // Check if already exists
      const { data: existing } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .eq('heygen_avatar_id', heygenAvatarId)
        .single()

      if (existing) {
        return existing
      }

      // Insert new avatar
      const newAvatarPayload = {
        user_id: userId,
        heygen_avatar_id: heygenAvatar.avatar_id,
        avatar_name: heygenAvatar.avatar_name,
        avatar_url: heygenAvatar.avatar_url || null,
        preview_url: heygenAvatar.preview_url || null,
        thumbnail_url: heygenAvatar.thumbnail_url || null,
        gender: heygenAvatar.gender || null,
        status: heygenAvatar.status || 'active',
        is_default: false,
      }

      assignAvatarSource(newAvatarPayload, 'synced')

      const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
        newAvatarPayload,
        () =>
          supabase
            .from('avatars')
            .insert(newAvatarPayload)
            .select()
            .single()
      )

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Add avatar error:', error)
      throw new Error(`Failed to add avatar: ${error.message}`)
    }
  }

  /**
   * Delete avatar (soft delete by setting status to inactive)
   */
  static async deleteAvatar(
    avatarId: string,
    userId: string,
    options: { removeRemote?: boolean } = {}
  ): Promise<void> {
    const avatar = await this.getAvatarById(avatarId, userId)
    if (!avatar) {
      throw new Error('Avatar not found')
    }

    // Don't allow deleting default avatar without setting a new one
    if (avatar.is_default) {
      throw new Error('Cannot delete default avatar. Please set another avatar as default first.')
    }

    if (options.removeRemote && this.isUserCreatedAvatar(avatar)) {
      await this.removeRemotePhotoAvatarResources(avatar)
    }

    const { error } = await supabase
      .from('avatars')
      .update({ status: 'inactive' })
      .eq('id', avatarId)
      .eq('user_id', userId)

    if (error) throw error
  }

  private static isUserCreatedAvatar(avatar: Avatar | null): boolean {
    if (!avatar) return false

    if (avatar.source === 'user_photo' || avatar.source === 'ai_generated') {
      return true
    }

    if (avatar.source === 'synced') {
      return false
    }

    if (avatar.avatar_url && avatar.avatar_url.includes('supabase.co/storage')) {
      return true
    }
    if (['training', 'pending', 'generating'].includes(avatar.status)) {
      return true
    }
    if (!avatar.avatar_url && avatar.status !== 'active') {
      return true
    }
    if (avatar.status === 'active' && !avatar.avatar_url) {
      return true
    }
    return false
  }

  private static async removeRemotePhotoAvatarResources(avatar: Avatar): Promise<void> {
    try {
      await deletePhotoAvatar(avatar.heygen_avatar_id)
    } catch (error: any) {
      console.warn('Failed to delete photo avatar look in HeyGen:', error.response?.data || error.message)
    }

    try {
      await deletePhotoAvatarGroup(avatar.heygen_avatar_id)
    } catch (error: any) {
      console.warn('Failed to delete photo avatar group in HeyGen:', error.response?.data || error.message)
    }
  }

  static async fetchPhotoAvatarDetails(avatarId: string, userId: string): Promise<PhotoAvatarDetails> {
    const avatar = await this.getAvatarById(avatarId, userId)
    if (!avatar) {
      throw new Error('Avatar not found')
    }

    // Check if this is a photo avatar (user_photo or ai_generated)
    const isPhotoAvatar = avatar.source === 'user_photo' || avatar.source === 'ai_generated' ||
      (avatar.avatar_url && avatar.avatar_url.includes('supabase.co/storage'))

    if (!isPhotoAvatar) {
      // For non-photo avatars, return basic information from the database
      return {
        id: avatar.heygen_avatar_id,
        group_id: avatar.heygen_avatar_id,
        status: avatar.status || 'active',
        image_url: avatar.avatar_url ?? undefined,
        preview_url: avatar.preview_url ?? undefined,
        thumbnail_url: avatar.thumbnail_url ?? undefined,
        created_at: avatar.created_at ? new Date(avatar.created_at).getTime() / 1000 : undefined,
        updated_at: avatar.updated_at ? new Date(avatar.updated_at).getTime() / 1000 : null,
      }
    }

    try {
      // Fetch photo avatar details
      // Note: avatar.heygen_avatar_id is a group_id, not an individual photo_avatar_id
      // getPhotoAvatarDetails will try to resolve it, but may fail if it's truly a group_id
      let details: PhotoAvatarDetails
      try {
        details = await getPhotoAvatarDetails(avatar.heygen_avatar_id)
      } catch (detailsError: any) {
        // If getPhotoAvatarDetails fails (e.g., because it's a group_id), 
        // we'll still fetch looks from the group directly below
        console.log(`[Avatar Details] getPhotoAvatarDetails failed for ${avatar.heygen_avatar_id}, will fetch looks from group directly:`, detailsError.message)
        const isUserCreated = this.isUserCreatedAvatar(avatar)
        
        if (!isUserCreated && avatar.source === 'synced') {
          // Synced avatars that aren't found should be marked as deleted
          console.warn(`[Avatar Details] Synced avatar ${avatarId} (${avatar.avatar_name}) not found in HeyGen - marking as deleted`)
          
          if (avatar.status !== 'deleted') {
            const { error: updateError } = await supabase
              .from('avatars')
              .update({ status: 'deleted' })
              .eq('id', avatarId)
            
            if (updateError) {
              console.error(`[Avatar Details] Failed to mark avatar ${avatarId} as deleted:`, updateError)
            } else {
              console.log(`[Avatar Details] Successfully marked avatar ${avatarId} (${avatar.avatar_name}) as deleted`)
            }
          }
          
          return {
            id: avatar.heygen_avatar_id,
            group_id: avatar.heygen_avatar_id,
            status: 'deleted',
            image_url: avatar.avatar_url ?? undefined,
            preview_url: avatar.preview_url ?? undefined,
            thumbnail_url: avatar.thumbnail_url ?? undefined,
            created_at: avatar.created_at ? new Date(avatar.created_at).getTime() / 1000 : undefined,
            updated_at: avatar.updated_at ? new Date(avatar.updated_at).getTime() / 1000 : null,
            looks: [],
          }
        }
        
        // For user-created avatars, create a basic details object and continue to fetch looks
        details = {
          id: avatar.heygen_avatar_id,
          group_id: avatar.heygen_avatar_id,
          status: avatar.status || 'pending',
          image_url: avatar.avatar_url ?? undefined,
          preview_url: avatar.preview_url ?? undefined,
          thumbnail_url: avatar.thumbnail_url ?? undefined,
          created_at: avatar.created_at ? new Date(avatar.created_at).getTime() / 1000 : undefined,
          updated_at: avatar.updated_at ? new Date(avatar.updated_at).getTime() / 1000 : null,
        }
      }

      // If avatar doesn't exist in HeyGen (status is 'unknown'), handle based on avatar type
      if (details.status === 'unknown') {
        const isUserCreated = this.isUserCreatedAvatar(avatar)
        
        // Only mark synced avatars as deleted if they're not found in HeyGen
        if (!isUserCreated && avatar.source === 'synced') {
          console.warn(`[Avatar Details] Synced avatar ${avatarId} (${avatar.avatar_name}) not found in HeyGen - marking as deleted`)
          
          if (avatar.status !== 'deleted') {
            const { error: updateError } = await supabase
              .from('avatars')
              .update({ status: 'deleted' })
              .eq('id', avatarId)
            
            if (updateError) {
              console.error(`[Avatar Details] Failed to mark avatar ${avatarId} as deleted:`, updateError)
            } else {
              console.log(`[Avatar Details] Successfully marked avatar ${avatarId} (${avatar.avatar_name}) as deleted`)
            }
          }
          
          return {
            id: avatar.heygen_avatar_id,
            group_id: avatar.heygen_avatar_id,
            status: 'deleted',
            image_url: avatar.avatar_url ?? undefined,
            preview_url: avatar.preview_url ?? undefined,
            thumbnail_url: avatar.thumbnail_url ?? undefined,
            created_at: avatar.created_at ? new Date(avatar.created_at).getTime() / 1000 : undefined,
            updated_at: avatar.updated_at ? new Date(avatar.updated_at).getTime() / 1000 : null,
            looks: [],
          }
        }
        
        // For user-created avatars with 'unknown' status, update details but continue to fetch looks
        console.log(`[Avatar Details] User-created avatar ${avatarId} (${avatar.avatar_name}) has unknown status, will still fetch looks from group`)
        details = {
          ...details,
          status: avatar.status || 'pending',
        }
      }

      // Also fetch training status to get the real status from HeyGen
      let trainingStatus: string = details.status || 'active'
      try {
        const { checkTrainingStatus } = await import('../lib/heygen.js')
        const status = await checkTrainingStatus(avatar.heygen_avatar_id)
        if (status.status) {
          // Map HeyGen training status to our status
          if (status.status === 'ready') {
            trainingStatus = 'active'
          } else if (status.status === 'empty' || status.status === 'failed') {
            trainingStatus = status.status
          } else if (status.status === 'training' || status.status === 'pending') {
            trainingStatus = 'training'
          }

          // Update database if status differs
          if (avatar.status !== trainingStatus) {
            console.log(`[Avatar Details] Updating avatar ${avatarId} status from ${avatar.status} to ${trainingStatus}`)
            
            // If training is complete (status is 'active'), also update image URLs from HeyGen
            const updatePayload: any = { status: trainingStatus }
            if (trainingStatus === 'active' && details.image_url) {
              updatePayload.avatar_url = details.image_url
              updatePayload.preview_url = details.preview_url || details.image_url
              updatePayload.thumbnail_url = details.thumbnail_url || details.preview_url || details.image_url
            }
            
            await supabase
              .from('avatars')
              .update(updatePayload)
              .eq('id', avatarId)
          }
        }
      } catch (statusError: any) {
        console.warn(`[Avatar Details] Failed to fetch training status:`, statusError.message)
        // Continue with existing status
      }

      // Also fetch looks from the avatar group (with caching)
      // IMPORTANT: avatar.heygen_avatar_id is a group_id, not an individual photo_avatar_id
      // So we fetch looks directly from the group, not from photo_avatar/details
      let looks: any[] = []
      if (avatar.heygen_avatar_id) {
        // Check cache first
        const { lookCache } = await import('../lib/lookCache.js')
        const cachedLooks = lookCache.get(avatarId)

        if (cachedLooks) {
          looks = cachedLooks.map((look: any) => ({
            ...look,
            is_default: (avatar as any)?.default_look_id === look.id,
          }))
          console.log(`[Avatar Details] Found ${looks.length} cached looks for avatar ${avatarId}`)
        } else {
          // Fetch looks directly from the avatar group using fetchAvatarGroupLooks
          try {
            const { fetchAvatarGroupLooks } = await import('../lib/heygen.js')
            const groupLooks = await fetchAvatarGroupLooks(avatar.heygen_avatar_id)
            
            if (Array.isArray(groupLooks) && groupLooks.length > 0) {
              looks = groupLooks.map((look: any) => ({
                id: look.id,
                name: look.name,
                status: look.status,
                image_url: look.image_url,
                preview_url: look.image_url,
                thumbnail_url: look.image_url,
                created_at: look.created_at,
                updated_at: look.updated_at,
                is_default: (avatar as any)?.default_look_id === look.id,
              }))
              console.log(`[Avatar Details] Found ${looks.length} looks for avatar ${avatarId} from group ${avatar.heygen_avatar_id}`)

              // Cache the results (without is_default since it's avatar-specific)
              const looksToCache = looks.map(({ is_default, ...look }) => look)
              lookCache.set(avatarId, looksToCache)
            } else {
              console.log(`[Avatar Details] No looks found for avatar ${avatarId} in group ${avatar.heygen_avatar_id}`)
              // Cache empty array to prevent repeated requests
              lookCache.set(avatarId, [])
            }
          } catch (looksError: any) {
            console.warn(`[Avatar Details] Failed to fetch looks for avatar ${avatarId} (group ${avatar.heygen_avatar_id}):`, looksError.message)
            // Cache empty array to prevent repeated failed requests
            lookCache.set(avatarId, [])
            // Continue without looks - not critical
          }
        }
      }

      return {
        ...details,
        status: trainingStatus, // Use the real training status
        looks,
        default_look_id: (avatar as any)?.default_look_id || null,
      }
    } catch (error: any) {
      // If fetching from HeyGen fails, return basic information from the database
      console.warn('Failed to fetch photo avatar details from HeyGen, returning database info:', error.message)
      return {
        id: avatar.heygen_avatar_id,
        group_id: avatar.heygen_avatar_id,
        status: avatar.status || 'active',
        image_url: avatar.avatar_url ?? undefined,
        preview_url: avatar.preview_url ?? undefined,
        thumbnail_url: avatar.thumbnail_url ?? undefined,
        created_at: avatar.created_at ? new Date(avatar.created_at).getTime() / 1000 : undefined,
        updated_at: avatar.updated_at ? new Date(avatar.updated_at).getTime() / 1000 : null,
      }
    }
  }

  static async upscaleAvatar(avatarId: string, userId: string) {
    const avatar = await this.getAvatarById(avatarId, userId)
    if (!avatar) {
      throw new Error('Avatar not found')
    }

    return upscalePhotoAvatar(avatar.heygen_avatar_id)
  }

  /**
   * Create avatar from photo using HeyGen v2 API
   */
  static async createAvatarFromPhoto(
    userId: string,
    photoUrl: string,
    avatarName: string,
    additionalPhotoUrls: string[] = []
  ): Promise<Avatar> {
    try {
      const { createAvatarFromPhoto } = await import('../lib/heygen.js')
      const result = await createAvatarFromPhoto(photoUrl, avatarName, additionalPhotoUrls)

      // Save to database
      // Save photoUrl as avatar_url to identify user-created avatars
      const newPhotoAvatarPayload = {
        user_id: userId,
        heygen_avatar_id: result.avatar_id,
        avatar_name: avatarName,
        avatar_url: photoUrl, // Save the photo URL to identify user-created avatars
        preview_url: photoUrl,
        thumbnail_url: photoUrl,
        gender: null,
        status: 'pending', // Always start as pending - training must be done manually
        is_default: false,
      }

      assignAvatarSource(newPhotoAvatarPayload, 'user_photo')

      const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
        newPhotoAvatarPayload,
        () =>
          supabase
            .from('avatars')
            .insert(newPhotoAvatarPayload)
            .select()
            .single()
      )

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Create avatar from photo error:', error)
      throw new Error(`Failed to create avatar from photo: ${error.message}`)
    }
  }

  static async autoGenerateVerticalLook(
    groupId: string,
    photoUrl?: string,
    avatarName?: string
  ): Promise<{ type: 'ai_generation' | 'photo_look'; id: string } | null> {
    if (!AUTO_LOOKS_ENABLED) {
      return null
    }

    if (!groupId) {
      return null
    }

    // According to HeyGen support: Only generate looks AFTER training is complete (status: "ready")
    // Step 1: Check training status first
    console.log('[Auto Look] Checking training status before generating look...', { groupId })

    let trainingStatus
    try {
      trainingStatus = await checkTrainingStatus(groupId)
      console.log('[Auto Look] Training status:', {
        groupId,
        status: trainingStatus.status,
        error_msg: trainingStatus.error_msg,
      })
    } catch (statusError: any) {
      console.warn('[Auto Look] Failed to check training status:', statusError.response?.data || statusError.message)
      // If we can't check status, we'll still try to generate (might work if training is already complete)
      trainingStatus = { status: 'unknown' as any }
    }

    // Only proceed if training is ready
    if (trainingStatus.status !== 'ready') {
      if (trainingStatus.status === 'failed') {
        console.warn('[Auto Look] Training failed. Cannot generate AI look. Error:', trainingStatus.error_msg)
        return null
      } else if (trainingStatus.status === 'training' || trainingStatus.status === 'pending') {
        console.log('[Auto Look] Training not yet complete. Status:', trainingStatus.status, {
          groupId,
          note: 'AI look generation will be available once training completes (status: "ready")',
        })
        return null
      } else if (trainingStatus.status === 'empty') {
        console.warn('[Auto Look] Avatar group is empty or not trained yet. Training must be started manually.', {
          groupId,
          status: trainingStatus.status,
        })
        return null
      } else {
        // Unknown status - log warning but try anyway
        console.warn('[Auto Look] Unknown training status:', trainingStatus.status, 'Attempting generation anyway...')
      }
    }

    // Step 2: Generate AI look (training is ready)
    const prompt = buildAutoLookPrompt(avatarName)
    try {
      console.log('[Auto Look] Training is ready. Generating AI look (9:16 format)...', {
        groupId,
        orientation: 'vertical',
        pose: AUTO_LOOK_POSE,
        style: AUTO_LOOK_STYLE,
      })

      // Fetch looks to use the first/default look as base for generation
      // This ensures generated looks match the original person's appearance
      let photoAvatarId: string | undefined = undefined
      try {
        const looks = await fetchAvatarGroupLooks(groupId)
        if (looks && looks.length > 0) {
          photoAvatarId = looks[0].id
          console.log(`[Auto Look] Using look ${photoAvatarId} as base for generation to ensure consistency`)
        }
      } catch (looksError: any) {
        console.warn(`[Auto Look] Failed to fetch looks for base reference:`, looksError.message)
      }

      const response = await generateAvatarLook({
        group_id: groupId,
        prompt,
        orientation: 'vertical', // Force 9:16 format
        pose: AUTO_LOOK_POSE,
        style: AUTO_LOOK_STYLE,
        photo_avatar_id: photoAvatarId, // Use first look as base to preserve identity
      })

      console.log('[Auto Look] ✅ AI look generation started (9:16 format)', {
        groupId,
        generationId: response.generation_id,
        orientation: 'vertical',
        pose: AUTO_LOOK_POSE,
        style: AUTO_LOOK_STYLE,
      })

      if (response.generation_id) {
        try {
          const generationResult = await this.waitForAutoLookGeneration(response.generation_id)
          const imageKeys = generationResult.image_key_list?.filter((key) => !!key) || []

          if (imageKeys.length > 0) {
            const addResult = await addLooksToAvatarGroup({
              group_id: groupId,
              image_keys: imageKeys,
              name: avatarName,
            })

            const lookId =
              addResult.photo_avatar_list?.find((look) => look?.id)?.id ||
              generationResult.id

            if (lookId) {
              console.log('[Auto Look] ✅ AI look generated and added to group', {
                groupId,
                lookId,
                generationId: response.generation_id,
              })

              return {
                type: 'photo_look',
                id: lookId,
              }
            }
          } else {
            console.warn('[Auto Look] Look generation completed but no image keys were returned', {
              groupId,
              generationId: response.generation_id,
            })
          }
        } catch (generationError: any) {
          console.warn(
            '[Auto Look] AI look generation did not finish before timeout (will remain pending in HeyGen)',
            {
              groupId,
              generationId: response.generation_id,
              error: generationError?.message,
            }
          )
        }
      }

      return {
        type: 'ai_generation',
        id: response.generation_id,
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message
      console.error('[Auto Look] Failed to generate AI look:', {
        groupId,
        error: errorMessage,
        responseData: error.response?.data,
      })

      // If training was ready but generation still failed, this is a real error
      if (trainingStatus.status === 'ready') {
        console.error('[Auto Look] Generation failed even though training is ready. This may indicate an API issue.', {
          groupId,
          error: errorMessage,
        })
      }

      return null
    }
  }

  /**
   * Get only user-created avatars (avatars created from uploaded photos or AI-generated)
   * User-created avatars are those that were created by the user (not synced from HeyGen)
   * They either have:
   * - avatar_url pointing to Supabase storage (photo uploads)
   * - status 'generating' (AI generation in progress)
   * - status 'training' or 'pending' (recently created, not synced)
   * We exclude avatars that were synced from HeyGen (which typically have avatar_url from HeyGen CDN)
   */
  static async getUserCreatedAvatars(userId: string): Promise<Avatar[]> {
    // Show all user-created avatars for this user.
    // IMPORTANT: Do NOT over-filter by status here, because older avatars might use
    // statuses like "ready" or other legacy values. We only exclude deleted/inactive,
    // and we filter out explicitly synced avatars using the `source` column.
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .neq('status', 'inactive')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }) // Show newest first
      .order('avatar_name', { ascending: true })

    if (error) throw error

    // SIMPLE FILTER: Only exclude synced/deleted/inactive - show everything else
    return (data || []).filter(avatar => {
      // Exclude deleted/inactive
      if (avatar.status === 'deleted' || avatar.status === 'inactive') {
        return false
      }
      // Exclude ONLY explicitly synced avatars
      if (avatar.source === 'synced') {
        return false
      }
      // Show EVERYTHING else - all other avatars are user-created
      return true
    })
  }

  /**
   * Complete AI avatar generation by creating avatar group from generated images
   */
  static async completeAIAvatarGeneration(
    userId: string,
    generationId: string,
    imageKeys: string[],
    avatarName: string,
    imageUrls?: string[]
  ): Promise<Avatar> {
    try {
      if (!imageKeys || imageKeys.length === 0) {
        throw new Error('No image keys provided for avatar creation')
      }

      const { addLooksToAvatarGroup } = await import('../lib/heygen.js')
      const axios = (await import('axios')).default

      // Create avatar group using the first image_key
      const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'

      // Get API key from environment
      const apiKey = process.env.HEYGEN_KEY
      if (!apiKey) {
        throw new Error('Missing HEYGEN_KEY environment variable')
      }

      // Create avatar group with the first image
      const createGroupResponse = await axios.post(
        `${HEYGEN_V2_API_URL}/photo_avatar/avatar_group/create`,
        {
          name: avatarName,
          image_key: imageKeys[0],
        },
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      const groupId =
        createGroupResponse.data?.data?.id ||
        createGroupResponse.data?.data?.group_id ||
        createGroupResponse.data?.id ||
        createGroupResponse.data?.group_id

      if (!groupId) {
        throw new Error('Failed to get group_id from avatar group creation response')
      }

      const sanitizedImageUrls = Array.isArray(imageUrls)
        ? imageUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        : []
      const primaryImageUrl = sanitizedImageUrls[0] || null

      // Add additional images as looks if there are more
      if (imageKeys.length > 1) {
        try {
          await addLooksToAvatarGroup({
            group_id: groupId,
            image_keys: imageKeys.slice(1),
            name: avatarName,
          })
        } catch (err: any) {
          console.log('Failed to add additional looks (continuing anyway):', err.message)
        }
      }

      // Update the avatar record in database


      const existingAvatarQuery = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .eq('heygen_avatar_id', generationId)
        .maybeSingle()

      const existingAvatar = existingAvatarQuery.data as Avatar | null

      let savedAvatar: Avatar
      if (existingAvatar) {
        const fallbackImageUrl =
          existingAvatar.avatar_url ||
          existingAvatar.preview_url ||
          existingAvatar.thumbnail_url ||
          null
        const resolvedImageUrl = primaryImageUrl || fallbackImageUrl
        const resolvedSource: AvatarSource =
          existingAvatar.source && existingAvatar.source !== 'synced'
            ? existingAvatar.source
            : 'ai_generated'

        const updatePayload = {
          heygen_avatar_id: groupId,
          avatar_url: resolvedImageUrl,
          preview_url: resolvedImageUrl,
          thumbnail_url: resolvedImageUrl,
          status: 'pending', // Set to pending - training must be started manually
          updated_at: new Date().toISOString(),
        }

        assignAvatarSource(updatePayload, resolvedSource)

        const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
          updatePayload,
          () =>
            supabase
              .from('avatars')
              .update(updatePayload)
              .eq('id', existingAvatar.id)
              .select()
              .single()
        )

        if (error) throw error
        savedAvatar = data
      } else {
        const newAvatarPayload = {
          user_id: userId,
          heygen_avatar_id: groupId,
          avatar_name: avatarName,
          avatar_url: primaryImageUrl,
          preview_url: primaryImageUrl,
          thumbnail_url: primaryImageUrl,
          gender: null,
          status: 'pending', // Set to pending - training must be started manually
          is_default: false,
        }

        assignAvatarSource(newAvatarPayload, 'ai_generated')

        const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
          newAvatarPayload,
          () =>
            supabase
              .from('avatars')
              .insert(newAvatarPayload)
              .select()
              .single()
        )

        if (error) throw error
        savedAvatar = data
      }

      // Auto-generation of vertical look disabled; will be triggered after user selects a look


      return savedAvatar
    } catch (error: any) {
      console.error('Complete AI avatar generation error:', error)
      throw new Error(`Failed to complete AI avatar generation: ${error.message}`)
    }
  }

  private static async waitForAutoLookGeneration(generationId: string): Promise<GenerationStatus> {
    console.log('[Auto Look] Waiting for AI look generation to complete...', { generationId })
    const startTime = Date.now()

    while (Date.now() - startTime < AUTO_LOOK_GENERATION_TIMEOUT_MS) {
      try {
        const status = await checkGenerationStatus(generationId)

        if (status.status === 'success') {
          console.log('[Auto Look] AI look generation completed', {
            generationId,
            durationMs: Date.now() - startTime,
            imageKeys: status.image_key_list?.length || 0,
          })
          return status
        }

        if (status.status === 'failed') {
          throw new Error(status.msg || 'HeyGen reported look generation failure')
        }

        console.log('[Auto Look] Look generation still in progress...', {
          generationId,
          status: status.status,
          message: status.msg,
        })
      } catch (error: any) {
        console.warn('[Auto Look] Failed to fetch look generation status (will retry)', {
          generationId,
          error: error.message,
        })
      }

      await delay(AUTO_LOOK_GENERATION_POLL_INTERVAL_MS)
    }

    throw new Error(
      `Timed out after ${Math.round(AUTO_LOOK_GENERATION_TIMEOUT_MS / 1000)}s while waiting for AI look generation ${generationId}`
    )
  }
}
