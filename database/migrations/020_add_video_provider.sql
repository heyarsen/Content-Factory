-- Migration: Add Sora provider support to videos table
-- Description: Adds provider and sora_task_id columns to support multiple video generation providers

-- Add provider column (defaults to 'heygen' for backward compatibility)
ALTER TABLE videos 
ADD COLUMN provider TEXT DEFAULT 'heygen' CHECK (provider IN ('heygen', 'sora'));

-- Add sora_task_id column to store KIE Sora task ID
ALTER TABLE videos 
ADD COLUMN sora_task_id TEXT;

-- Create indexes for better query performance
CREATE INDEX idx_videos_provider ON videos(provider);
CREATE INDEX idx_videos_sora_task_id ON videos(sora_task_id);

-- Add comment for documentation
COMMENT ON COLUMN videos.provider IS 'Video generation provider: heygen or sora';
COMMENT ON COLUMN videos.sora_task_id IS 'KIE Sora task ID for tracking video generation status';
