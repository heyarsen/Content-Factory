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
    // Get recent topics for deduplication (expanded to 20 for better variety)
    const recentTopics = await ContentService.getRecentTopics(userId, 20)
    
    // Get recent scripts to avoid similar angles
    const { data: recentScripts } = await supabase
      .from('video_plan_items')
      .select('script, topic')
      .eq('user_id', userId)
      .in('status', ['completed', 'approved'])
      .order('scheduled_date', { ascending: false })
      .limit(10)

    // Get prompt configuration from database
    const promptConfig = await this.getPromptConfig(userId, 'ideas')

    // Build comprehensive anti-repeat data
    const recentTopicsWithScripts = recentTopics.map(t => ({
      topic: t.topic,
      category: t.category,
    }))

    const recentScriptSummaries = recentScripts?.map((item: any) => ({
      topic: item.topic,
      scriptPreview: item.script ? item.script.slice(0, 150) : '',
    })) || []

    const response = await generateTopics({
      recentTopics: recentTopicsWithScripts,
      recentScripts: recentScriptSummaries,
      promptConfig: {
        ...promptConfig,
        // Add variety instructions to the existing prompt
        systemPrompt: `${promptConfig?.systemPrompt || ''}

IMPORTANT: Generate highly diverse and fresh content that avoids repetition:
- Use different angles than recent topics and scripts
- Explore new subtopics and perspectives
- Vary the format: how-to, listicles, personal stories, news commentary, myth-busting
- Change the tone: inspirational, educational, controversial, humorous, practical
- Target different aspects of the niche that haven't been covered recently
- Avoid similar hooks or opening lines to recent content
- If recent content was about "benefits", focus on "risks" or "how-to" next
- If recent was beginner-focused, target intermediate or advanced angles`.trim()
      }
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

