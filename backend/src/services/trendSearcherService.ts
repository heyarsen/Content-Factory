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
    description?: string
  }
  statistics?: {
    viewCount?: string
  }
}

interface RankedVideo {
  video: YouTubeVideoItem
  relevanceScore: number
  viewCountValue: number
}

interface SearchRegion {
  code: 'US' | 'CA' | 'GB' | 'AU'
  label: string
}

const QUERY_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'with',
])

const SEARCH_REGIONS: SearchRegion[] = [
  { code: 'US', label: 'USA' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'UK' },
  { code: 'AU', label: 'Australia' },
]

const QUERY_NORMALIZATIONS: Record<string, string[]> = {
  smm: ['social media marketing'],
  seo: ['search engine optimization'],
  ugc: ['user generated content'],
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

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token))
}

function expandQueryTerms(query: string): string[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  const words = trimmedQuery
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

  const normalizedPhrases = words.flatMap((word) => QUERY_NORMALIZATIONS[word] || [])
  return [trimmedQuery, ...normalizedPhrases]
}

function scoreVideoRelevance(video: YouTubeVideoItem, queryTokens: string[]): number {
  if (!queryTokens.length) return 0

  const title = (video.snippet?.title || '').toLowerCase()
  const description = (video.snippet?.description || '').toLowerCase()
  const tags = (video.snippet?.tags || []).map((tag) => tag.toLowerCase())

  return queryTokens.reduce((score, token) => {
    let tokenScore = 0
    if (title.includes(token)) tokenScore += 3
    if (description.includes(token)) tokenScore += 1
    if (tags.some((tag) => tag.includes(token))) tokenScore += 2
    return score + tokenScore
  }, 0)
}

function buildSearchTerms(query: string): string {
  const expandedTerms = expandQueryTerms(query)
  return [...expandedTerms, 'shorts'].filter(Boolean).join(' ').trim() || 'viral shorts'
}

function buildEnhancedTokens(query: string): string[] {
  const expandedTerms = expandQueryTerms(query)
  return Array.from(new Set(expandedTerms.flatMap((term) => tokenizeQuery(term))))
}

async function searchYouTubeShortTrends(query: string, limit: number): Promise<TrendItem[]> {
  if (!YOUTUBE_DATA_API_KEY) {
    throw new Error('YOUTUBE_DATA_API_KEY is missing. YouTube trend search cannot run.')
  }

  const normalizedQuery = query.trim()
  const queryTokens = buildEnhancedTokens(normalizedQuery)
  const searchTerms = buildSearchTerms(normalizedQuery)
  const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const regionalResponses = await Promise.all(
    SEARCH_REGIONS.map(async (region) => {
      const searchResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
        params: {
          key: YOUTUBE_DATA_API_KEY,
          part: 'id',
          q: searchTerms,
          type: 'video',
          maxResults: Math.min(Math.max(limit * 2, 8), 15),
          order: normalizedQuery ? 'relevance' : 'viewCount',
          videoDuration: 'short',
          publishedAfter,
          regionCode: region.code,
          relevanceLanguage: 'en',
        },
      })

      const searchItems: YouTubeSearchItem[] = searchResponse.data?.items || []
      return searchItems.map((item) => ({ videoId: item.id?.videoId, region: region.label }))
    }),
  )

  const regionByVideoId = new Map<string, string>()
  for (const item of regionalResponses.flat()) {
    if (item.videoId && !regionByVideoId.has(item.videoId)) {
      regionByVideoId.set(item.videoId, item.region)
    }
  }

  const videoIds = Array.from(regionByVideoId.keys())

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

  const rankedVideos: RankedVideo[] = videos.map((video) => {
    const viewCountValue = Number(video.statistics?.viewCount || 0)
    return {
      video,
      relevanceScore: scoreVideoRelevance(video, queryTokens),
      viewCountValue,
    }
  })

  const filteredAndSortedVideos = rankedVideos
    .filter(({ relevanceScore }) => !queryTokens.length || relevanceScore > 0)
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore
      }
      return right.viewCountValue - left.viewCountValue
    })

  const selectedVideos = (filteredAndSortedVideos.length ? filteredAndSortedVideos : rankedVideos)
    .slice(0, limit)

  return selectedVideos
    .map(({ video, viewCountValue }) => {
      const title = video.snippet?.title || 'Popular YouTube Short format'
      const firstTag = video.snippet?.tags?.[0]?.replace('#', '')
      const regionLabel = video.id ? regionByVideoId.get(video.id) : undefined

      return {
        platform: 'youtube_shorts' as const,
        trend: firstTag || title.split('|')[0].slice(0, 70).trim() || 'YouTube Shorts trend',
        videoTitle: title,
        creator: video.snippet?.channelTitle || 'YouTube Creator',
        videoUrl: video.id ? `https://www.youtube.com/shorts/${video.id}` : 'https://www.youtube.com/shorts',
        summary: `High-performing YouTube Short discovered from YouTube Data API search${normalizedQuery ? ` for “${normalizedQuery}”` : ''}${regionLabel ? ` in ${regionLabel}` : ''}.`,
        contentIdea: `Create a short inspired by "${title}" and adapt it to your angle on ${normalizedQuery || 'your niche'}.`,
        viewCount: formatViewCount(viewCountValue),
        publishedAt: video.snippet?.publishedAt || nowIso,
        observedAt: nowIso,
      }
    })
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
