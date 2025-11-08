import { supabase } from '../lib/supabase.js'
import { ContentItem } from '../types/database.js'

export class ContentService {
  /**
   * Get pending content items (done = false)
   */
  static async getPendingContent(userId?: string, limit = 1): Promise<ContentItem[]> {
    let query = supabase
      .from('content_items')
      .select('*')
      .eq('done', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching pending content:', error)
      throw new Error(`Failed to fetch pending content: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get recent topics for deduplication
   */
  static async getRecentTopics(userId?: string, limit = 10): Promise<Array<{ topic: string; category: string }>> {
    let query = supabase
      .from('content_items')
      .select('topic, category')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching recent topics:', error)
      throw new Error(`Failed to fetch recent topics: ${error.message}`)
    }

    return (data || []).map(item => ({
      topic: item.topic,
      category: item.category,
    }))
  }

  /**
   * Mark content item as done
   */
  static async markContentDone(contentItemId: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .update({ done: true })
      .eq('id', contentItemId)

    if (error) {
      console.error('Error marking content as done:', error)
      throw new Error(`Failed to mark content as done: ${error.message}`)
    }
  }

  /**
   * Create content item
   */
  static async createContentItem(
    userId: string,
    data: {
      topic: string
      category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'
      research?: Record<string, any>
      status?: string
      keywords?: string[]
    }
  ): Promise<ContentItem> {
    const { data: contentItem, error } = await supabase
      .from('content_items')
      .insert({
        user_id: userId,
        topic: data.topic,
        category: data.category,
        research: data.research || null,
        done: false,
        status: data.status || null,
        keywords: data.keywords || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating content item:', error)
      throw new Error(`Failed to create content item: ${error.message}`)
    }

    return contentItem
  }

  /**
   * Update content item research
   */
  static async updateContentResearch(
    contentItemId: string,
    research: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .update({ research })
      .eq('id', contentItemId)

    if (error) {
      console.error('Error updating content research:', error)
      throw new Error(`Failed to update content research: ${error.message}`)
    }
  }

  /**
   * Get content items without research
   */
  static async getContentWithoutResearch(userId?: string, limit = 3): Promise<ContentItem[]> {
    const { retrySupabaseOperation } = await import('../lib/supabaseRetry.js')
    
    return retrySupabaseOperation(async () => {
      let query = supabase
      .from('content_items')
      .select('*')
      .is('research', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching content without research:', error)
        throw new Error(`Failed to fetch content without research: ${error.message}`)
      }

      return data || []
    }, 3, 1000, 'getContentWithoutResearch')
  }

  /**
   * Get content item by ID
   */
  static async getContentItemById(contentItemId: string): Promise<ContentItem | null> {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', contentItemId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching content item:', error)
      throw new Error(`Failed to fetch content item: ${error.message}`)
    }

    return data
  }

  /**
   * Get all content items for a user
   */
  static async getAllContentItems(userId: string): Promise<ContentItem[]> {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching all content items:', error)
      throw new Error(`Failed to fetch content items: ${error.message}`)
    }

    return data || []
  }
}

