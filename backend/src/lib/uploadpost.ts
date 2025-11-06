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
    const payload: any = {
      video_url: request.videoUrl,
      platforms: request.platforms,
      async_upload: request.asyncUpload ?? true,
    }

    if (request.caption) {
      payload.caption = request.caption
    }

    if (request.scheduledTime) {
      payload.scheduled_time = request.scheduledTime
    }

    if (request.userId) {
      payload.user_id = request.userId
    }

    console.log('Upload-Post API request:', {
      url: `${UPLOADPOST_API_URL}/upload_videos`,
      payload,
      hasApiKey: !!getUploadPostKey(),
    })

    const response = await axios.post(
      `${UPLOADPOST_API_URL}/upload_videos`,
      payload,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    )

    console.log('Upload-Post API response:', {
      status: response.status,
      data: response.data,
    })

    return {
      upload_id: response.data.upload_id || response.data.id,
      status: response.data.status || 'pending',
      results: response.data.results,
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
    })
    
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        'Failed to post video'
    
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
          upload_id: uploadId,
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

