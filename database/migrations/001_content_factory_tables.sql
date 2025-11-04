-- Content Factory Workflow Migration - New Tables
-- Run this SQL in your Supabase SQL Editor

-- Content items table (replaces Airtable "💡Контент")
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Trading', 'Lifestyle', 'Fin. Freedom')),
  research JSONB,
  done BOOLEAN NOT NULL DEFAULT false,
  status TEXT,
  keywords TEXT[],
  action TEXT,
  start TEXT,
  tone_style TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reels table (replaces "🌐 Соцсети рилсы")
CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Trading', 'Lifestyle', 'Fin. Freedom')),
  description TEXT,
  why_it_matters TEXT,
  useful_tips TEXT,
  script TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  template TEXT,
  instagram BOOLEAN DEFAULT false,
  youtube BOOLEAN DEFAULT false,
  pix TEXT,
  video_url TEXT,
  heygen_video_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Background jobs table (Supabase-based queue system)
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content research table (optional, for research history)
CREATE TABLE IF NOT EXISTS content_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  research_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_items_user_id ON content_items(user_id);
CREATE INDEX IF NOT EXISTS idx_content_items_done ON content_items(user_id, done) WHERE done = false;
CREATE INDEX IF NOT EXISTS idx_content_items_category ON content_items(category);
CREATE INDEX IF NOT EXISTS idx_reels_user_id ON reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_status ON reels(status);
CREATE INDEX IF NOT EXISTS idx_reels_scheduled_time ON reels(scheduled_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reels_content_item_id ON reels(content_item_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled_at ON background_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_content_research_content_item_id ON content_research(content_item_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reels_updated_at BEFORE UPDATE ON reels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_background_jobs_updated_at BEFORE UPDATE ON background_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_research ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_items
DROP POLICY IF EXISTS "Users can view own content items" ON content_items;
CREATE POLICY "Users can view own content items" ON content_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own content items" ON content_items;
CREATE POLICY "Users can insert own content items" ON content_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own content items" ON content_items;
CREATE POLICY "Users can update own content items" ON content_items FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own content items" ON content_items;
CREATE POLICY "Users can delete own content items" ON content_items FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for reels
DROP POLICY IF EXISTS "Users can view own reels" ON reels;
CREATE POLICY "Users can view own reels" ON reels FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own reels" ON reels;
CREATE POLICY "Users can insert own reels" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reels" ON reels;
CREATE POLICY "Users can update own reels" ON reels FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own reels" ON reels;
CREATE POLICY "Users can delete own reels" ON reels FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for background_jobs (system access only, no user-specific policies needed)
-- Note: Background jobs are system-level, but we'll restrict access to service role
DROP POLICY IF EXISTS "Service role can manage background jobs" ON background_jobs;
CREATE POLICY "Service role can manage background jobs" ON background_jobs FOR ALL USING (true);

-- RLS Policies for content_research
DROP POLICY IF EXISTS "Users can view own content research" ON content_research;
CREATE POLICY "Users can view own content research" ON content_research FOR SELECT USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_research.content_item_id AND content_items.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert own content research" ON content_research;
CREATE POLICY "Users can insert own content research" ON content_research FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_research.content_item_id AND content_items.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete own content research" ON content_research;
CREATE POLICY "Users can delete own content research" ON content_research FOR DELETE USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_research.content_item_id AND content_items.user_id = auth.uid())
);

