-- Migration: Video Plans Tables
-- Adds video planning functionality for automated video pipeline

-- Create video_plans table if it doesn't exist
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
  trigger_time TIME DEFAULT '09:00:00',
  default_platforms TEXT[] DEFAULT ARRAY[]::TEXT[],
  auto_approve BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create video_plan_items table if it doesn't exist
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'researching', 'ready', 'draft', 'approved', 'generating', 'completed', 'scheduled', 'posted', 'failed')),
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_plans_user_id ON video_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_video_plans_enabled ON video_plans(enabled);
CREATE INDEX IF NOT EXISTS idx_video_plans_trigger_time ON video_plans(auto_schedule_trigger, trigger_time) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_video_plan_items_plan_id ON video_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_video_plan_items_scheduled_date ON video_plan_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_video_plan_items_status ON video_plan_items(status);
CREATE INDEX IF NOT EXISTS idx_video_plan_items_script_status ON video_plan_items(script_status) WHERE script_status = 'draft';
CREATE INDEX IF NOT EXISTS idx_video_plan_items_scheduled_datetime ON video_plan_items(scheduled_date, scheduled_time) WHERE status IN ('completed', 'scheduled');

-- Enable Row Level Security
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'video_plans'
  ) THEN
    ALTER TABLE video_plans ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'video_plan_items'
  ) THEN
    ALTER TABLE video_plan_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for video_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plans' AND policyname = 'Users can view own video plans'
  ) THEN
    CREATE POLICY "Users can view own video plans" ON video_plans FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plans' AND policyname = 'Users can insert own video plans'
  ) THEN
    CREATE POLICY "Users can insert own video plans" ON video_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plans' AND policyname = 'Users can update own video plans'
  ) THEN
    CREATE POLICY "Users can update own video plans" ON video_plans FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plans' AND policyname = 'Users can delete own video plans'
  ) THEN
    CREATE POLICY "Users can delete own video plans" ON video_plans FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS Policies for video_plan_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plan_items' AND policyname = 'Users can view own video plan items'
  ) THEN
    CREATE POLICY "Users can view own video plan items" ON video_plan_items FOR SELECT 
      USING (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plan_items' AND policyname = 'Users can insert own video plan items'
  ) THEN
    CREATE POLICY "Users can insert own video plan items" ON video_plan_items FOR INSERT 
      WITH CHECK (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plan_items' AND policyname = 'Users can update own video plan items'
  ) THEN
    CREATE POLICY "Users can update own video plan items" ON video_plan_items FOR UPDATE 
      USING (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_plan_items' AND policyname = 'Users can delete own video plan items'
  ) THEN
    CREATE POLICY "Users can delete own video plan items" ON video_plan_items FOR DELETE 
      USING (EXISTS (SELECT 1 FROM video_plans WHERE video_plans.id = video_plan_items.plan_id AND video_plans.user_id = auth.uid()));
  END IF;
END $$;

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_video_plans_updated_at ON video_plans;
CREATE TRIGGER update_video_plans_updated_at
  BEFORE UPDATE ON video_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_plan_items_updated_at ON video_plan_items;
CREATE TRIGGER update_video_plan_items_updated_at
  BEFORE UPDATE ON video_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
