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
    // Note: This is a placeholder implementation. Adjust based on actual upload-post.com API documentation
    const response = await axios.post(
      `${UPLOADPOST_API_URL}/oauth/connect`,
      {
        platform: request.platform,
        redirect_uri: request.redirectUri,
      },
      {
        headers: {
          'Authorization': `Bearer ${getUploadPostKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      authUrl: response.data.auth_url || response.data.url,
    }
  } catch (error: any) {
    console.error('Upload-post API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to initiate OAuth connection'
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

