-- Migration: Add default_look_id column to avatars table
-- This stores the selected look ID for photo avatars with multiple looks

-- Add default_look_id column to avatars table
ALTER TABLE avatars ADD COLUMN IF NOT EXISTS default_look_id TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN avatars.default_look_id IS 'The HeyGen look ID to use for this avatar when generating videos. For photo avatars with multiple looks, this specifies which look variation to use.';

