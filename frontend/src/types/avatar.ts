// Shared avatar types
export interface Avatar {
  id: string
  heygen_avatar_id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
  gender: string | null
  status: string
  is_default: boolean
  created_at: string
  source?: 'synced' | 'user_photo' | 'ai_generated' | null
  categories?: string[] | null
  has_motion?: boolean
}

export interface PhotoAvatarLook {
  id: string
  name?: string
  status?: string
  image_url?: string
  preview_url?: string
  thumbnail_url?: string
  created_at?: number
  updated_at?: number | null
  is_default?: boolean
  has_motion?: boolean
  motion_source_id?: string | null
  motion_pending?: boolean
}

export type PanelType = 'avatar-details' | 'look-details' | 'create-avatar' | 'generate-look' | null
