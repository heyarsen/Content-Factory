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
} from '../lib/heygen.js'
import type { HeyGenAvatar, PhotoAvatarDetails, GenerateLookRequest } from '../lib/heygen.js'

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
          const { data, error } = await supabase
            .from('avatars')
            .insert({
              user_id: userId,
              heygen_avatar_id: heygenAvatar.avatar_id,
              avatar_name: heygenAvatar.avatar_name,
              avatar_url: heygenAvatar.avatar_url || null,
              preview_url: heygenAvatar.preview_url || null,
              thumbnail_url: heygenAvatar.thumbnail_url || null,
              gender: heygenAvatar.gender || null,
              status: heygenAvatar.status || 'active',
              is_default: false,
            })
            .select()
            .single()

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
      const { data, error } = await supabase
        .from('avatars')
        .insert({
          user_id: userId,
          heygen_avatar_id: heygenAvatar.avatar_id,
          avatar_name: heygenAvatar.avatar_name,
          avatar_url: heygenAvatar.avatar_url || null,
          preview_url: heygenAvatar.preview_url || null,
          thumbnail_url: heygenAvatar.thumbnail_url || null,
          gender: heygenAvatar.gender || null,
          status: heygenAvatar.status || 'active',
          is_default: false,
        })
        .select()
        .single()

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
    if (avatar.avatar_url && avatar.avatar_url.includes('supabase.co/storage')) {
      return true
    }
    if (['training', 'pending', 'generating'].includes(avatar.status)) {
      return true
    }
    if (!avatar.avatar_url && avatar.status !== 'active') {
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

    return getPhotoAvatarDetails(avatar.heygen_avatar_id)
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
      const { data, error } = await supabase
        .from('avatars')
        .insert({
          user_id: userId,
          heygen_avatar_id: result.avatar_id,
          avatar_name: avatarName,
          avatar_url: photoUrl, // Save the photo URL to identify user-created avatars
          preview_url: photoUrl,
          thumbnail_url: photoUrl,
          gender: null,
          status: result.status === 'training' ? 'training' : 'active',
          is_default: false,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Create avatar from photo error:', error)
      throw new Error(`Failed to create avatar from photo: ${error.message}`)
    }
  }

  static async autoGenerateVerticalLook(
    groupId: string,
    photoUrl: string,
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

      const response = await generateAvatarLook({
        group_id: groupId,
        prompt,
        orientation: 'vertical', // Force 9:16 format
        pose: AUTO_LOOK_POSE,
        style: AUTO_LOOK_STYLE,
      })

      console.log('[Auto Look] ✅ AI look generation started (9:16 format)', {
        groupId,
        generationId: response.generation_id,
        orientation: 'vertical',
        pose: AUTO_LOOK_POSE,
        style: AUTO_LOOK_STYLE,
      })

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
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'training', 'pending', 'generating'])
      .order('is_default', { ascending: false })
      .order('avatar_name', { ascending: true })

    if (error) throw error
    
    // Filter to only include user-created avatars:
    // 1. Avatars with Supabase storage URLs (photo uploads)
    // 2. Avatars with status 'generating' (AI generation in progress)
    // 3. Avatars with status 'training' or 'pending' that don't have HeyGen CDN URLs
    const userCreated = (data || []).filter(avatar => {
      // If it has a Supabase storage URL, it's user-created
      if (avatar.avatar_url && avatar.avatar_url.includes('supabase.co/storage')) {
        return true
      }
      // If status is generating, it's user-created (AI generation)
      if (avatar.status === 'generating') {
        return true
      }
      // If status is training or pending and doesn't have a HeyGen CDN URL, it's likely user-created
      if ((avatar.status === 'training' || avatar.status === 'pending') && 
          (!avatar.avatar_url || !avatar.avatar_url.includes('heygen'))) {
        return true
      }
      // Exclude avatars with HeyGen CDN URLs (these are synced from HeyGen)
      if (avatar.avatar_url && avatar.avatar_url.includes('heygen')) {
        return false
      }
      // Include avatars with no URL if they're in training/pending (recently created)
      if (!avatar.avatar_url && (avatar.status === 'training' || avatar.status === 'pending')) {
        return true
      }
      return false
    })

    return userCreated
  }

  /**
   * Complete AI avatar generation by creating avatar group from generated images
   */
  static async completeAIAvatarGeneration(
    userId: string,
    generationId: string,
    imageKeys: string[],
    avatarName: string
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

      const groupId = createGroupResponse.data?.data?.id || 
                     createGroupResponse.data?.data?.group_id ||
                     createGroupResponse.data?.id ||
                     createGroupResponse.data?.group_id

      if (!groupId) {
        throw new Error('Failed to get group_id from avatar group creation response')
      }

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
      const { data: existingAvatar } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .eq('heygen_avatar_id', generationId)
        .single()

      if (existingAvatar) {
        // Update existing record
        const { data, error } = await supabase
          .from('avatars')
          .update({
            heygen_avatar_id: groupId,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAvatar.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('avatars')
          .insert({
            user_id: userId,
            heygen_avatar_id: groupId,
            avatar_name: avatarName,
            avatar_url: null,
            preview_url: null,
            thumbnail_url: null,
            gender: null,
            status: 'active',
            is_default: false,
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    } catch (error: any) {
      console.error('Complete AI avatar generation error:', error)
      throw new Error(`Failed to complete AI avatar generation: ${error.message}`)
    }
  }
}
