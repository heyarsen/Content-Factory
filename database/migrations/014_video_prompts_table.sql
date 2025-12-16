-- Migration: Add video_prompts table for user-created video prompt templates
-- Allows users to create reusable prompts that can be used in video planning

CREATE TABLE IF NOT EXISTS video_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  topic TEXT,
  category TEXT,
  description TEXT,
  why_important TEXT,
  useful_tips TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_prompts_user_id ON video_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_video_prompts_created_at ON video_prompts(user_id, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_video_prompts_updated_at BEFORE UPDATE ON video_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE video_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own prompts"
  ON video_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prompts"
  ON video_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts"
  ON video_prompts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
  ON video_prompts FOR DELETE
  USING (auth.uid() = user_id);

