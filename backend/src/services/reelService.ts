import { supabase } from '../lib/supabase.js'
import { Reel } from '../types/database.js'

export class ReelService {
  /**
   * Create a new reel
   */
  static async createReel(
    userId: string,
    data: {
      content_item_id?: string
      topic: string
      category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'
      description?: string
      why_it_matters?: string
      useful_tips?: string
      script: string
      scheduled_time?: string
    }
  ): Promise<Reel> {
    const scheduledTime = data.scheduled_time || new Date(Date.now() + 20 * 60 * 1000).toISOString() // 20 minutes from now

    const { data: reel, error } = await supabase
      .from('reels')
      .insert({
        user_id: userId,
        content_item_id: data.content_item_id || null,
        topic: data.topic,
        category: data.category,
        description: data.description || null,
        why_it_matters: data.why_it_matters || null,
        useful_tips: data.useful_tips || null,
        script: data.script,
        status: 'pending',
        scheduled_time: scheduledTime,
        instagram: false,
        youtube: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating reel:', error)
      throw new Error(`Failed to create reel: ${error.message}`)
    }

    return reel
  }

  /**
   * Get pending reels
   */
  static async getPendingReels(userId?: string): Promise<Reel[]> {
    let query = supabase
      .from('reels')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching pending reels:', error)
      throw new Error(`Failed to fetch pending reels: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get reels ready for auto-approval (scheduled_time <= now)
   */
  static async getReelsReadyForAutoApproval(): Promise<Reel[]> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true })

    if (error) {
      console.error('Error fetching reels ready for auto-approval:', error)
      throw new Error(`Failed to fetch reels ready for auto-approval: ${error.message}`)
    }

    return data || []
  }

  /**
   * Approve a reel
   */
  static async approveReel(reelId: string, clearScheduledTime = true): Promise<Reel> {
    const updateData: any = { status: 'approved' }
    if (clearScheduledTime) {
      updateData.scheduled_time = null
    }

    const { data, error } = await supabase
      .from('reels')
      .update(updateData)
      .eq('id', reelId)
      .select()
      .single()

    if (error) {
      console.error('Error approving reel:', error)
      throw new Error(`Failed to approve reel: ${error.message}`)
    }

    return data
  }

  /**
   * Reject a reel
   */
  static async rejectReel(reelId: string): Promise<Reel> {
    const { data, error } = await supabase
      .from('reels')
      .update({ status: 'rejected', scheduled_time: null })
      .eq('id', reelId)
      .select()
      .single()

    if (error) {
      console.error('Error rejecting reel:', error)
      throw new Error(`Failed to reject reel: ${error.message}`)
    }

    return data
  }

  /**
   * Get approved reels without video
   */
  static async getApprovedReelsWithoutVideo(userId?: string): Promise<Reel[]> {
    let query = supabase
      .from('reels')
      .select('*')
      .eq('status', 'approved')
      .is('video_url', null)
      .order('created_at', { ascending: true })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching approved reels without video:', error)
      throw new Error(`Failed to fetch approved reels: ${error.message}`)
    }

    return data || []
  }

  /**
   * Update reel with video information
   */
  static async updateReelVideo(
    reelId: string,
    videoData: {
      video_url?: string | null
      heygen_video_id?: string | null
      template?: string | null
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('reels')
      .update(videoData)
      .eq('id', reelId)

    if (error) {
      console.error('Error updating reel video:', error)
      throw new Error(`Failed to update reel video: ${error.message}`)
    }
  }

  /**
   * Get reel by ID
   */
  static async getReelById(reelId: string): Promise<Reel | null> {
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .eq('id', reelId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching reel:', error)
      throw new Error(`Failed to fetch reel: ${error.message}`)
    }

    return data
  }
}

