import axios from 'axios'

const UPLOADPOST_API_URL = 'https://api.upload-post.com/v1'

function getUploadPostKey(): string {
  const key = process.env.UPLOADPOST_KEY
  if (!key) {
    throw new Error('Missing UPLOADPOST_KEY environment variable')
  }
  return key
}

export interface ConnectAccountRequest {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  redirectUri: string
}

export interface PostVideoRequest {
  videoUrl: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  caption?: string
  scheduledTime?: string
  accountId: string
}

export interface UploadPostResponse {
  post_id: string
  status: string
  error?: string
}

export async function initiateOAuthConnection(
  request: ConnectAccountRequest
): Promise<{ authUrl: string }> {
  try {
    const apiKey = getUploadPostKey()
    console.log('Calling upload-post.com API:', {
      url: `${UPLOADPOST_API_URL}/oauth/connect`,
      platform: request.platform,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
    })

    const response = await axios.post(
      `${UPLOADPOST_API_URL}/oauth/connect`,
      {
        platform: request.platform,
        redirect_uri: request.redirectUri,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    )

    console.log('Upload-post API response:', {
      status: response.status,
      hasAuthUrl: !!(response.data.auth_url || response.data.url),
      responseKeys: Object.keys(response.data || {}),
    })

    const authUrl = response.data.auth_url || response.data.url || response.data.redirect_url

    if (!authUrl) {
      console.error('No auth URL in response:', response.data)
      throw new Error('Upload-post API did not return an authentication URL')
    }

    return { authUrl }
  } catch (error: any) {
    console.error('Upload-post API error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? Object.keys(error.config.headers) : null,
      },
    })
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to upload-post.com API. Please verify the API URL is correct: ${UPLOADPOST_API_URL}`)
    }
    
    if (error.response) {
      throw new Error(
        `Upload-post API error (${error.response.status}): ${error.response.data?.message || error.response.statusText || 'Unknown error'}`
      )
    }
    
    throw new Error(
      error.message || 'Failed to initiate OAuth connection'
    )
  }
}

export async function handleOAuthCallback(
  code: string,
  platform: string
): Promise<{
  accountId: string
  accessToken: string
  refreshToken?: string
}> {
  try {
    const response = await axios.post(
      `${UPLOADPOST_API_URL}/oauth/callback`,
      {
        code,
        platform,
      },
      {
        headers: {
          'Authorization': `Bearer ${getUploadPostKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      accountId: response.data.account_id || response.data.id,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to handle OAuth callback'
    )
  }
}

export async function postVideo(
  request: PostVideoRequest
): Promise<UploadPostResponse> {
  try {
    const response = await axios.post(
      `${UPLOADPOST_API_URL}/post/video`,
      {
        video_url: request.videoUrl,
        platform: request.platform,
        caption: request.caption,
        scheduled_time: request.scheduledTime,
        account_id: request.accountId,
      },
      {
        headers: {
          'Authorization': `Bearer ${getUploadPostKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      post_id: response.data.post_id || response.data.id,
      status: response.data.status || 'pending',
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to post video'
    )
  }
}

export async function getPostStatus(postId: string): Promise<UploadPostResponse> {
  try {
    const response = await axios.get(
      `${UPLOADPOST_API_URL}/post/${postId}`,
      {
        headers: {
          'Authorization': `Bearer ${getUploadPostKey()}`,
        },
      }
    )

    return {
      post_id: postId,
      status: response.data.status,
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get post status'
    )
  }
}

