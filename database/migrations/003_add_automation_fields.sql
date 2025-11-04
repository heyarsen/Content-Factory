-- Migration: Add Automation Fields to Video Plans
-- Adds automation fields to existing video_plans and video_plan_items tables

-- Add automation fields to video_plans if they don't exist
DO $$
BEGIN
  -- Add auto_schedule_trigger
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plans' 
    AND column_name = 'auto_schedule_trigger'
  ) THEN
    ALTER TABLE video_plans ADD COLUMN auto_schedule_trigger TEXT DEFAULT 'daily' CHECK (auto_schedule_trigger IN ('daily', 'time_based', 'manual'));
  END IF;

  -- Add trigger_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plans' 
    AND column_name = 'trigger_time'
  ) THEN
    ALTER TABLE video_plans ADD COLUMN trigger_time TIME DEFAULT '09:00:00';
  END IF;

  -- Add default_platforms
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plans' 
    AND column_name = 'default_platforms'
  ) THEN
    ALTER TABLE video_plans ADD COLUMN default_platforms TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Add auto_approve
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plans' 
    AND column_name = 'auto_approve'
  ) THEN
    ALTER TABLE video_plans ADD COLUMN auto_approve BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Add timezone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plans' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE video_plans ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;
END $$;

-- Add automation fields to video_plan_items if they don't exist
DO $$
BEGIN
  -- Add script
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plan_items' 
    AND column_name = 'script'
  ) THEN
    ALTER TABLE video_plan_items ADD COLUMN script TEXT;
  END IF;

  -- Add script_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plan_items' 
    AND column_name = 'script_status'
  ) THEN
    ALTER TABLE video_plan_items ADD COLUMN script_status TEXT CHECK (script_status IN ('draft', 'approved', 'rejected'));
  END IF;

  -- Add platforms
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plan_items' 
    AND column_name = 'platforms'
  ) THEN
    ALTER TABLE video_plan_items ADD COLUMN platforms TEXT[];
  END IF;

  -- Add caption
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_plan_items' 
    AND column_name = 'caption'
  ) THEN
    ALTER TABLE video_plan_items ADD COLUMN caption TEXT;
  END IF;
END $$;

-- Update status constraint to include new statuses
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE video_plan_items DROP CONSTRAINT IF EXISTS video_plan_items_status_check;
  
  -- Add new constraint with all statuses
  ALTER TABLE video_plan_items ADD CONSTRAINT video_plan_items_status_check 
    CHECK (status IN ('pending', 'researching', 'ready', 'draft', 'approved', 'generating', 'completed', 'scheduled', 'posted', 'failed'));
END $$;

-- Add additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_plans_trigger_time ON video_plans(auto_schedule_trigger, trigger_time) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_video_plan_items_script_status ON video_plan_items(script_status) WHERE script_status = 'draft';
CREATE INDEX IF NOT EXISTS idx_video_plan_items_scheduled_datetime ON video_plan_items(scheduled_date, scheduled_time) WHERE status IN ('completed', 'scheduled');
