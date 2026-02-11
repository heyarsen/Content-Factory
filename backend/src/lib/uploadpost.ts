import axios from 'axios'

const UPLOADPOST_API_URL = 'https://api.upload-post.com/api'
const MAX_UPLOADPOST_TITLE_LENGTH = 100

export function buildUploadPostTitle(caption?: string): string {
  const fallbackTitle = 'Video Post'
  const rawTitle = caption?.trim() || fallbackTitle

  if (rawTitle.length <= MAX_UPLOADPOST_TITLE_LENGTH) {
    return rawTitle
  }

  const ellipsis = '...'
  const truncatedTitle = rawTitle.slice(0, MAX_UPLOADPOST_TITLE_LENGTH - ellipsis.length).trimEnd()

  return `${truncatedTitle}${ellipsis}`
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
      url: `${UPLOADPOST_API_URL}/uploadposts/users`,
      payload,
      hasApiKey: !!getUploadPostKey(),
    })

    const response = await axios.post(
      `${UPLOADPOST_API_URL}/uploadposts/users`,
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
  platforms?: Array<'tiktok' | 'instagram' | 'linkedin' | 'youtube' | 'facebook' | 'x' | 'threads' | 'pinterest'>
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
      `${UPLOADPOST_API_URL}/uploadposts/users/generate-jwt`,
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
      `${UPLOADPOST_API_URL}/uploadposts/users/${encodeURIComponent(username.trim())}`,
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

// Upload video to multiple platforms
export async function postVideo(
  request: PostVideoRequest
): Promise<UploadPostResponse> {
  try {
    if (!request.userId) {
      throw new Error('User ID is required for posting videos')
    }

    // Build form data according to Upload-Post API documentation
    // https://docs.upload-post.com/api/upload-video
    const { default: FormData } = await import('form-data')
    const formData = new FormData()
    
    // Required fields
    formData.append('user', request.userId)
    formData.append('video', request.videoUrl) // Can be URL or file
    const postTitle = buildUploadPostTitle(request.caption)
    if (request.caption && request.caption.trim().length > postTitle.length) {
      console.warn(
        `[Upload-Post] Truncated title from ${request.caption.trim().length} to ${postTitle.length} characters to satisfy platform limits.`
      )
    }
    formData.append('title', postTitle)
    
    // Platform array - must be sent as platform[] for each platform
    request.platforms.forEach(platform => {
      formData.append('platform[]', platform)
    })

    // Platform-specific parameters
    // Instagram: Set media_type to REELS for vertical format
    if (request.platforms.includes('instagram')) {
      formData.append('media_type', 'REELS')
      formData.append('share_to_feed', 'true')
    }

    // Optional fields
    const postDescription = buildUploadPostDescription(request.caption)
    if (postDescription) {
      formData.append('description', postDescription)
    }

    // Option to skip scheduling in Upload-Post and send at the right time instead
    // Default to true to avoid timezone issues - local scheduler will send at correct time
    // Set UPLOADPOST_SKIP_SCHEDULING=false to use Upload-Post scheduling (may have timezone issues)
    const skipScheduling = process.env.UPLOADPOST_SKIP_SCHEDULING !== 'false'
    
    if (request.scheduledTime && !skipScheduling) {
      // Convert to ISO-8601 format if needed
      try {
        // Check if already in ISO format
        let scheduledDate: string
        if (typeof request.scheduledTime === 'string' && request.scheduledTime.includes('T') && request.scheduledTime.endsWith('Z')) {
          // Already in ISO format with Z
          scheduledDate = request.scheduledTime
        } else {
          // Try to parse and convert
          const dateObj = new Date(request.scheduledTime)
          if (isNaN(dateObj.getTime())) {
            throw new Error(`Invalid scheduled time format: ${request.scheduledTime}`)
          }
          scheduledDate = dateObj.toISOString()
        }
        formData.append('scheduled_date', scheduledDate)
        console.log('[Upload-Post] Scheduling post for:', scheduledDate)
      } catch (error: any) {
        console.error('[Upload-Post] Invalid scheduled time:', request.scheduledTime, error.message)
        throw new Error(`Invalid scheduled time format: ${request.scheduledTime}. ${error.message}`)
      }
    } else if (request.scheduledTime && skipScheduling) {
      console.log('[Upload-Post] Skipping scheduled_date parameter - will send at scheduled time via local scheduler')
      // Don't append scheduled_date - the request will be sent at the right time by our scheduler
    }

    // Always use async upload to avoid timeouts
    formData.append('async_upload', String(request.asyncUpload ?? true))

    // According to Upload-Post API docs: https://docs.upload-post.com/api/upload-video
    // The correct endpoint is: POST /api/upload
    const endpoint = `${UPLOADPOST_API_URL}/upload`

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
    const maxRetries = 3
    const initialDelay = 2000 // Start with 2 seconds
    let response
    let lastError: any

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
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
        
        console.error(`[Upload-Post] API request failed (attempt ${attempt + 1}/${maxRetries}):`, {
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
          if (attempt < maxRetries - 1) {
            // Calculate delay with exponential backoff
            const delay = initialDelay * Math.pow(2, attempt)
            
            // If 429, try to use retry-after header if available
            const retryAfter = error.response?.headers?.['retry-after'] || 
                             error.response?.headers?.['x-ratelimit-reset']
            const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay
            
            console.log(`[Upload-Post] Rate limit or server error (${status}), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`)
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
      `${UPLOADPOST_API_URL}/uploadposts/status`,
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
