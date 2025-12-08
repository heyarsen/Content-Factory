-- Migration: Add talking_photo_id column to video_plan_items
-- Ensures each scheduled plan item can store the exact look (talking_photo_id) selected by the user

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_plan_items'
      AND column_name = 'talking_photo_id'
  ) THEN
    ALTER TABLE video_plan_items
      ADD COLUMN talking_photo_id TEXT;
  END IF;
END $$;
