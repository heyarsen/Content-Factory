import axios from 'axios'
import { retryWithBackoff } from '../lib/perplexity.js'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

export type TrendPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts'

const SUPPORTED_PLATFORMS: TrendPlatform[] = ['tiktok', 'instagram_reels', 'youtube_shorts']

export interface TrendItem {
  platform: TrendPlatform
  trend: string
  videoTitle: string
  creator: string
  videoUrl: string
  summary: string
  contentIdea: string
  viewCount: string
  publishedAt: string
  observedAt: string
}

export interface TrendSearchResponse {
  generatedAt: string
  query: string
  trends: TrendItem[]
}

function getFallbackTrends(query: string, platforms: TrendPlatform[]): TrendSearchResponse {
  const now = new Date().toISOString()
  const fallbackByPlatform: Record<TrendPlatform, TrendItem> = {
    tiktok: {
      platform: 'tiktok',
      trend: 'POV expert micro-storytelling',
      videoTitle: 'POV: fixing a common beginner mistake in 20 seconds',
      creator: '@creatorcoach',
      videoUrl: 'https://www.tiktok.com',
      summary: 'Creators share short POV stories with one practical lesson and a hard hook in the first 2 seconds.',
      contentIdea: `Create a 20-second "POV: You are fixing ${query || 'a common mistake'}" format with text overlays and one clear CTA.`,
      viewCount: '1.2M',
      publishedAt: now,
      observedAt: now,
    },
    instagram_reels: {
      platform: 'instagram_reels',
      trend: 'Mini tutorials with captions-first editing',
      videoTitle: '3-step reel framework for faster results',
      creator: '@growthdigest',
      videoUrl: 'https://www.instagram.com/reels/',
      summary: 'Reels with bold on-screen captions, quick cuts, and 3-step frameworks are being widely reshared.',
      contentIdea: `Publish a 3-step Reel "How to improve ${query || 'results'} in 7 days" with save-focused ending.`,
      viewCount: '860K',
      publishedAt: now,
      observedAt: now,
    },
    youtube_shorts: {
      platform: 'youtube_shorts',
      trend: 'Myth vs fact Shorts',
      videoTitle: 'Myth vs Fact: what actually works in this niche',
      creator: '@marketbreakdown',
      videoUrl: 'https://www.youtube.com/shorts',
      summary: 'Short educational myth-busting videos with visual proof and quick examples continue to perform strongly.',
      contentIdea: `Record a "Myth vs Fact" short about ${query || 'your niche'} and end with a comment prompt.`,
      viewCount: '530K',
      publishedAt: now,
      observedAt: now,
    },
  }

  return {
    generatedAt: now,
    query,
    trends: platforms.map((platform) => fallbackByPlatform[platform]),
  }
}

export async function searchShortFormTrends(query = '', limit = 9, platforms: string[] = SUPPORTED_PLATFORMS): Promise<TrendSearchResponse> {
  const selectedPlatforms = platforms.filter((platform): platform is TrendPlatform => SUPPORTED_PLATFORMS.includes(platform as TrendPlatform))
  const safePlatforms = selectedPlatforms.length ? selectedPlatforms : SUPPORTED_PLATFORMS

  if (!PERPLEXITY_API_KEY) {
    return getFallbackTrends(query, safePlatforms)
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
      "videoTitle": "title of a currently popular video example",
      "creator": "channel or creator handle",
      "videoUrl": "public URL to the video or platform page",
      "summary": "one sentence insight",
      "contentIdea": "one concrete content idea",
      "viewCount": "human readable view count like 1.2M",
      "publishedAt": "ISO datetime within last 30 days",
      "observedAt": "ISO datetime"
    }
  ]
}
Only include items from the last 30 days. Focus on popular videos and practical takeaways. Do not include extra text.`

  const userPrompt = `Find ${safeLimit} latest short-form video trends on ${safePlatforms.join(', ')}${normalizedQuery ? ` for topic: ${normalizedQuery}` : ''}. Prioritize popular videos published in the last 30 days and include creator + video URL.`

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
      trends: parsed.trends
        .filter((item) => safePlatforms.includes(item.platform))
        .slice(0, safeLimit),
    }
  } catch (error) {
    console.error('Trend search failed, using fallback trends:', error)
    return getFallbackTrends(normalizedQuery, safePlatforms)
  }
}
