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
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()
    
    // Try v2 API first (photo avatars) - based on official docs
    // https://docs.heygen.com/docs/create-videos-with-photo-avatars
    const endpoints = [
      // v2 API - List avatar groups, then get avatars from each group
      { 
        type: 'v2-groups',
        method: 'GET' as const, 
        url: `${HEYGEN_V2_API_URL}/avatar_group.list`,
        useXApiKey: true,
      },
      // Fallback to v1 API endpoints
      { 
        type: 'v1-list',
        method: 'POST' as const, 
        url: `${HEYGEN_API_URL}/avatar.list`,
        useXApiKey: false,
      },
      { 
        type: 'v1-get',
        method: 'GET' as const, 
        url: `${HEYGEN_API_URL}/avatars`,
        useXApiKey: false,
      },
    ]

    let lastError: any = null
    for (const endpoint of endpoints) {
      try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        
        // Use X-Api-Key header for v2 API, Bearer for v1
        if (endpoint.useXApiKey) {
          headers['X-Api-Key'] = apiKey
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`
        }

        const requestConfig = { headers }

        const response = endpoint.method === 'POST'
          ? await axios.post(endpoint.url, {}, requestConfig)
          : await axios.get(endpoint.url, requestConfig)

        console.log(`HeyGen API response from ${endpoint.url} (${endpoint.type}):`, {
          status: response.status,
          dataKeys: response.data ? Object.keys(response.data) : [],
          hasData: !!response.data?.data,
          hasAvatarGroupList: !!response.data?.data?.avatar_group_list,
        })

        // Handle v2 API response structure (avatar groups)
        if (endpoint.type === 'v2-groups' && response.data?.data?.avatar_group_list) {
          const groups = response.data.data.avatar_group_list
          console.log(`Found ${groups.length} avatar groups`)
          
          // Fetch avatars from each group
          const allAvatars: any[] = []
          for (const group of groups) {
            try {
              const avatarsResponse = await axios.get(
                `${HEYGEN_V2_API_URL}/avatar_group/${group.id}/avatars`,
                { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } }
              )
              
              if (avatarsResponse.data?.data?.avatar_list) {
                const groupAvatars = avatarsResponse.data.data.avatar_list.map((avatar: any) => ({
                  avatar_id: avatar.id,
                  avatar_name: avatar.name || group.name || 'Unnamed Avatar',
                  avatar_url: avatar.image_url,
                  preview_url: avatar.image_url,
                  thumbnail_url: avatar.image_url,
                  gender: null,
                  status: avatar.status === 'completed' ? 'active' : avatar.status || 'active',
                  group_id: group.id,
                  group_name: group.name,
                }))
                allAvatars.push(...groupAvatars)
              }
            } catch (groupErr: any) {
              console.log(`Failed to fetch avatars from group ${group.id}:`, groupErr.response?.status)
            }
          }
          
          if (allAvatars.length > 0) {
            console.log(`Successfully fetched ${allAvatars.length} avatars from v2 API`)
            return { avatars: allAvatars }
          }
        }

        // Handle v1 API response structures
        let avatars: any[] = []
        
        if (response.data?.data?.avatars && Array.isArray(response.data.data.avatars)) {
          avatars = response.data.data.avatars
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          avatars = response.data.data
        } else if (response.data?.avatars && Array.isArray(response.data.avatars)) {
          avatars = response.data.avatars
        } else if (Array.isArray(response.data)) {
          avatars = response.data
        }

        if (avatars.length > 0) {
          console.log(`Successfully fetched ${avatars.length} avatars from ${endpoint.url} (${endpoint.type})`)
          // Normalize avatar data structure
          const normalizedAvatars = avatars.map((avatar: any) => ({
            avatar_id: avatar.avatar_id || avatar.id || avatar.avatarId,
            avatar_name: avatar.avatar_name || avatar.name || avatar.avatarName || 'Unnamed Avatar',
            avatar_url: avatar.avatar_url || avatar.url || avatar.avatarUrl || avatar.image_url,
            preview_url: avatar.preview_url || avatar.previewUrl || avatar.preview || avatar.image_url,
            thumbnail_url: avatar.thumbnail_url || avatar.thumbnailUrl || avatar.thumbnail || avatar.image_url,
            gender: avatar.gender,
            status: avatar.status || 'active',
          }))
          return { avatars: normalizedAvatars }
        }
        
        // Log unexpected structure for debugging
        console.log(`Unexpected response structure from ${endpoint.url}:`, JSON.stringify(response.data, null, 2).substring(0, 500))
      } catch (err: any) {
        // Log but continue trying other endpoints
        console.log(`Tried ${endpoint.url} (${endpoint.type}), got status ${err.response?.status}:`, err.response?.data || err.message)
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
/**
 * Upload image to HeyGen Asset Storage
 * Returns the image_key needed for avatar group creation
 * Based on HeyGen docs: https://docs.heygen.com/docs/create-and-train-photo-avatar-groups
 */
async function uploadImageToHeyGen(photoUrl: string): Promise<string> {
  const apiKey = getHeyGenKey()
  const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
  
  // First, download the image from the URL to get the buffer
  let imageBuffer: Buffer
  let contentType: string = 'image/jpeg'
  
  try {
    if (photoUrl.startsWith('data:')) {
      // Handle base64 data URL
      const base64Data = photoUrl.split(',')[1]
      imageBuffer = Buffer.from(base64Data, 'base64')
      const mimeMatch = photoUrl.match(/data:([^;]+)/)
      if (mimeMatch) {
        contentType = mimeMatch[1]
      }
    } else {
      // Download from URL
      const imageResponse = await axios.get(photoUrl, { 
        responseType: 'arraybuffer',
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
      })
      imageBuffer = Buffer.from(imageResponse.data)
      contentType = imageResponse.headers['content-type'] || 'image/jpeg'
    }
  } catch (err: any) {
    throw new Error(`Failed to download image: ${err.message}`)
  }
  
  // Try different upload endpoints
  const uploadEndpoints = [
    { url: `${HEYGEN_V2_API_URL}/asset/upload`, method: 'multipart' },
    { url: `${HEYGEN_V2_API_URL}/asset/upload`, method: 'url' },
    { url: `${HEYGEN_V2_API_URL}/upload`, method: 'multipart' },
  ]
  
  // Try uploading to HeyGen
  for (const endpoint of uploadEndpoints) {
    try {
      console.log(`Trying to upload image to ${endpoint.url} (method: ${endpoint.method})...`)
      
      if (endpoint.method === 'url') {
        // Try URL-based upload (if HeyGen accepts URLs)
        const urlUploadResponse = await axios.post(
          endpoint.url,
          { url: photoUrl },
          {
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json',
            },
          }
        )
        
        const imageKey = urlUploadResponse.data?.data?.image_key || 
                        urlUploadResponse.data?.image_key ||
                        urlUploadResponse.data?.data?.key ||
                        urlUploadResponse.data?.key
        
        if (imageKey) {
          console.log(`Successfully uploaded image via URL, got image_key: ${imageKey}`)
          return imageKey
        }
      } else {
        // Try multipart/form-data upload using FormData
        // Since we're in Node.js, we'll use a simple approach with axios
        const FormData = (await import('form-data')).default
        const form = new FormData()
        form.append('file', imageBuffer, {
          filename: 'avatar.jpg',
          contentType: contentType,
        })
        
        const uploadResponse = await axios.post(endpoint.url, form, {
          headers: {
            'X-Api-Key': apiKey,
            ...form.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        })
        
        // Extract image_key from response
        const imageKey = uploadResponse.data?.data?.image_key || 
                        uploadResponse.data?.image_key ||
                        uploadResponse.data?.data?.key ||
                        uploadResponse.data?.key
        
        if (imageKey) {
          console.log(`Successfully uploaded image, got image_key: ${imageKey}`)
          return imageKey
        }
      }
    } catch (err: any) {
      console.log(`Upload to ${endpoint.url} (${endpoint.method}) failed:`, {
        status: err.response?.status,
        statusText: err.response?.statusText,
        error: err.response?.data?.error || err.message,
      })
      
      // Continue to next endpoint
      continue
    }
  }
  
  throw new Error(
    'Failed to upload image to HeyGen. All upload endpoints failed. ' +
    'Please ensure the image URL is publicly accessible. ' +
    'You may need to check HeyGen API documentation for the correct Upload Asset endpoint.'
  )
}

export async function createAvatarFromPhoto(
  photoUrl: string,
  avatarName: string
): Promise<{ avatar_id: string; status: string }> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()
    
    // Step 1: Upload image to HeyGen and get image_key
    console.log('Step 1: Uploading image to HeyGen...')
    let imageKey: string
    try {
      imageKey = await uploadImageToHeyGen(photoUrl)
    } catch (uploadError: any) {
      throw new Error(
        `Failed to upload image to HeyGen: ${uploadError.message}. ` +
        `Please ensure the image URL is publicly accessible or try uploading manually in the HeyGen dashboard.`
      )
    }
    
    // Step 2: Create avatar group using image_key
    // Based on https://docs.heygen.com/docs/create-and-train-photo-avatar-groups
    console.log('Step 2: Creating avatar group with image_key...')
    const createGroupResponse = await axios.post(
      `${HEYGEN_V2_API_URL}/photo_avatar/avatar_group/create`,
      {
        name: avatarName,
        image_key: imageKey,
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )
    
    console.log('Avatar group creation response:', createGroupResponse.data)
    
    const groupId = createGroupResponse.data?.data?.id || 
                   createGroupResponse.data?.data?.group_id ||
                   createGroupResponse.data?.id ||
                   createGroupResponse.data?.group_id
    
    if (!groupId) {
      throw new Error('Failed to get group_id from avatar group creation response')
    }
    
    console.log(`Successfully created avatar group: ${groupId}`)
    
    // Step 3: Train the avatar group (optional but recommended)
    let status = 'pending'
    try {
      console.log('Step 3: Starting avatar group training...')
      const trainResponse = await axios.post(
        `${HEYGEN_V2_API_URL}/photo_avatar/train`,
        {
          group_id: groupId,
        },
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      )
      
      console.log('Training started:', trainResponse.data)
      status = 'training'
    } catch (trainErr: any) {
      console.log('Training failed (this is optional):', trainErr.response?.status, trainErr.response?.data)
      // Training is optional, so we continue even if it fails
    }

    return {
      avatar_id: groupId,
      status,
    }
  } catch (error: any) {
    console.error('HeyGen API error (createAvatarFromPhoto):', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    })
    
    let errorMessage = 'Failed to create avatar from photo'
    if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : JSON.stringify(error.response.data.error)
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
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

