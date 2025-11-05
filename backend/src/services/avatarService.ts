import { supabase } from '../lib/supabase.js'
import { listAvatars as listHeyGenAvatars, getAvatar as getHeyGenAvatar } from '../lib/heygen.js'
import type { HeyGenAvatar } from '../lib/heygen.js'

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
  static async deleteAvatar(avatarId: string, userId: string): Promise<void> {
    const avatar = await this.getAvatarById(avatarId, userId)
    if (!avatar) {
      throw new Error('Avatar not found')
    }

    // Don't allow deleting default avatar without setting a new one
    if (avatar.is_default) {
      throw new Error('Cannot delete default avatar. Please set another avatar as default first.')
    }

    const { error } = await supabase
      .from('avatars')
      .update({ status: 'inactive' })
      .eq('id', avatarId)
      .eq('user_id', userId)

    if (error) throw error
  }

  /**
   * Create avatar from photo using HeyGen v2 API
   */
  static async createAvatarFromPhoto(
    userId: string,
    photoUrl: string,
    avatarName: string
  ): Promise<Avatar> {
    try {
      const { createAvatarFromPhoto } = await import('../lib/heygen.js')
      const result = await createAvatarFromPhoto(photoUrl, avatarName)

      // Save to database
      const { data, error } = await supabase
        .from('avatars')
        .insert({
          user_id: userId,
          heygen_avatar_id: result.avatar_id,
          avatar_name: avatarName,
          avatar_url: null,
          preview_url: null,
          thumbnail_url: null,
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
}
