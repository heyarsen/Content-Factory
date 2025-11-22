-- Migration: Add default_look_id to avatars table
-- Allows users to select which look/avatar from a group to use for video generation

-- Add default_look_id column to avatars table
ALTER TABLE avatars 
ADD COLUMN IF NOT EXISTS default_look_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_avatars_default_look_id ON avatars(default_look_id) WHERE default_look_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN avatars.default_look_id IS 'The specific look/avatar ID from the HeyGen avatar group to use for video generation. If null, the first available look will be used.';

