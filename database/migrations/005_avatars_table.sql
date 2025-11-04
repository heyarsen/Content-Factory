-- Migration: Avatars Table
-- Stores user avatar preferences and custom HeyGen avatar information

-- Create avatars table
CREATE TABLE IF NOT EXISTS avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  heygen_avatar_id TEXT NOT NULL,
  avatar_name TEXT NOT NULL,
  avatar_url TEXT,
  preview_url TEXT,
  thumbnail_url TEXT,
  gender TEXT,
  status TEXT DEFAULT 'active',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, heygen_avatar_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_avatars_user_id ON avatars(user_id);
CREATE INDEX IF NOT EXISTS idx_avatars_user_default ON avatars(user_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;

-- RLS Policies for avatars
DROP POLICY IF EXISTS "Users can view own avatars" ON avatars;
CREATE POLICY "Users can view own avatars" ON avatars 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own avatars" ON avatars;
CREATE POLICY "Users can insert own avatars" ON avatars 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own avatars" ON avatars;
CREATE POLICY "Users can update own avatars" ON avatars 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own avatars" ON avatars;
CREATE POLICY "Users can delete own avatars" ON avatars 
  FOR DELETE USING (auth.uid() = user_id);

-- Function to ensure only one default avatar per user
CREATE OR REPLACE FUNCTION ensure_single_default_avatar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default avatars for this user
    UPDATE avatars 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to ensure single default avatar
CREATE TRIGGER ensure_single_default_avatar_trigger
  BEFORE INSERT OR UPDATE ON avatars
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_avatar();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_avatars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_avatars_updated_at 
  BEFORE UPDATE ON avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_avatars_updated_at();

-- Add avatar_id to videos table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'videos' 
    AND column_name = 'avatar_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_videos_avatar_id ON videos(avatar_id);
  END IF;
END $$;
