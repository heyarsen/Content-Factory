-- Migration: Add avatar source column to track origin (synced vs user-generated)

ALTER TABLE avatars
  ADD COLUMN IF NOT EXISTS source TEXT
  CHECK (source IN ('synced', 'user_photo', 'ai_generated'))
  DEFAULT 'synced';

-- Backfill existing rows so previously uploaded avatars remain visible
UPDATE avatars
SET source = CASE
  WHEN source IS NOT NULL THEN source
  WHEN avatar_url ILIKE '%supabase.co/storage%' THEN 'user_photo'
  WHEN status IN ('generating', 'training', 'pending') THEN 'user_photo'
  ELSE 'synced'
END;

CREATE INDEX IF NOT EXISTS idx_avatars_source ON avatars(source);
