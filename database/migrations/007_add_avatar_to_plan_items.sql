-- Migration: Add avatar_id to video_plan_items
-- Allows each plan item to have its own avatar for video generation

-- Add avatar_id column to video_plan_items if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_plan_items' 
    AND column_name = 'avatar_id'
  ) THEN
    ALTER TABLE video_plan_items 
    ADD COLUMN avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_video_plan_items_avatar_id 
    ON video_plan_items(avatar_id);
  END IF;
END $$;

