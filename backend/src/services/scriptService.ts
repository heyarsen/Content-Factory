import { generateScript, ScriptGenerationRequest } from '../lib/openai.js'
import { ContentItem } from '../types/database.js'

export class ScriptService {
  /**
   * Generate script based on category and research data
   */
  static async generateScriptFromContent(contentItem: ContentItem): Promise<string> {
    if (!contentItem.research) {
      throw new Error('Content item must have research data to generate script')
    }

    const research = contentItem.research

    const request: ScriptGenerationRequest = {
      idea: research.Idea || contentItem.topic,
      description: research.Description || '',
      whyItMatters: research.WhyItMatters || '',
      usefulTips: research.UsefulTips || '',
      category: contentItem.category,
    }

    const response = await generateScript(request)
    return response.script
  }

  /**
   * Generate script with custom data
   */
  static async generateScriptCustom(
    data: ScriptGenerationRequest
  ): Promise<string> {
    const response = await generateScript(data)
    return response.script
  }
}

