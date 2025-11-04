import { generateTopics, researchTopic } from '../lib/perplexity.js'
import { ContentService } from './contentService.js'
import type { Topic } from '../lib/perplexity.js'
import type { ResearchResponse } from '../lib/perplexity.js'

export class ResearchService {
  /**
   * Generate 3 topics using Perplexity (Scout-Research Hunter)
   */
  static async generateTopics(userId?: string): Promise<Topic[]> {
    // Get recent topics for deduplication
    const recentTopics = await ContentService.getRecentTopics(userId, 10)

    const response = await generateTopics({
      recentTopics: recentTopics.map(t => ({
        topic: t.topic,
        category: t.category,
      })),
    })

    return response.topics
  }

  /**
   * Research a specific topic using Perplexity
   */
  static async researchTopic(
    topic: string,
    category: string
  ): Promise<ResearchResponse> {
    return await researchTopic({ topic, category })
  }
}

