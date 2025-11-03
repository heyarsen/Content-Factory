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
  email?: string
  name?: string
  username?: string
}

export interface UserProfile {
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
    const payload: any = {}
    
    // Username is required by Upload-Post API
    if (!request.username && !request.email) {
      throw new Error('Username or email is required to create Upload-Post profile')
    }
    
    // Username can be derived from email if not provided
    const username = request.username || (request.email ? request.email.split('@')[0] : undefined)
    
    if (username) payload.username = username
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
    
    // Check if response is the user object directly, or wrapped
    if (typeof responseData === 'object' && responseData !== null) {
      return responseData
    }
    
    // If response is a string or other format, return as-is
    return { id: responseData, user_id: responseData, userId: responseData }
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

// Generate JWT for user to link social accounts
export async function generateUserJWT(userId: string, username?: string): Promise<string> {
  try {
    console.log('Generating JWT for user:', userId, 'username:', username)
    
    const payload: any = {
      user_id: userId,
    }
    
    // profile_username is required by Upload-Post API
    // Always ensure we have a username - use provided one or use userId as fallback
    let profileUsername = username
    
    if (!profileUsername || profileUsername.trim() === '') {
      // If userId looks like an email, use it as username (full email to avoid conflicts)
      // Otherwise, use userId as-is (remove dashes if needed)
      profileUsername = userId.includes('@') ? userId : userId.replace(/-/g, '_')
    }
    
    if (!profileUsername || profileUsername.trim() === '') {
      throw new Error('profile_username is required but could not be determined')
    }
    
    payload.profile_username = profileUsername
    
    console.log('JWT generation payload:', {
      user_id: payload.user_id,
      profile_username: payload.profile_username,
      hasUsername: !!payload.profile_username,
    })
    
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

    console.log('JWT generation response:', {
      status: response.status,
      hasJWT: !!(response.data.jwt || response.data.token),
      dataKeys: Object.keys(response.data || {}),
    })

    // Handle different response formats
    let jwt: string | undefined
    
    if (typeof response.data === 'string') {
      jwt = response.data
    } else if (typeof response.data === 'object' && response.data !== null) {
      jwt = response.data.jwt || response.data.token || response.data.access_token
    }
    
    if (!jwt || typeof jwt !== 'string') {
      console.error('Invalid JWT response format:', {
        dataType: typeof response.data,
        data: response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
      })
      throw new Error(`Upload-Post did not return a valid JWT. Response format: ${typeof response.data}`)
    }

    return jwt
  } catch (error: any) {
    console.error('Upload-post generate JWT error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      userId,
      username,
    })
    
    // Extract error message from various possible formats
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.response?.data?.detail ||
                        error.response?.statusText ||
                        error.message ||
                        'Failed to generate JWT'
    
    throw new Error(errorMessage)
  }
}

// Get user profile
export async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    const response = await axios.get(
      `${UPLOADPOST_API_URL}/uploadposts/users`,
      {
        headers: {
          'Authorization': getAuthHeader(),
        },
        params: {
          user_id: userId,
        },
      }
    )

    return response.data
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

    const response = await axios.post(
      `${UPLOADPOST_API_URL}/upload_videos`,
      payload,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      upload_id: response.data.upload_id || response.data.id,
      status: response.data.status || 'pending',
      results: response.data.results,
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to post video'
    )
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

