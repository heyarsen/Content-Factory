import axios from 'axios'

const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3'

export type TrendPlatform = 'youtube_shorts'


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

function summarizeTrendSearchError(error: unknown): Record<string, unknown> {
  if (!axios.isAxiosError(error)) {
    return {
      message: error instanceof Error ? error.message : String(error),
    }
  }

  return {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    statusText: error.response?.statusText,
    url: error.config?.url,
    method: error.config?.method,
  }
}

async function searchYouTubeShortTrends(query: string, limit: number): Promise<TrendItem[]> {
  if (!YOUTUBE_DATA_API_KEY) {
    throw new Error('YOUTUBE_DATA_API_KEY is missing. YouTube trend search cannot run.')
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

export async function searchShortFormTrends(query = '', limit = 9): Promise<TrendSearchResponse> {
  const safeLimit = Math.min(Math.max(limit, 3), 15)
  const normalizedQuery = query.trim()

  try {
    const trends = await searchYouTubeShortTrends(normalizedQuery, safeLimit)

    return {
      generatedAt: new Date().toISOString(),
      query: normalizedQuery,
      trends,
    }
  } catch (error) {
    console.error('Trend search failed:', summarizeTrendSearchError(error))
    throw error
  }
}
