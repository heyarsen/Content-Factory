import axios from 'axios'

const UPLOADPOST_API_URL = 'https://api.upload-post.com/api'
const UPLOADPOST_ENDPOINTS = {
  createUserProfile: '/uploadposts/users',
  generateUserAccessLink: '/uploadposts/users/generate-jwt',
  userProfile: '/uploadposts/users',
  upload: '/upload',
  uploadStatus: '/uploadposts/status',
  dmsConversations: '/uploadposts/dms/conversations',
  dmsSend: '/uploadposts/dms/send',
  instagramComments: '/uploadposts/instagram/comments',
  analytics: '/uploadposts/analytics',
  instagramAnalytics: '/uploadposts/instagram/analytics',
  profileAnalytics: '/analytics',
} as const
const MAX_UPLOADPOST_TITLE_LENGTH = 100
const DEFAULT_UPLOADPOST_RETRY_DELAY_MS = 2000
const MAX_UPLOADPOST_RETRIES = 3

export function buildUploadPostTitle(caption?: string): string {
  const fallbackTitle = 'Video Post'
  const rawTitle = caption?.trim() || fallbackTitle

  if (rawTitle.length <= MAX_UPLOADPOST_TITLE_LENGTH) {
    return rawTitle
  }

  return rawTitle.slice(0, MAX_UPLOADPOST_TITLE_LENGTH).trimEnd()
}

export function buildUploadPostDescription(caption?: string): string {
  return buildUploadPostTitle(caption)
}

function getUploadPostKey(): string {
  const key = process.env.UPLOADPOST_KEY
  if (!key) {
    throw new Error('Missing UPLOADPOST_KEY environment variable')
  }
  return key
}

function getAuthHeader(): string {
  return `Apikey ${getUploadPostKey()}`
}


function normalizeUploadPostError(error: any, fallbackMessage: string, endpoint?: string): Error {
  const status = error.response?.status
  const apiMessage = error.response?.data?.message || error.response?.data?.error

  if (status === 401) {
    return new Error('Upload-Post API authentication failed. Please check your UPLOADPOST_KEY environment variable.')
  }
  if (status === 403) {
    return new Error(apiMessage || 'Upload-Post API access forbidden. Please check your plan limits.')
  }
  if (status === 404) {
    const endpointText = endpoint ? `: ${endpoint}` : ''
    return new Error(`Upload-Post API endpoint not found (404)${endpointText}.`)
  }
  if (status === 429) {
    return new Error(apiMessage || 'Upload-Post API rate limit exceeded. Please try again later.')
  }
  if (typeof status === 'number' && status >= 500) {
    return new Error('Upload-Post API server error. Please try again later.')
  }

  return new Error(apiMessage || error.message || fallbackMessage)
}

function normalizePaginatedResponse<T>(responseData: any, itemKeyCandidates: string[]): UploadPostListResponse<T> {
  const items = itemKeyCandidates.reduce<any[]>((acc, key) => {
    if (acc.length > 0) return acc
    const value = responseData?.[key]
    return Array.isArray(value) ? value : acc
  }, [])

  return {
    status: responseData?.status || 'success',
    data: items,
    page: responseData?.page,
    perPage: responseData?.per_page ?? responseData?.perPage,
    total: responseData?.total,
    hasMore: responseData?.has_more ?? responseData?.hasMore,
    cursor: responseData?.cursor,
    raw: responseData,
  }
}

export function getUploadPostProfileLookup(profile?: UserProfile | null): UploadPostProfileLookup {
  if (!profile) {
    return {}
  }

  const userId =
    profile.userId ||
    profile.user_id ||
    profile.uploadpost_user_id ||
    profile.id ||
    profile.user?.id ||
    profile.data?.id

  const profileId =
    profile.profileId ||
    profile.profile_id ||
    profile.instagram_profile_id ||
    profile.data?.profile_id

  const accountId =
    profile.accountId ||
    profile.account_id ||
    profile.instagram_account_id ||
    profile.data?.account_id

  return {
    username: profile.username,
    userId,
    profileId,
    accountId,
  }
}

