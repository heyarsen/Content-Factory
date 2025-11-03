export interface Video {
  id: string
  user_id: string
  topic: string
  script: string | null
  style: 'casual' | 'professional' | 'energetic' | 'educational'
  duration: number
  status: 'pending' | 'generating' | 'completed' | 'failed'
  heygen_video_id: string | null
  video_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  id: string
  user_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  platform_account_id: string
  access_token: string | null
  refresh_token: string | null
  status: 'connected' | 'disconnected' | 'error'
  connected_at: string
}

export interface ScheduledPost {
  id: string
  video_id: string
  user_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  scheduled_time: string | null
  status: 'pending' | 'posted' | 'failed' | 'cancelled'
  upload_post_id: string | null
  posted_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

