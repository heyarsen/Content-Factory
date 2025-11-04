import { generateVideo } from '../lib/heygen.js'
import { Reel } from '../types/database.js'

// Category to HeyGen template mapping
const CATEGORY_TEMPLATES: Record<string, string> = {
  Trading: 'Daran walking', // Default for Trading - can be configured
  Lifestyle: 'Car',
  'Fin. Freedom': 'Daran sitting', // Default for Fin. Freedom - can be configured
}

export class VideoService {
  /**
   * Generate video for a reel based on category
   */
  static async generateVideoForReel(reel: Reel): Promise<{ video_id: string; video_url: string | null }> {
    if (!reel.script) {
      throw new Error('Reel must have a script to generate video')
    }

    const template = reel.template || CATEGORY_TEMPLATES[reel.category] || 'Daran walking'

    // Map template names to actual HeyGen template IDs if needed
    // For now, we'll use the template name as-is
    const templateId = template

    try {
      const response = await generateVideo({
        topic: reel.topic,
        script: reel.script,
        style: 'professional', // Default style
        duration: 30, // Default 30 seconds for reels
      })

      return {
        video_id: response.video_id,
        video_url: response.video_url || null,
      }
    } catch (error: any) {
      console.error('Error generating video for reel:', error)
      throw new Error(`Failed to generate video: ${error.message}`)
    }
  }

  /**
   * Get template for category
   */
  static getTemplateForCategory(category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'): string {
    return CATEGORY_TEMPLATES[category] || CATEGORY_TEMPLATES.Trading
  }
}

