import api from './api'

export type VideoStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface VideoRecord {
  id: string
  topic: string
  script: string | null
  style: 'casual' | 'professional' | 'energetic' | 'educational'
  duration: number
  status: VideoStatus
  video_url: string | null
  error_message: string | null
  heygen_video_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateVideoPayload {
  topic: string
  script?: string
  style: VideoRecord['style']
  duration: number
}

export interface ListVideosParams {
  status?: VideoStatus | 'all'
  search?: string
}

export async function createVideo(payload: CreateVideoPayload): Promise<VideoRecord> {
  const { data } = await api.post('/api/videos/generate', payload)
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

