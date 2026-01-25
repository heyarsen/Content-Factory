-- Migration: User Credits System
-- Creates user_profiles table to track user credits for platform operations

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER DEFAULT 3, -- Grant 3 credits to new users for testing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow NULL credits to represent unlimited credits
-- When credits is NULL, user has unlimited credits
COMMENT ON COLUMN user_profiles.credits IS 'User credits. NULL = unlimited credits. Default: 20 credits.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_credits ON user_profiles(credits);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles 
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Function to automatically create profile when user is created
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, credits, preferred_language)
  VALUES (NEW.id, 3, 'en') -- Users start with 3 credits for testing
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Add comment
COMMENT ON TABLE user_profiles IS 'User profiles with credits for platform operations. Users start with 0 credits and must purchase a subscription. Video generation: 1 credit, Avatar generation: 5 credits, Look generation: 1 credit.';

