export type SoraAspectRatio = '16:9' | '9:16'

export type SoraModel = 'sora-2' | 'sora-2-private' | 'sora-2-stable'

export interface CreateSoraTaskRequest {
  model: SoraModel
  callback_url?: string
  input: {
    prompt: string
    image_urls?: string[]
    duration: 10 | 15
    aspect_ratio: SoraAspectRatio
    style?:
      | 'thanksgiving'
      | 'comic'
      | 'news'
      | 'selfie'
      | 'nostalgic'
      | 'anime'
    storyboard?: boolean
  }
}

export interface CreateSoraTaskResponse {
  code: number
  data: {
    task_id: string
    status: 'not_started'
    created_time: string
  }
  message?: string
}

export interface SoraTaskDetail {
  code: number
  data: {
    task_id: string
    status: 'not_started' | 'in_progress' | 'finished' | 'failed'
    created_time?: string
    output?: {
      video_url?: string
      url?: string
      urls?: string[]
    }
    result?: {
      video_url?: string
      url?: string
      urls?: string[]
    }
    video_url?: string
    video_urls?: string[]
    error?: {
      message?: string
    }
  }
  error?: {
    message?: string
    type?: string
  }
  message?: string
}

export function mapAspectRatioToSora(aspectRatio?: string | null): SoraAspectRatio {
  if (!aspectRatio) return '9:16'

  if (aspectRatio === '9:16' || aspectRatio === 'vertical' || aspectRatio === 'portrait') return '9:16'
  if (aspectRatio === '16:9' || aspectRatio === 'horizontal' || aspectRatio === 'landscape') return '16:9'

  return '9:16'
}

export function calculateDurationFromSeconds(durationSeconds: number): 10 | 15 {
  if (durationSeconds >= 15) return 15
  return 10
}

export function extractVideoUrl(taskDetail: SoraTaskDetail): string | null {
  const candidates: Array<string | undefined> = [
    taskDetail.data.video_url,
    taskDetail.data.output?.video_url,
    taskDetail.data.result?.video_url,
    taskDetail.data.output?.url,
    taskDetail.data.result?.url,
  ]

  for (const candidate of candidates) {
    if (candidate) return candidate
  }

  const listCandidates = [
    taskDetail.data.video_urls?.[0],
    taskDetail.data.output?.urls?.[0],
    taskDetail.data.result?.urls?.[0],
  ]

  for (const candidate of listCandidates) {
    if (candidate) return candidate
  }

  return null
}
