import axios from 'axios'
import { retryWithBackoff } from '../lib/perplexity.js'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3'

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

interface YouTubeSearchItem {
  id?: { videoId?: string }
}

interface YouTubeVideoItem {
  id?: string
  snippet?: {
    title?: string
    channelTitle?: string
    publishedAt?: string
    tags?: string[]
  }
  statistics?: {
    viewCount?: string
  }
}

function formatViewCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Popular'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return value.toString()
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

async function searchYouTubeShortTrends(query: string, limit: number): Promise<TrendItem[]> {
  if (!YOUTUBE_DATA_API_KEY) {
    return []
  }

  const searchTerms = [query.trim(), 'shorts'].filter(Boolean).join(' ').trim() || 'viral shorts'
  const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const searchResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
    params: {
      key: YOUTUBE_DATA_API_KEY,
      part: 'id',
      q: searchTerms,
      type: 'video',
      maxResults: Math.min(Math.max(limit, 3), 25),
      order: 'viewCount',
      videoDuration: 'short',
      publishedAfter,
      regionCode: 'US',
      relevanceLanguage: 'en',
    },
  })

  const searchItems: YouTubeSearchItem[] = searchResponse.data?.items || []
  const videoIds = searchItems
    .map((item) => item.id?.videoId)
    .filter((videoId): videoId is string => Boolean(videoId))

  if (!videoIds.length) {
    return []
  }

  const videoResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
    params: {
      key: YOUTUBE_DATA_API_KEY,
      part: 'snippet,statistics',
      id: videoIds.join(','),
      maxResults: videoIds.length,
    },
  })

  const nowIso = new Date().toISOString()
  const videos: YouTubeVideoItem[] = videoResponse.data?.items || []

  return videos
    .map((video) => {
      const viewCountValue = Number(video.statistics?.viewCount || 0)
      const title = video.snippet?.title || 'Popular YouTube Short format'
      const firstTag = video.snippet?.tags?.[0]?.replace('#', '')

      return {
        platform: 'youtube_shorts' as const,
        trend: firstTag || title.split('|')[0].slice(0, 70).trim() || 'YouTube Shorts trend',
        videoTitle: title,
        creator: video.snippet?.channelTitle || 'YouTube Creator',
        videoUrl: video.id ? `https://www.youtube.com/shorts/${video.id}` : 'https://www.youtube.com/shorts',
        summary: `High-performing YouTube Short discovered from YouTube Data API search${query ? ` for “${query}”` : ''}.`,
        contentIdea: `Create a short inspired by "${title}" and adapt it to your angle on ${query || 'your niche'}.`,
        viewCount: formatViewCount(viewCountValue),
        publishedAt: video.snippet?.publishedAt || nowIso,
        observedAt: nowIso,
      }
    })
    .slice(0, limit)
}

async function searchPerplexityTrends(query: string, limit: number, platforms: TrendPlatform[]): Promise<TrendItem[]> {
  if (!PERPLEXITY_API_KEY || platforms.length === 0) {
    return []
  }

  const systemPrompt = `You are TrendSearcher, a social media trends analyst.
Find current trends for TikTok and Instagram Reels.
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

  const userPrompt = `Find ${limit} latest short-form video trends on ${platforms.join(', ')}${query ? ` for topic: ${query}` : ''}. Prioritize popular videos published in the last 30 days and include creator + video URL.`

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
    return []
  }

  const parsed = JSON.parse(jsonMatch[0]) as TrendSearchResponse
  if (!Array.isArray(parsed.trends)) {
    return []
  }

  return parsed.trends.filter((item) => platforms.includes(item.platform)).slice(0, limit)
}

export async function searchShortFormTrends(query = '', limit = 9, platforms: string[] = SUPPORTED_PLATFORMS): Promise<TrendSearchResponse> {
  const selectedPlatforms = platforms.filter((platform): platform is TrendPlatform => SUPPORTED_PLATFORMS.includes(platform as TrendPlatform))
  const safePlatforms = selectedPlatforms.length ? selectedPlatforms : SUPPORTED_PLATFORMS
  const safeLimit = Math.min(Math.max(limit, 3), 15)
  const normalizedQuery = query.trim()

  const platformLimit = Math.max(1, Math.ceil(safeLimit / safePlatforms.length))
  const trends: TrendItem[] = []

  try {
    if (safePlatforms.includes('youtube_shorts')) {
      const youtubeTrends = await searchYouTubeShortTrends(normalizedQuery, platformLimit)
      trends.push(...youtubeTrends)
    }

    const needsPerplexity = safePlatforms.filter((platform) => platform !== 'youtube_shorts')
    if (needsPerplexity.length > 0) {
      const perplexityTrends = await searchPerplexityTrends(normalizedQuery, platformLimit * needsPerplexity.length, needsPerplexity)
      trends.push(...perplexityTrends)
    }

    const missingPlatforms = safePlatforms.filter((platform) => !trends.some((trend) => trend.platform === platform))
    if (missingPlatforms.length) {
      trends.push(...getFallbackTrends(normalizedQuery, missingPlatforms).trends)
    }

    return {
      generatedAt: new Date().toISOString(),
      query: normalizedQuery,
      trends: trends.slice(0, safeLimit),
    }
  } catch (error) {
    console.error('Trend search failed, using fallback trends:', error)
    return getFallbackTrends(normalizedQuery, safePlatforms)
  }
}
