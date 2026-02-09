import api from './api'

export type VideoStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface VideoRecord {
  id: string
  topic: string
  script: string | null
  style: 'casual' | 'professional' | 'energetic' | 'educational'
  duration: number
  status: VideoStatus
  provider?: 'sora'
  caption: string | null
  video_url: string | null
  error_message: string | null
  sora_task_id?: string | null
  created_at: string
  updated_at: string
  progress?: number
}

export interface CreateVideoPayload {
  topic: string
  script?: string
  style: VideoRecord['style']
  duration: number
  provider?: 'sora'
  aspect_ratio?: string
  dimension?: {
    width: number
    height: number
  }
}

export interface ListVideosParams {
  status?: VideoStatus | 'all'
  search?: string
}

export const DEFAULT_VERTICAL_DIMENSION = { width: 1080, height: 1920 }
export const DEFAULT_VERTICAL_ASPECT_RATIO = '9:16'

export async function createVideo(payload: CreateVideoPayload): Promise<VideoRecord> {
  const aspectRatio = payload.aspect_ratio || DEFAULT_VERTICAL_ASPECT_RATIO
  const dimension =
    payload.dimension ||
    (aspectRatio === DEFAULT_VERTICAL_ASPECT_RATIO ? { ...DEFAULT_VERTICAL_DIMENSION } : undefined)

  const { data } = await api.post('/api/videos/generate', {
    ...payload,
    aspect_ratio: aspectRatio,
    ...(dimension ? { dimension } : {}),
  })
  return data.video as VideoRecord
}

export async function listVideos(params: ListVideosParams = {}): Promise<VideoRecord[]> {
  const { data } = await api.get('/api/videos', {
    params: {
      ...params,
    },
  })

  return (data?.videos ?? []) as VideoRecord[]
}

export async function getVideo(id: string): Promise<VideoRecord> {
  const { data } = await api.get(`/api/videos/${id}`)
  return data.video as VideoRecord
}

export async function refreshVideoStatus(id: string): Promise<VideoRecord> {
  const { data } = await api.get(`/api/videos/${id}/status`)
  return data.video as VideoRecord
}

export async function deleteVideo(id: string): Promise<void> {
  await api.delete(`/api/videos/${id}`)
}

export async function retryVideo(id: string): Promise<void> {
  await api.post(`/api/videos/${id}/retry`)
}

export async function getSharableVideoUrl(id: string): Promise<{ share_url: string }> {
  const { data } = await api.post(`/api/videos/${id}/share`)
  return data
}

export async function generateDescription(id: string, topic?: string, script?: string): Promise<{ description: string }> {
  const { data } = await api.post(`/api/videos/${id}/generate-description`, { topic, script })
  return data
}
