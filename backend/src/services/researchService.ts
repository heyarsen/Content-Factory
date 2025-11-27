import { generateTopics, researchTopic, type PromptConfig } from '../lib/perplexity.js'
import { ContentService } from './contentService.js'
import { supabase } from '../lib/supabase.js'
import type { Topic } from '../lib/perplexity.js'
import type { ResearchResponse } from '../lib/perplexity.js'

export class ResearchService {
  /**
   * Get prompt configuration from database for a user
   */
  private static async getPromptConfig(
    userId: string | undefined,
    templateType: 'ideas' | 'research'
  ): Promise<PromptConfig | undefined> {
    if (!userId) return undefined

    try {
      const { data: promptRow } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('template_type', templateType)
        .eq('status', 'active')
        .maybeSingle()

      if (!promptRow) return undefined

      const config = promptRow.config || {}
      
      if (templateType === 'ideas') {
        return {
          persona: promptRow.persona || undefined,
          business_model: config.business_model || undefined,
          focus: config.focus || undefined,
          categories: config.categories || undefined,
        }
      } else {
        return {
          persona: promptRow.persona || undefined,
          core_message: config.core_message || undefined,
          rules: config.rules || undefined,
          categories: config.categories || undefined,
        }
      }
    } catch (error) {
      console.error('Failed to fetch prompt config:', error)
      return undefined
    }
  }

  /**
   * Generate topics using Perplexity (Scout-Research Hunter)
   */
  static async generateTopics(userId?: string): Promise<Topic[]> {
    // Get recent topics for deduplication
    const recentTopics = await ContentService.getRecentTopics(userId, 10)

    // Get prompt configuration from database
    const promptConfig = await this.getPromptConfig(userId, 'ideas')

    const response = await generateTopics({
      recentTopics: recentTopics.map(t => ({
        topic: t.topic,
        category: t.category,
      })),
      promptConfig,
    })

    return response.topics
  }

  /**
   * Research a specific topic using Perplexity
   */
  static async researchTopic(
    topic: string,
    category: string,
    userId?: string
  ): Promise<ResearchResponse> {
    // Get prompt configuration from database
    const promptConfig = await this.getPromptConfig(userId, 'research')

    return await researchTopic({ topic, category, promptConfig })
  }
}

