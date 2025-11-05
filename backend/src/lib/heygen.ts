import axios from 'axios'

const HEYGEN_API_URL = 'https://api.heygen.com/v1'

function getHeyGenKey(): string {
  const key = process.env.HEYGEN_KEY
  if (!key) {
    throw new Error('Missing HEYGEN_KEY environment variable')
  }
  return key
}

export interface GenerateVideoRequest {
  topic: string
  script?: string
  style: 'casual' | 'professional' | 'energetic' | 'educational'
  duration: number
  avatar_id?: string
  template_id?: string
}

export interface HeyGenVideoResponse {
  video_id: string
  status: string
  video_url?: string
  error?: string
}

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  avatar_url?: string
  gender?: string
  preview_url?: string
  thumbnail_url?: string
  status?: string
}

export interface HeyGenAvatarsResponse {
  avatars: HeyGenAvatar[]
}

/**
 * List available avatars from HeyGen
 */
export async function listAvatars(): Promise<HeyGenAvatarsResponse> {
  try {
    // Try HeyGen v1 API endpoints first (most common)
    const endpoints = [
      { method: 'POST', url: `${HEYGEN_API_URL}/avatar.list` },
      { method: 'GET', url: `${HEYGEN_API_URL}/avatars` },
      { method: 'POST', url: `${HEYGEN_API_URL}/avatars` },
      { method: 'GET', url: `${HEYGEN_API_URL}/avatar` },
      { method: 'POST', url: `${HEYGEN_API_URL}/avatar` },
    ]

    let lastError: any = null
    for (const { method, url } of endpoints) {
      try {
        const requestConfig = {
          headers: {
            'Authorization': `Bearer ${getHeyGenKey()}`,
            'Content-Type': 'application/json',
          },
        }

        const response = method === 'POST'
          ? await axios.post(url, {}, requestConfig)
          : await axios.get(url, requestConfig)

        console.log(`HeyGen API response from ${url} (${method}):`, {
          status: response.status,
          dataKeys: response.data ? Object.keys(response.data) : [],
          hasData: !!response.data?.data,
          hasAvatars: !!response.data?.avatars,
          isArray: Array.isArray(response.data),
        })

        // Handle different response structures - HeyGen API can return data in various formats
        let avatars: any[] = []
        
        if (response.data?.data?.avatars && Array.isArray(response.data.data.avatars)) {
          avatars = response.data.data.avatars
        } else if (response.data?.data?.data?.avatars && Array.isArray(response.data.data.data.avatars)) {
          avatars = response.data.data.data.avatars
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          avatars = response.data.data
        } else if (response.data?.avatars && Array.isArray(response.data.avatars)) {
          avatars = response.data.avatars
        } else if (Array.isArray(response.data)) {
          avatars = response.data
        }

        if (avatars.length > 0) {
          console.log(`Successfully fetched ${avatars.length} avatars from ${url} (${method})`)
          // Normalize avatar data structure
          const normalizedAvatars = avatars.map((avatar: any) => ({
            avatar_id: avatar.avatar_id || avatar.id || avatar.avatarId,
            avatar_name: avatar.avatar_name || avatar.name || avatar.avatarName || 'Unnamed Avatar',
            avatar_url: avatar.avatar_url || avatar.url || avatar.avatarUrl,
            preview_url: avatar.preview_url || avatar.previewUrl || avatar.preview,
            thumbnail_url: avatar.thumbnail_url || avatar.thumbnailUrl || avatar.thumbnail,
            gender: avatar.gender,
            status: avatar.status || 'active',
          }))
          return { avatars: normalizedAvatars }
        }
        
        // Log unexpected structure for debugging
        console.log(`Unexpected response structure from ${url}:`, JSON.stringify(response.data, null, 2).substring(0, 500))
      } catch (err: any) {
        // Log but continue trying other endpoints
        console.log(`Tried ${url} (${method}), got status ${err.response?.status}:`, err.response?.data || err.message)
        lastError = err
      }
    }

    // If we get here, all endpoints failed
    console.error('HeyGen API error (listAvatars): All endpoints failed', {
      lastError: lastError?.response?.data || lastError?.message,
      status: lastError?.response?.status,
      statusText: lastError?.response?.statusText,
    })

    throw new Error(
      lastError?.response?.data?.message || 
      lastError?.response?.data?.error?.message ||
      lastError?.message || 
      'Failed to list avatars. Please check your HeyGen API key and endpoint. The API may require a different endpoint format.'
    )
  } catch (error: any) {
    console.error('HeyGen API error (listAvatars):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Get avatar details by ID
 */
export async function getAvatar(avatarId: string): Promise<HeyGenAvatar> {
  try {
    const response = await axios.get(
      `${HEYGEN_API_URL}/avatar/${avatarId}`,
      {
        headers: {
          'Authorization': `Bearer ${getHeyGenKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Handle different response structures
    if (response.data.data) {
      return response.data.data
    }
    return response.data
  } catch (error: any) {
    console.error('HeyGen API error (getAvatar):', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get avatar'
    )
  }
}

export async function generateVideo(
  request: GenerateVideoRequest
): Promise<HeyGenVideoResponse> {
  try {
    // Build payload based on HeyGen API requirements
    // HeyGen typically uses either avatar_id or template_id for video generation
    const payload: any = {
      script: {
        type: 'text',
        input: request.script || request.topic,
      },
      dimension: {
        width: 1920,
        height: 1080,
      },
      aspect_ratio: '16:9',
    }

    // Use avatar_id if provided, otherwise fall back to template-based approach
    if (request.avatar_id) {
      payload.avatar_id = request.avatar_id
    } else if (request.template_id) {
      payload.template_id = request.template_id
    }

    const response = await axios.post(
      `${HEYGEN_API_URL}/video.generate`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${getHeyGenKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Handle different response structures
    const data = response.data.data || response.data

    return {
      video_id: data.video_id || data.id || data.videoId,
      status: data.status || 'generating',
      video_url: data.video_url || data.videoUrl || data.url,
    }
  } catch (error: any) {
    console.error('HeyGen API error (generateVideo):', error.response?.data || error.message)
    
    // Extract detailed error message
    let errorMessage = 'Failed to generate video'
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : JSON.stringify(error.response.data.error)
    } else if (error.response?.status === 401) {
      errorMessage = 'HeyGen API authentication failed. Please check your API key configuration.'
    } else if (error.response?.status === 429) {
      errorMessage = 'HeyGen API rate limit exceeded. Please try again later.'
    } else if (error.response?.status >= 500) {
      errorMessage = 'HeyGen API server error. Please try again later.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw new Error(errorMessage)
  }
}

/**
 * Create avatar from photo using HeyGen v2 API
 */
export async function createAvatarFromPhoto(
  photoUrl: string,
  avatarName: string
): Promise<{ avatar_id: string; status: string }> {
  try {
    // Try both v1 and v2 API endpoints
    const HEYGEN_V1_API_URL = 'https://api.heygen.com/v1'
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    
    let groupId: string | null = null
    let lastError: any = null
    
    // Step 1: Try to create avatar group (try v2 first, then v1)
    const endpoints = [
      { url: `${HEYGEN_V2_API_URL}/avatar_group.create`, version: 'v2' },
      { url: `${HEYGEN_V1_API_URL}/avatar.create`, version: 'v1' },
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying to create avatar group with ${endpoint.version} API...`)
        const groupResponse = await axios.post(
          endpoint.url,
          {
            name: avatarName,
            ...(endpoint.version === 'v1' ? { photo_url: photoUrl } : {}),
          },
          {
            headers: {
              'Authorization': `Bearer ${getHeyGenKey()}`,
              'Content-Type': 'application/json',
            },
          }
        )

        groupId = groupResponse.data?.data?.group_id || 
                  groupResponse.data?.group_id ||
                  groupResponse.data?.data?.id ||
                  groupResponse.data?.id
                  
        if (groupId) {
          console.log(`Successfully created avatar group with ${endpoint.version} API:`, groupId)
          break
        }
      } catch (err: any) {
        console.log(`${endpoint.version} API failed:`, err.response?.status, err.response?.data)
        lastError = err
        continue
      }
    }

    if (!groupId) {
      throw new Error(`Failed to create avatar group. All API endpoints failed. Last error: ${lastError?.response?.status} - ${lastError?.response?.data?.message || lastError?.message}`)
    }

    // Step 2: Upload photo to the group (only for v2 API)
    try {
      console.log('Uploading photo to avatar group...')
      await axios.post(
        `${HEYGEN_V2_API_URL}/avatar_group/${groupId}/photos`,
        {
          photo_url: photoUrl,
        },
        {
          headers: {
            'Authorization': `Bearer ${getHeyGenKey()}`,
            'Content-Type': 'application/json',
          },
        }
      )
      console.log('Photo uploaded successfully')
    } catch (err: any) {
      // If 404, it might be v1 API which doesn't need separate photo upload
      if (err.response?.status === 404) {
        console.log('Photo upload endpoint not found (likely using v1 API), skipping...')
      } else {
        throw err
      }
    }

    // Step 3: Start training (try both endpoints)
    let avatarId: string | null = null
    let status = 'training'
    
    const trainEndpoints = [
      { url: `${HEYGEN_V2_API_URL}/avatar_group/${groupId}/train`, version: 'v2' },
      { url: `${HEYGEN_V1_API_URL}/avatar/${groupId}/train`, version: 'v1' },
    ]
    
    for (const endpoint of trainEndpoints) {
      try {
        console.log(`Starting training with ${endpoint.version} API...`)
        const trainResponse = await axios.post(
          endpoint.url,
          {},
          {
            headers: {
              'Authorization': `Bearer ${getHeyGenKey()}`,
              'Content-Type': 'application/json',
            },
          }
        )

        avatarId = trainResponse.data?.data?.avatar_id || 
                   trainResponse.data?.avatar_id ||
                   trainResponse.data?.data?.id ||
                   trainResponse.data?.id ||
                   groupId
        status = trainResponse.data?.data?.status || 
                 trainResponse.data?.status || 
                 'training'
                 
        if (avatarId) {
          console.log(`Training started successfully with ${endpoint.version} API:`, avatarId)
          break
        }
      } catch (err: any) {
        console.log(`${endpoint.version} training endpoint failed:`, err.response?.status, err.response?.data)
        lastError = err
        continue
      }
    }

    if (!avatarId) {
      // If training failed, we still have the groupId, so return it
      avatarId = groupId
      status = 'pending'
      console.log('Training endpoints failed, using groupId as avatar_id')
    }

    return {
      avatar_id: avatarId,
      status,
    }
  } catch (error: any) {
    console.error('HeyGen API error (createAvatarFromPhoto):', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      photoUrlLength: photoUrl?.length,
      photoUrlType: photoUrl?.substring(0, 50),
    })
    
    let errorMessage = 'Failed to create avatar from photo'
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : JSON.stringify(error.response.data.error)
    } else if (error.message) {
      errorMessage = error.message
    }
    
    // Check if it's a base64 issue
    if (photoUrl?.startsWith('data:image')) {
      errorMessage += '. Note: HeyGen API may require a publicly accessible URL instead of base64 data. Please upload the image to a storage service first.'
    }
    
    throw new Error(errorMessage)
  }
}

export async function getVideoStatus(
  videoId: string
): Promise<HeyGenVideoResponse> {
  try {
    const response = await axios.get(
      `${HEYGEN_API_URL}/video_status.get`,
      {
        headers: {
          'Authorization': `Bearer ${getHeyGenKey()}`,
        },
        params: {
          video_id: videoId,
        },
      }
    )

    const data = response.data.data || response.data

    return {
      video_id: videoId,
      status: data.status,
      video_url: data.video_url || data.videoUrl || data.url,
      error: data.error || data.error_message,
    }
  } catch (error: any) {
    console.error('HeyGen API error (getVideoStatus):', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get video status'
    )
  }
}

