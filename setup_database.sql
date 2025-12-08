-- Content Factory Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  script TEXT,
  style TEXT NOT NULL CHECK (style IN ('casual', 'professional', 'energetic', 'educational')),
  duration INTEGER NOT NULL CHECK (duration >= 15 AND duration <= 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  heygen_video_id TEXT,
  video_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social accounts table
-- Supported platforms according to Upload-Post API: instagram, tiktok, youtube, facebook, x (Twitter), linkedin, pinterest, threads
-- Note: snapchat is NOT supported by Upload-Post API
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'threads')),
  platform_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'error')),
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Scheduled posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'threads')),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
  upload_post_id TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_video_id ON scheduled_posts(video_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);

-- Content categories table
CREATE TABLE IF NOT EXISTS content_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, category_key)
);

-- Prompt templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('ideas', 'research', 'script')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  lang TEXT NOT NULL DEFAULT 'english',
  persona TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, template_key),
  UNIQUE (user_id, template_type)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_content_categories_user_id ON content_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_status ON content_categories(status);
CREATE INDEX IF NOT EXISTS idx_content_categories_order ON content_categories(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_type ON prompt_templates(template_type);

-- Video plans table for daily video planning
CREATE TABLE IF NOT EXISTS video_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  videos_per_day INTEGER NOT NULL DEFAULT 3 CHECK (videos_per_day > 0 AND videos_per_day <= 10),
  start_date DATE NOT NULL,
  end_date DATE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_research BOOLEAN NOT NULL DEFAULT true,
  auto_create BOOLEAN NOT NULL DEFAULT false,
  auto_schedule_trigger TEXT DEFAULT 'daily' CHECK (auto_schedule_trigger IN ('daily', 'time_based', 'manual')),
  trigger_time TIME,
  default_platforms TEXT[],
  auto_approve BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video plan items - individual video slots in a plan
CREATE TABLE IF NOT EXISTS video_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES video_plans(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  topic TEXT,
  category TEXT CHECK (category IN ('Trading', 'Lifestyle', 'Fin. Freedom')),
  description TEXT,
  why_important TEXT,
  useful_tips TEXT,
  research_data JSONB,
  script TEXT,
  script_status TEXT CHECK (script_status IN ('draft', 'approved', 'rejected')),
  platforms TEXT[],
  caption TEXT,
  talking_photo_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'researching', 'ready', 'draft', 'approved', 'generating', 'completed', 'scheduled', 'posted', 'failed')),
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for video plans
CREATE INDEX IF NOT EXISTS idx_video_plans_user_id ON video_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_video_plans_enabled ON video_plans(enabled);
CREATE INDEX IF NOT EXISTS idx_video_plan_items_plan_id ON video_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_video_plan_items_scheduled_date ON video_plan_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_video_plan_items_status ON video_plan_items(status);

-- Enable Row Level Security (RLS)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos
DROP POLICY IF EXISTS "Users can view own videos" ON videos;
CREATE POLICY "Users can view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;
CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own videos" ON videos;
CREATE POLICY "Users can update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own videos" ON videos;
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for social_accounts
DROP POLICY IF EXISTS "Users can view own social accounts" ON social_accounts;
CREATE POLICY "Users can view own social accounts" ON social_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own social accounts" ON social_accounts;
CREATE POLICY "Users can insert own social accounts" ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own social accounts" ON social_accounts;
CREATE POLICY "Users can update own social accounts" ON social_accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own social accounts" ON social_accounts;
CREATE POLICY "Users can delete own social accounts" ON social_accounts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for scheduled_posts
DROP POLICY IF EXISTS "Users can view own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can view own scheduled posts" ON scheduled_posts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can insert own scheduled posts" ON scheduled_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can update own scheduled posts" ON scheduled_posts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can delete own scheduled posts" ON scheduled_posts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for content_categories
DROP POLICY IF EXISTS "Users can view own content categories" ON content_categories;
CREATE POLICY "Users can view own content categories" ON content_categories FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own content categories" ON content_categories;
CREATE POLICY "Users can insert own content categories" ON content_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own content categories" ON content_categories;
CREATE POLICY "Users can update own content categories" ON content_categories FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own content categories" ON content_categories;
CREATE POLICY "Users can delete own content categories" ON content_categories FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for prompt_templates
DROP POLICY IF EXISTS "Users can view own prompt templates" ON prompt_templates;
CREATE POLICY "Users can view own prompt templates" ON prompt_templates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own prompt templates" ON prompt_templates;
CREATE POLICY "Users can insert own prompt templates" ON prompt_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own prompt templates" ON prompt_templates;
CREATE POLICY "Users can update own prompt templates" ON prompt_templates FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own prompt templates" ON prompt_templates;
CREATE POLICY "Users can delete own prompt templates" ON prompt_templates FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for video_plans
DROP POLICY IF EXISTS "Users can view own video plans" ON video_plans;
CREATE POLICY "Users can view own video plans" ON video_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own video plans" ON video_plans;
CREATE POLICY "Users can insert own video plans" ON video_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own video plans" ON video_plans;
CREATE POLICY "Users can update own video plans" ON video_plans FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own video plans" ON video_plans;
CREATE POLICY "Users can delete own video plans" ON video_plans FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for video_plan_items
DROP POLICY IF EXISTS "Users can view own video plan items" ON video_plan_items;
CREATE POLICY "Users can view own video plan items" ON video_plan_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own video plan items" ON video_plan_items;
CREATE POLICY "Users can insert own video plan items" ON video_plan_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own video plan items" ON video_plan_items;
CREATE POLICY "Users can update own video plan items" ON video_plan_items FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own video plan items" ON video_plan_items;
CREATE POLICY "Users can delete own video plan items" ON video_plan_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
