import axios from 'axios'

const UPLOADPOST_API_URL = 'https://api.upload-post.com/api'

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
    formData.append('title', request.caption || 'Video Post')
    
    // Platform array - must be sent as platform[] for each platform
    request.platforms.forEach(platform => {
      formData.append('platform[]', platform)
    })

    // Optional fields
    if (request.caption) {
      formData.append('description', request.caption)
    }

    if (request.scheduledTime) {
      // Convert to ISO-8601 format if needed
      const scheduledDate = new Date(request.scheduledTime).toISOString()
      formData.append('scheduled_date', scheduledDate)
    }

    // Always use async upload to avoid timeouts
    formData.append('async_upload', String(request.asyncUpload ?? true))

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

    const response = await axios.post(
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

    console.log('Upload-Post API response:', {
      status: response.status,
      data: response.data,
    })

    // Handle different response formats
    if (response.status === 202) {
      // Scheduled - return job_id as upload_id
      return {
        upload_id: response.data.job_id,
        status: 'scheduled',
        results: [],
      }
    } else if (response.data.request_id) {
      // Async upload started
      return {
        upload_id: response.data.request_id,
        status: 'pending',
        results: [],
      }
    } else if (response.data.results) {
      // Synchronous response with results
      const results = Object.entries(response.data.results || {}).map(([platform, result]: [string, any]) => ({
        platform,
        status: result.success ? 'success' : 'failed',
        post_id: result.url || result.container_id || result.post_id || result.video_id,
        error: result.error || null,
      }))

      return {
        upload_id: response.data.request_id || undefined,
        status: response.data.success ? 'success' : 'pending',
        results,
        error: response.data.error || null,
      }
    }

    // Fallback response
    return {
      upload_id: response.data.request_id || response.data.job_id,
      status: 'pending',
      results: [],
    }
  } catch (error: any) {
    console.error('Upload-post API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
    })
    
    // Provide more detailed error message
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

    return {
      upload_id: uploadId,
      status: response.data.status || 'unknown',
      results: response.data.results,
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get upload status'
    )
  }
}