export function buildUploadPostLookupFromProfile(profile?: UserProfile | null): UploadPostRequestContext {
  const lookup = getUploadPostProfileLookup(profile)
  return {
    username: lookup.username,
    userId: lookup.userId,
    profileId: lookup.profileId,
    accountId: lookup.accountId,
  }
}

function buildLookupQueryParams(filters: UploadPostRequestContext): Record<string, string> {
  const params: Record<string, string> = {}

  if (filters.username) {
    params.user = filters.username
  }

  if (filters.userId) {
    params.user_id = filters.userId
  }
  if (filters.profileId) {
    params.profile_id = filters.profileId
  }
  if (filters.accountId) {
    params.account_id = filters.accountId
  }

  return params
}

export interface CreateUserProfileRequest {
  username: string
  email?: string
  name?: string
}

export interface UserProfile {
  username?: string
  id?: string
  user_id?: string
  userId?: string
  uploadpost_user_id?: string
  profile_id?: string
  profileId?: string
  instagram_profile_id?: string
  instagram_account_id?: string
  account_id?: string
  accountId?: string
  email?: string
  name?: string
  jwt?: string
  user?: {
    id?: string
    [key: string]: any
  }
  data?: {
    id?: string
    [key: string]: any
  }
  [key: string]: any // Allow any additional properties
}

export interface UploadPostProfileLookup {
  username?: string
  userId?: string
  profileId?: string
  accountId?: string
}

export interface UploadPostDateRangeFilter {
  startDate?: string
  endDate?: string
}

export interface UploadPostPaginationFilter {
  page?: number
  perPage?: number
  limit?: number
  cursor?: string
}

export interface UploadPostRequestContext {
  username?: string
  userId?: string
  profileId?: string
  accountId?: string
}

export interface InstagramDMsRequest extends UploadPostDateRangeFilter, UploadPostPaginationFilter, UploadPostRequestContext {
  platform?: 'instagram'
}

export interface InstagramCommentsRequest extends UploadPostDateRangeFilter, UploadPostPaginationFilter, UploadPostRequestContext {
  mediaId?: string
  postId?: string
  platform?: 'instagram'
}

export interface AnalyticsRequest extends UploadPostDateRangeFilter, UploadPostPaginationFilter, UploadPostRequestContext {
  metrics?: string[]
  dimensions?: string[]
  platform?: string
}

export interface ProfileAnalyticsRequest {
  profileUsername: string
  platforms: string[]
  pageId?: string
  pageUrn?: string
}

export function getAnalyticsEndpointCandidates(platform?: AnalyticsRequest['platform']): string[] {
  if (platform === 'instagram') {
    return [UPLOADPOST_ENDPOINTS.instagramAnalytics, UPLOADPOST_ENDPOINTS.analytics]
  }

  return [UPLOADPOST_ENDPOINTS.analytics]
}

export async function getProfileAnalytics(request: ProfileAnalyticsRequest): Promise<Record<string, any>> {
  if (!request.profileUsername?.trim()) {
    throw new Error('Profile username is required for analytics')
  }

  if (!request.platforms?.length) {
    throw new Error('At least one platform is required for analytics')
  }

  try {
    const response = await axios.get(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.profileAnalytics}/${encodeURIComponent(request.profileUsername.trim())}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        params: {
          platforms: request.platforms.join(','),
          ...(request.pageId ? { page_id: request.pageId } : {}),
          ...(request.pageUrn ? { page_urn: request.pageUrn } : {}),
        },
        timeout: 30000,
      }
    )

    return response.data || {}
  } catch (error: any) {
    throw normalizeUploadPostError(error, 'Failed to get Upload-Post profile analytics', `${UPLOADPOST_ENDPOINTS.profileAnalytics}/${request.profileUsername}`)
  }
}


export interface SendDirectMessageRequest extends UploadPostRequestContext {
  platform: 'instagram'
  recipientId: string
  message: string
}

export interface SendDirectMessageResponse {
  success?: boolean
  recipient_id?: string
  message_id?: string
  message?: string
  error?: string
  [key: string]: any
}

export interface InstagramDM {
  id: string
  text?: string
  timestamp?: string
  senderId?: string
  recipientId?: string
  threadId?: string
  raw?: any
}

