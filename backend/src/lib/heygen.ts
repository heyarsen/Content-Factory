import axios from 'axios'

const HEYGEN_API_URL = 'https://api.heygen.com/v1'
const HEYGEN_KEY = process.env.HEYGEN_KEY

if (!HEYGEN_KEY) {
  throw new Error('Missing HEYGEN_KEY environment variable')
}

export interface GenerateVideoRequest {
  topic: string
  script?: string
  style: 'casual' | 'professional' | 'energetic' | 'educational'
  duration: number
}

export interface HeyGenVideoResponse {
  video_id: string
  status: string
  video_url?: string
  error?: string
}

export async function generateVideo(
  request: GenerateVideoRequest
): Promise<HeyGenVideoResponse> {
  try {
    // Note: This is a placeholder implementation. Adjust based on actual HeyGen API documentation
    const response = await axios.post(
      `${HEYGEN_API_URL}/video/generate`,
      {
        topic: request.topic,
        script: request.script || request.topic,
        style: request.style,
        duration: request.duration,
      },
      {
        headers: {
          'Authorization': `Bearer ${HEYGEN_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      video_id: response.data.video_id || response.data.id,
      status: response.data.status || 'generating',
      video_url: response.data.video_url,
    }
  } catch (error: any) {
    console.error('HeyGen API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to generate video'
    )
  }
}

export async function getVideoStatus(
  videoId: string
): Promise<HeyGenVideoResponse> {
  try {
    const response = await axios.get(
      `${HEYGEN_API_URL}/video/${videoId}`,
      {
        headers: {
          'Authorization': `Bearer ${HEYGEN_KEY}`,
        },
      }
    )

    return {
      video_id: videoId,
      status: response.data.status,
      video_url: response.data.video_url,
      error: response.data.error,
    }
  } catch (error: any) {
    console.error('HeyGen API error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get video status'
    )
  }
}

