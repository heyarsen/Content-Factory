-- Migration: User Customizable Categories & Preferences
-- Removes hardcoded category constraints and adds user preferences

-- Remove CHECK constraints on category fields
DO $$
BEGIN
  -- Remove constraint from video_plan_items.category
  ALTER TABLE video_plan_items DROP CONSTRAINT IF EXISTS video_plan_items_category_check;
  
  -- Remove constraint from content_items.category (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'content_items_category_check'
  ) THEN
    ALTER TABLE content_items DROP CONSTRAINT content_items_category_check;
  END IF;
  
  -- Remove constraint from reels.category (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'reels_category_check'
  ) THEN
    ALTER TABLE reels DROP CONSTRAINT reels_category_check;
  END IF;
END $$;

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT DEFAULT 'UTC',
  default_platforms TEXT[] DEFAULT ARRAY[]::TEXT[],
  notifications_enabled BOOLEAN DEFAULT true,
  auto_research_default BOOLEAN DEFAULT true,
  auto_approve_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;
CREATE POLICY "Users can delete own preferences" ON user_preferences 
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();