export interface InstagramComment {
  id: string
  text?: string
  timestamp?: string
  authorId?: string
  mediaId?: string
  raw?: any
}

export interface AnalyticsEntry {
  date?: string
  metric?: string
  value?: number
  breakdown?: Record<string, any>
  raw?: any
}

export interface UploadPostListResponse<T> {
  status: string
  data: T[]
  page?: number
  perPage?: number
  total?: number
  hasMore?: boolean
  cursor?: string
  raw?: any
}

export interface PostVideoRequest {
  videoUrl: string
  platforms: string[] // Array of platform names
  caption?: string
  scheduledTime?: string
  userId?: string // Upload-post user profile ID
  asyncUpload?: boolean
}

export interface UploadPostResponse {
  upload_id?: string
  status: string
  results?: Array<{
    platform: string
    status: string
    post_id?: string
    error?: string
  }>
  error?: string
}

function parseRetryAfterMs(retryAfterHeader: string | number | undefined): number | null {
  if (retryAfterHeader === undefined || retryAfterHeader === null) {
    return null
  }

  if (typeof retryAfterHeader === 'number' && Number.isFinite(retryAfterHeader) && retryAfterHeader >= 0) {
    return retryAfterHeader * 1000
  }

  if (typeof retryAfterHeader !== 'string' || retryAfterHeader.trim() === '') {
    return null
  }

  const numericSeconds = Number(retryAfterHeader)
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return numericSeconds * 1000
  }

  const retryDateMs = Date.parse(retryAfterHeader)
  if (!Number.isNaN(retryDateMs)) {
    return Math.max(0, retryDateMs - Date.now())
  }

  return null
}

async function buildUploadVideoFormData(request: PostVideoRequest): Promise<any> {
  const { default: FormData } = await import('form-data')
  const formData = new FormData()

  formData.append('user', request.userId)
  formData.append('video', request.videoUrl)

  const postTitle = buildUploadPostTitle(request.caption)
  if (request.caption && request.caption.trim().length > postTitle.length) {
    console.warn(
      `[Upload-Post] Truncated title from ${request.caption.trim().length} to ${postTitle.length} characters to satisfy platform limits.`
    )
  }
  formData.append('title', postTitle)

  request.platforms.forEach(platform => {
    formData.append('platform[]', platform)
  })

  if (request.platforms.includes('instagram')) {
    formData.append('media_type', 'REELS')
    formData.append('share_to_feed', 'true')
  }

  const postDescription = buildUploadPostDescription(request.caption)
  if (postDescription) {
    formData.append('description', postDescription)
  }

  const skipScheduling = process.env.UPLOADPOST_SKIP_SCHEDULING !== 'false'

  if (request.scheduledTime && !skipScheduling) {
    let scheduledDate: string
    if (typeof request.scheduledTime === 'string' && request.scheduledTime.includes('T') && request.scheduledTime.endsWith('Z')) {
      scheduledDate = request.scheduledTime
    } else {
      const dateObj = new Date(request.scheduledTime)
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid scheduled time format: ${request.scheduledTime}`)
      }
      scheduledDate = dateObj.toISOString()
    }
    formData.append('scheduled_date', scheduledDate)
    console.log('[Upload-Post] Scheduling post for:', scheduledDate)
  } else if (request.scheduledTime && skipScheduling) {
    console.log('[Upload-Post] Skipping scheduled_date parameter - will send at scheduled time via local scheduler')
  }

  formData.append('async_upload', String(request.asyncUpload ?? true))

  return formData
}


// Create user profile in Upload-Post
export async function createUserProfile(
  request: CreateUserProfileRequest
): Promise<UserProfile> {
  try {
    if (!request.username || request.username.trim() === '') {
      throw new Error('Username is required to create Upload-Post profile')
    }

    const payload: Record<string, any> = {
      username: request.username.trim(),
    }

    if (request.email) payload.email = request.email
    if (request.name) payload.name = request.name

    console.log('Creating Upload-Post user profile:', {
      url: `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.createUserProfile}`,
      payload,
      hasApiKey: !!getUploadPostKey(),
    })

    const response = await axios.post(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.createUserProfile}`,
      payload,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    )

    console.log('Upload-Post create user response:', {
      status: response.status,
      data: response.data,
      dataType: typeof response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
    })

    // Handle different response formats
    const responseData = response.data

    if (responseData?.profile && typeof responseData.profile === 'object') {
      return responseData.profile
    }

    if (typeof responseData === 'object' && responseData !== null) {
      return responseData
    }

    return {
      username: request.username,
      id: typeof responseData === 'string' ? responseData : undefined,
    }
  } catch (error: any) {
    console.error('Upload-post create user error details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
    })
    
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        'Failed to create user profile'
    
    throw new Error(errorMessage)
  }
}

