import { generateScript, ScriptGenerationRequest } from '../lib/openai.js'
import { ContentItem } from '../types/database.js'
import { supabase } from '../lib/supabase.js'

export class ScriptService {
  /**
   * Get persona from prompt template for a user
   */
  private static async getPersona(userId: string): Promise<string | undefined> {
    try {
      const { data: promptRow } = await supabase
        .from('prompt_templates')
        .select('persona')
        .eq('user_id', userId)
        .eq('template_type', 'script')
        .eq('status', 'active')
        .maybeSingle()

      return promptRow?.persona || undefined
    } catch (error) {
      console.error('Failed to fetch persona:', error)
      return undefined
    }
  }

  /**
   * Generate script based on category and research data
   */
  static async generateScriptFromContent(
    contentItem: ContentItem,
    userId?: string
  ): Promise<string> {
    if (!contentItem.research) {
      throw new Error('Content item must have research data to generate script')
    }

    const research = contentItem.research

    // Get persona if userId is provided
    const persona = userId ? await this.getPersona(userId) : undefined

    const request: ScriptGenerationRequest = {
      idea: research.Idea || contentItem.topic,
      description: research.Description || '',
      whyItMatters: research.WhyItMatters || '',
      usefulTips: research.UsefulTips || '',
      persona,
    }

    const response = await generateScript(request)
    return response.script
  }

  /**
   * Generate script with custom data
   */
  static async generateScriptCustom(
    data: ScriptGenerationRequest,
    userId?: string
  ): Promise<string> {
    // Get persona if userId is provided
    if (userId && !data.persona) {
      data.persona = await this.getPersona(userId)
    }

    const response = await generateScript(data)
    return response.script
  }
}

