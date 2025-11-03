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
}

export interface UserProfile {
  id?: string
  user_id?: string
  userId?: string
  email?: string
  name?: string
  jwt?: string
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
    })

    return response.data
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
export async function generateUserJWT(userId: string): Promise<string> {
  try {
    console.log('Generating JWT for user:', userId)
    
    const response = await axios.post(
      `${UPLOADPOST_API_URL}/uploadposts/users/generate-jwt`,
      {
        user_id: userId,
      },
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

    const jwt = response.data.jwt || response.data.token || response.data
    if (!jwt || typeof jwt !== 'string') {
      throw new Error('Upload-Post did not return a valid JWT')
    }

    return jwt
  } catch (error: any) {
    console.error('Upload-post generate JWT error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      userId,
    })
    throw new Error(
      error.response?.data?.message || 
      error.response?.data?.error ||
      'Failed to generate JWT'
    )
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