export interface GenerateUserAccessLinkOptions {
  redirectUrl?: string
  logoImage?: string
  redirectButtonText?: string
  connectTitle?: string
  connectDescription?: string
  platforms?: Array<'tiktok' | 'instagram' | 'linkedin' | 'youtube' | 'facebook' | 'x' | 'threads'>
}

export interface UploadPostAccessLink {
  accessUrl: string
  duration?: string
  success?: boolean
  raw?: any
}

// Generate access URL (JWT-backed) for user to link social accounts
export async function generateUserAccessLink(
  username: string,
  options: GenerateUserAccessLinkOptions = {}
): Promise<UploadPostAccessLink> {
  try {
    if (!username || username.trim() === '') {
      throw new Error('Username is required to generate Upload-Post access link')
    }
    const payload: Record<string, any> = {
      username: username.trim(),
    }

    if (options.redirectUrl) payload.redirect_url = options.redirectUrl
    if (options.logoImage) payload.logo_image = options.logoImage
    if (options.redirectButtonText) payload.redirect_button_text = options.redirectButtonText
    if (options.connectTitle) payload.connect_title = options.connectTitle
    if (options.connectDescription) payload.connect_description = options.connectDescription
    if (options.platforms && options.platforms.length > 0) payload.platforms = options.platforms

    console.log('Generating Upload-Post access link with payload:', payload)

    const response = await axios.post(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.generateUserAccessLink}`,
      payload,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    )

    const accessUrl = response.data?.access_url || response.data?.accessUrl

    console.log('Access link response:', {
      status: response.status,
      hasAccessUrl: !!accessUrl,
      dataKeys: Object.keys(response.data || {}),
    })

    if (!accessUrl || typeof accessUrl !== 'string') {
      throw new Error('Upload-Post did not return a valid access_url')
    }

    return {
      accessUrl,
      duration: response.data?.duration,
      success: response.data?.success,
      raw: response.data,
    }
  } catch (error: any) {
    console.error('Upload-post access link error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      username,
    })
    throw new Error(
      error.response?.data?.message || 
      error.response?.data?.error ||
      'Failed to generate access link'
    )
  }
}

// Get user profile
export async function getUserProfile(username: string): Promise<UserProfile> {
  try {
    if (!username || username.trim() === '') {
      throw new Error('Username is required to fetch Upload-Post user profile')
    }

    const response = await axios.get(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.userProfile}/${encodeURIComponent(username.trim())}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
        },
      }
    )

    const responseData = response.data

    if (responseData?.profile && typeof responseData.profile === 'object') {
      return responseData.profile
    }

    return responseData
  } catch (error: any) {
    console.error('Upload-post get user error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get user profile'
    )
  }
}


export async function getInstagramDMs(
  filters: InstagramDMsRequest
): Promise<UploadPostListResponse<InstagramDM>> {
  try {
    const response = await axios.get(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.dmsConversations}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
        },
        params: {
          ...buildLookupQueryParams(filters),
          start_date: filters.startDate,
          end_date: filters.endDate,
          page: filters.page,
          per_page: filters.perPage,
          limit: filters.limit,
          cursor: filters.cursor,
          platform: filters.platform,
        },
        timeout: 15000,
      }
    )

    const normalized = normalizePaginatedResponse<any>(response.data, ['conversations', 'messages', 'dms', 'data'])

    return {
      ...normalized,
      data: normalized.data.map((dm: any): InstagramDM => ({
        id: String(dm.id || dm.message_id || dm.dm_id || dm.messages?.data?.[0]?.id || ''),
        text: dm.text || dm.message || dm.messages?.data?.[0]?.message,
        timestamp: dm.timestamp || dm.created_at || dm.messages?.data?.[0]?.created_time,
        senderId: dm.sender_id || dm.sender?.id || dm.messages?.data?.[0]?.from?.id,
        recipientId: dm.recipient_id || dm.recipient?.id || dm.messages?.data?.[0]?.to?.data?.[0]?.id,
        threadId: dm.thread_id || dm.conversation_id || dm.id,
        raw: dm,
      })),
    }
  } catch (error: any) {
    console.error('Upload-post Instagram DMs error:', error.response?.data || error.message)
    throw normalizeUploadPostError(error, 'Failed to get Instagram DMs', UPLOADPOST_ENDPOINTS.dmsConversations)
  }
}

export async function getInstagramComments(
  filters: InstagramCommentsRequest
): Promise<UploadPostListResponse<InstagramComment>> {
  try {
    const response = await axios.get(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.instagramComments}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
        },
        params: {
          ...buildLookupQueryParams(filters),
          start_date: filters.startDate,
          end_date: filters.endDate,
          page: filters.page,
          per_page: filters.perPage,
          limit: filters.limit,
          cursor: filters.cursor,
          media_id: filters.mediaId,
          post_id: filters.postId,
          platform: filters.platform,
        },
        timeout: 15000,
      }
    )

    const normalized = normalizePaginatedResponse<any>(response.data, ['comments', 'data'])

    return {
      ...normalized,
      data: normalized.data.map((comment: any): InstagramComment => ({
        id: String(comment.id || comment.comment_id || ''),
        text: comment.text || comment.message,
        timestamp: comment.timestamp || comment.created_at,
        authorId: comment.author_id || comment.from?.id || comment.user_id,
        mediaId: comment.media_id || comment.post_id,
        raw: comment,
      })),
    }
  } catch (error: any) {
    console.error('Upload-post Instagram comments error:', error.response?.data || error.message)
    throw normalizeUploadPostError(error, 'Failed to get Instagram comments', UPLOADPOST_ENDPOINTS.instagramComments)
  }
}

export async function getAnalytics(
  filters: AnalyticsRequest
): Promise<UploadPostListResponse<AnalyticsEntry>> {
  const analyticsEndpoints = getAnalyticsEndpointCandidates(filters.platform)
  let response: any = null
  let lastError: any = null

  for (const endpoint of analyticsEndpoints) {
    try {
      response = await axios.get(
        `${UPLOADPOST_API_URL}${endpoint}`,
        {
          headers: {
            'Authorization': getAuthHeader(),
          },
          params: {
            ...buildLookupQueryParams(filters),
            start_date: filters.startDate,
            end_date: filters.endDate,
            page: filters.page,
            per_page: filters.perPage,
            limit: filters.limit,
            cursor: filters.cursor,
            metrics: filters.metrics?.join(','),
            dimensions: filters.dimensions?.join(','),
            platform: filters.platform,
          },
          timeout: 15000,
        }
      )

      break
    } catch (error: any) {
      lastError = error
      const isLastEndpoint = endpoint === analyticsEndpoints[analyticsEndpoints.length - 1]
      const shouldFallback = error.response?.status === 404 && !isLastEndpoint

      if (shouldFallback) {
        continue
      }

      console.error('Upload-post analytics error:', error.response?.data || error.message)
      throw normalizeUploadPostError(error, 'Failed to get Upload-Post analytics', endpoint)
    }
  }

  if (!response) {
    console.error('Upload-post analytics error:', lastError?.response?.data || lastError?.message)
    throw normalizeUploadPostError(
      lastError,
      'Failed to get Upload-Post analytics',
      analyticsEndpoints[analyticsEndpoints.length - 1]
    )
  }

  try {

    const normalized = normalizePaginatedResponse<any>(response.data, ['analytics', 'insights', 'data'])

    return {
      ...normalized,
      data: normalized.data.map((entry: any): AnalyticsEntry => ({
        date: entry.date || entry.day,
        metric: entry.metric || entry.name,
        value: Number(entry.value ?? entry.count ?? 0),
        breakdown: entry.breakdown,
        raw: entry,
      })),
    }
  } catch (error: any) {
    console.error('Upload-post analytics parsing error:', error.response?.data || error.message)
    throw normalizeUploadPostError(
      error,
      'Failed to get Upload-Post analytics',
      analyticsEndpoints[analyticsEndpoints.length - 1]
    )
  }
}


export async function sendDirectMessage(
  request: SendDirectMessageRequest
): Promise<SendDirectMessageResponse> {
  try {
    const params = buildLookupQueryParams(request)

    if (!params.user) {
      throw new Error('Upload-Post username is required to send DMs')
    }

    if (!request.recipientId || !request.message?.trim()) {
      throw new Error('Recipient ID and message are required to send DMs')
    }

    const response = await axios.post(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.dmsSend}`,
      {
        platform: request.platform,
        user: params.user,
        recipient_id: request.recipientId,
        message: request.message.trim(),
      },
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    )

    return response.data
  } catch (error: any) {
    console.error('Upload-post send DM error:', error.response?.data || error.message)
    throw normalizeUploadPostError(error, 'Failed to send direct message', UPLOADPOST_ENDPOINTS.dmsSend)
  }
}

