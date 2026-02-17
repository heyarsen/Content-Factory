export interface Video {
  id: string
  user_id: string
  topic: string
  script: string | null
  style: string
  duration: number
  status: 'pending' | 'generating' | 'completed' | 'failed'
  provider?: 'heygen' | 'sora'
  heygen_video_id: string | null
  sora_task_id?: string | null
  sora_provider?: 'kie' | 'poyo' | null
  sora_model?: 'sora-2' | 'sora-2-private' | 'sora-2-stable' | null
  video_url: string | null
  avatar_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  id: string
  user_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'x' | 'linkedin' | 'threads'
  platform_account_id: string
  access_token: string | null
  refresh_token: string | null
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  connected_at: string
}

export interface ScheduledPost {
  id: string
  video_id: string
  user_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'x' | 'linkedin' | 'threads'
  scheduled_time: string | null
  status: 'pending' | 'posted' | 'failed' | 'cancelled'
  upload_post_id: string | null
  posted_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ContentCategory {
  id: string
  user_id: string
  category_key: string
  name: string
  status: 'active' | 'inactive'
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PromptTemplate {
  id: string
  user_id: string
  template_key: string
  template_type: 'ideas' | 'research' | 'script'
  status: 'active' | 'inactive'
  lang: string
  persona: string | null
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ContentItem {
  id: string
  user_id: string
  topic: string
  category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'
  research: Record<string, any> | null
  done: boolean
  status: string | null
  keywords: string[] | null
  action: string | null
  start: string | null
  tone_style: string | null
  created_at: string
  updated_at: string
}

export interface Reel {
  id: string
  content_item_id: string | null
  user_id: string
  topic: string
  category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'
  description: string | null
  why_it_matters: string | null
  useful_tips: string | null
  script: string | null
  status: 'pending' | 'approved' | 'rejected'
  scheduled_time: string | null
  template: string | null
  instagram: boolean
  youtube: boolean
  pix: string | null
  video_url: string | null
  heygen_video_id: string | null
  created_at: string
  updated_at: string
}

export interface BackgroundJob {
  id: string
  job_type: string
  payload: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  scheduled_at: string
  attempts: number
  max_attempts: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ContentResearch {
  id: string
  content_item_id: string
  research_data: Record<string, any>
  created_at: string
}
