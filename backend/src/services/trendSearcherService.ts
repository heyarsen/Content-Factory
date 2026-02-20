import axios from 'axios'
import { retryWithBackoff } from '../lib/perplexity.js'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

export type TrendPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts'

export interface TrendItem {
  platform: TrendPlatform
  trend: string
  summary: string
  contentIdea: string
  observedAt: string
}

export interface TrendSearchResponse {
  generatedAt: string
  query: string
  trends: TrendItem[]
}

function getFallbackTrends(query: string): TrendSearchResponse {
  const now = new Date().toISOString()
  return {
    generatedAt: now,
    query,
    trends: [
      {
        platform: 'tiktok',
        trend: 'POV expert micro-storytelling',
        summary: 'Creators share short POV stories with one practical lesson and a hard hook in the first 2 seconds.',
        contentIdea: `Create a 20-second "POV: You are fixing ${query || 'a common mistake'}" format with text overlays and one clear CTA.`,
        observedAt: now,
      },
      {
        platform: 'instagram_reels',
        trend: 'Mini tutorials with captions-first editing',
        summary: 'Reels with bold on-screen captions, quick cuts, and 3-step frameworks are being widely reshared.',
        contentIdea: `Publish a 3-step Reel "How to improve ${query || 'results'} in 7 days" with save-focused ending.`,
        observedAt: now,
      },
      {
        platform: 'youtube_shorts',
        trend: 'Myth vs fact Shorts',
        summary: 'Short educational myth-busting videos with visual proof and quick examples continue to perform strongly.',
        contentIdea: `Record a "Myth vs Fact" short about ${query || 'your niche'} and end with a comment prompt.`,
        observedAt: now,
      },
    ],
  }
}

export async function searchShortFormTrends(query = '', limit = 9): Promise<TrendSearchResponse> {
  if (!PERPLEXITY_API_KEY) {
    return getFallbackTrends(query)
  }

  const safeLimit = Math.min(Math.max(limit, 3), 15)
  const normalizedQuery = query.trim()

  const systemPrompt = `You are TrendSearcher, a social media trends analyst.
Find current trends for TikTok, Instagram Reels, and YouTube Shorts.
Return only valid JSON in this format:
{
  "generatedAt": "ISO datetime",
  "query": "string",
  "trends": [
    {
      "platform": "tiktok | instagram_reels | youtube_shorts",
      "trend": "short trend title",
      "summary": "one sentence insight",
      "contentIdea": "one concrete content idea",
      "observedAt": "ISO datetime"
    }
  ]
}
Include recent and practical trends. Do not include extra text.`

  const userPrompt = `Find ${safeLimit} latest short-form video trends across TikTok, Instagram Reels, and YouTube Shorts${normalizedQuery ? ` for topic: ${normalizedQuery}` : ''}. Prioritize trends from the last 30 days.`

  try {
    const response = await retryWithBackoff(async () => {
      return axios.post(
        PERPLEXITY_API_URL,
        {
          model: 'sonar-pro',
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          web_search_options: {
            search_context_size: 'high',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
    })

    const content = response.data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('No JSON object found in trend response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as TrendSearchResponse

    if (!Array.isArray(parsed.trends) || parsed.trends.length === 0) {
      throw new Error('Trend response did not contain any trends')
    }

    return {
      generatedAt: parsed.generatedAt || new Date().toISOString(),
      query: parsed.query || normalizedQuery,
      trends: parsed.trends.slice(0, safeLimit),
    }
  } catch (error) {
    console.error('Trend search failed, using fallback trends:', error)
    return getFallbackTrends(normalizedQuery)
  }
}