// Upload video to multiple platforms
export async function postVideo(
  request: PostVideoRequest
): Promise<UploadPostResponse> {
  try {
    if (!request.userId) {
      throw new Error('User ID is required for posting videos')
    }

    // According to Upload-Post API docs: https://docs.upload-post.com/api/upload-video
    // The correct endpoint is: POST /api/upload
    const endpoint = `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.upload}`

    console.log('Upload-Post API request:', {
      endpoint,
      user: request.userId,
      platforms: request.platforms,
      videoUrl: request.videoUrl,
      hasApiKey: !!getUploadPostKey(),
      scheduledDate: request.scheduledTime,
    })

    // First, verify the video URL is accessible
    try {
      const videoCheck = await axios.head(request.videoUrl, { timeout: 5000 })
      console.log('Video URL check:', {
        status: videoCheck.status,
        headers: videoCheck.headers,
      })
    } catch (videoError: any) {
      console.warn('Video URL may not be accessible:', {
        status: videoError.response?.status,
        message: videoError.message,
        url: request.videoUrl,
      })
      // Continue anyway - Upload-Post might handle it
    }

    // Retry logic with exponential backoff for rate limits and server errors
    let response
    let lastError: any

    for (let attempt = 0; attempt < MAX_UPLOADPOST_RETRIES; attempt++) {
      try {
        const formData = await buildUploadVideoFormData(request)
        response = await axios.post(
          endpoint,
          formData,
          {
            headers: {
              'Authorization': getAuthHeader(),
              ...formData.getHeaders(), // Important: form-data needs proper headers
            },
            timeout: 30000, // 30 second timeout
          }
        )
        // Success - break out of retry loop
        break
      } catch (error: any) {
        lastError = error
        const status = error.response?.status
        const statusText = error.response?.statusText
        const errorData = error.response?.data
        
        console.error(`[Upload-Post] API request failed (attempt ${attempt + 1}/${MAX_UPLOADPOST_RETRIES}):`, {
          endpoint,
          status,
          statusText,
          errorData,
          message: error.message,
          hasApiKey: !!getUploadPostKey(),
        })
        
        // Handle non-retryable errors immediately
        if (status === 404) {
          throw new Error(
            `Upload-Post API endpoint not found (404). Please verify the endpoint is correct: ${endpoint}. ` +
            `Check the Upload-Post API documentation: https://docs.upload-post.com/api/upload-video`
          )
        } else if (status === 401) {
          throw new Error('Upload-Post API authentication failed. Please check your UPLOADPOST_KEY environment variable.')
        } else if (status === 403) {
          throw new Error(errorData?.message || 'Upload-Post API access forbidden. Please check your plan limits.')
        }
        
        // Retry on rate limit (429) or server errors (5xx)
        if (status === 429 || (status >= 500 && status < 600)) {
          if (attempt < MAX_UPLOADPOST_RETRIES - 1) {
            // Calculate delay with exponential backoff
            const delay = DEFAULT_UPLOADPOST_RETRY_DELAY_MS * Math.pow(2, attempt)
            
            // If 429, try to use retry-after header if available
            const retryAfter = error.response?.headers?.['retry-after'] || 
                             error.response?.headers?.['x-ratelimit-reset']
            const retryAfterMs = parseRetryAfterMs(retryAfter)
            const waitTime = retryAfterMs ?? delay
            
            console.log(`[Upload-Post] Rate limit or server error (${status}), retrying in ${waitTime}ms (attempt ${attempt + 1}/${MAX_UPLOADPOST_RETRIES})`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          } else {
            // Last attempt failed - throw appropriate error
            if (status === 429) {
              throw new Error('Upload-Post API rate limit exceeded. Please try again later.')
            } else {
              throw new Error('Upload-Post API server error. Please try again later.')
            }
          }
        }
        
        // For other errors, throw immediately
        throw new Error(
          errorData?.message || 
          errorData?.error || 
          `Upload-Post API error: ${statusText || error.message}`
        )
      }
    }

    // If we exhausted retries without success
    if (!response && lastError) {
      const status = lastError.response?.status
      if (status === 429) {
        throw new Error('Upload-Post API rate limit exceeded. Please try again later.')
      } else if (status >= 500) {
        throw new Error('Upload-Post API server error. Please try again later.')
      }
      throw lastError
    }

    // Type guard: response must be defined at this point
    if (!response) {
      throw new Error('Upload-Post API request failed: no response received')
    }

    console.log('Upload-Post API response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers,
    })

    // Handle different response formats based on upload-post.com API
    // Response can be:
    // 1. 202 Accepted - Scheduled upload (has job_id)
    // 2. 200 OK with request_id - Async upload started
    // 3. 200 OK with results - Synchronous response with immediate results
    
    if (response.status === 202) {
      // Scheduled - return job_id as upload_id
      const uploadId = response.data.job_id || response.data.request_id || response.data.upload_id
      console.log('[Upload-Post] Scheduled upload, job_id:', uploadId)
      return {
        upload_id: uploadId,
        status: 'scheduled',
        results: [],
      }
    }
    
    // Check for async upload response
    if (response.data.request_id || response.data.upload_id) {
      const uploadId = response.data.request_id || response.data.upload_id
      console.log('[Upload-Post] Async upload started, request_id:', uploadId)
      
      // If there are immediate results, include them
      let results: any[] = []
      if (response.data.results) {
        if (typeof response.data.results === 'object' && !Array.isArray(response.data.results)) {
          results = Object.entries(response.data.results).map(([platform, result]: [string, any]) => ({
            platform,
            status: result.success ? 'success' : (result.error ? 'failed' : 'pending'),
            post_id: result.url || result.container_id || result.post_id || result.video_id,
            error: result.error || null,
          }))
        } else if (Array.isArray(response.data.results)) {
          results = response.data.results
        }
      }
      
      return {
        upload_id: uploadId,
        status: results.length > 0 && results.every((r: any) => r.status === 'success') ? 'success' : 'pending',
        results,
      }
    }
    
    // Check for synchronous response with results
    if (response.data.results) {
      const results = typeof response.data.results === 'object' && !Array.isArray(response.data.results)
        ? Object.entries(response.data.results).map(([platform, result]: [string, any]) => ({
            platform,
            status: result.success ? 'success' : (result.error ? 'failed' : 'pending'),
            post_id: result.url || result.container_id || result.post_id || result.video_id,
            error: result.error || null,
          }))
        : response.data.results

      console.log('[Upload-Post] Synchronous response with results:', results)
      return {
        upload_id: response.data.request_id || response.data.upload_id || undefined,
        status: response.data.success ? 'success' : (response.data.status || 'pending'),
        results,
        error: response.data.error || null,
      }
    }

    // Fallback - log warning and return pending status
    console.warn('[Upload-Post] Unexpected response format:', response.data)
    return {
      upload_id: response.data.request_id || response.data.job_id || response.data.upload_id || undefined,
      status: 'pending',
      results: [],
      error: 'Unexpected response format from upload-post API',
    }
  } catch (error: any) {
    // If error was already handled and thrown with a descriptive message, re-throw it
    if (error.message && error.message.includes('Upload-Post API')) {
      throw error
    }
    
    console.error('Upload-post API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
    })
    
    // Provide more detailed error message for unhandled errors
    let errorMessage = 'Failed to post video'
    
    if (error.response?.status === 404) {
      errorMessage = `Upload-Post API endpoint not found (404). Please check the API endpoint. Error: ${error.response?.data?.message || error.message}`
    } else if (error.response?.status === 400) {
      errorMessage = error.response?.data?.message || 'Invalid request parameters'
    } else if (error.response?.status === 401) {
      errorMessage = 'Upload-Post API authentication failed. Please check your API key.'
    } else if (error.response?.status === 403) {
      errorMessage = error.response?.data?.message || 'Access denied. Platform may not be available on your plan.'
    } else if (error.response?.status === 429) {
      errorMessage = error.response?.data?.message || 'Rate limit exceeded. Please try again later.'
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw new Error(errorMessage)
  }
}

// Get upload status
export async function getUploadStatus(uploadId: string): Promise<UploadPostResponse> {
  try {
    const response = await axios.get(
      `${UPLOADPOST_API_URL}${UPLOADPOST_ENDPOINTS.uploadStatus}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
        },
        params: {
          request_id: uploadId, // API uses request_id parameter
        },
      }
    )

    // Parse results from the response
    let results: any[] = []
    
    // Log raw response for debugging
    console.log(`[Upload-Post] Raw API response for ${uploadId}:`, {
      hasResults: !!response.data.results,
      resultsType: typeof response.data.results,
      isArray: Array.isArray(response.data.results),
      resultsKeys: response.data.results && typeof response.data.results === 'object' ? Object.keys(response.data.results) : null,
      overallStatus: response.data.status,
    })
    
    if (response.data.results) {
      // If results is an object with platform keys, convert to array
      if (typeof response.data.results === 'object' && !Array.isArray(response.data.results)) {
        results = Object.entries(response.data.results).map(([platform, result]: [string, any]) => {
          // Handle different status formats from Upload-Post API
          let status = 'pending'
          if (result.success === true || result.status === 'success' || result.status === 'completed' || result.status === 'posted') {
            status = 'success'
          } else if (result.error || result.success === false || result.status === 'failed') {
            status = 'failed'
          } else if (result.status) {
            status = result.status
          }
          
          return {
            platform: platform.toLowerCase(), // Normalize platform name to lowercase
            status,
            success: result.success !== false && (result.success === true || status === 'success' || status === 'completed' || status === 'posted'),
            post_id: result.url || result.container_id || result.post_id || result.video_id || result.id,
            error: result.error || null,
          }
        })
      } else if (Array.isArray(response.data.results)) {
        // Process array results - normalize status values and ensure platform field exists
        results = response.data.results.map((result: any) => {
          let status = result.status || 'pending'
          // Normalize status values
          if (status === 'completed' || status === 'posted') {
            status = 'success'
          }
          
          // Ensure platform field exists and is normalized to lowercase
          const platform = result.platform ? result.platform.toLowerCase() : 
                          result.platform_name ? result.platform_name.toLowerCase() :
                          result.name ? result.name.toLowerCase() :
                          'unknown'
          
          return {
            ...result,
            platform, // Ensure platform field is set and normalized
            status,
            success: result.success !== false && (result.success === true || status === 'success' || status === 'completed' || status === 'posted'),
            post_id: result.post_id || result.url || result.container_id || result.video_id || result.id,
          }
        })
      }
    }

    // Normalize overall status
    let overallStatus = response.data.status || 'unknown'
    if (overallStatus === 'completed' || overallStatus === 'posted') {
      overallStatus = 'success'
    }

    console.log(`[Upload-Post] Parsed upload status:`, {
      uploadId,
      overallStatus,
      resultsCount: results.length,
      results: results.map((r: any) => ({ platform: r.platform, status: r.status, success: r.success })),
    })

    return {
      upload_id: uploadId,
      status: overallStatus,
      results,
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get upload status'
    )
  }
}
