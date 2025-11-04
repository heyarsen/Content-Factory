-- Fix RLS for social_accounts table
-- Run this SQL in your Supabase SQL Editor

-- Update platform CHECK constraint to include all platforms
ALTER TABLE social_accounts 
DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

ALTER TABLE social_accounts 
ADD CONSTRAINT social_accounts_platform_check 
CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest', 'snapchat'));

-- Update scheduled_posts platform CHECK constraint
ALTER TABLE scheduled_posts 
DROP CONSTRAINT IF EXISTS scheduled_posts_platform_check;

ALTER TABLE scheduled_posts 
ADD CONSTRAINT scheduled_posts_platform_check 
CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest', 'snapchat'));

-- Ensure RLS policies are correct (they should already exist, but let's make sure)
-- Recreate the insert policy to ensure it works correctly
DROP POLICY IF EXISTS "Users can insert own social accounts" ON social_accounts;
CREATE POLICY "Users can insert own social accounts" 
ON social_accounts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Make sure all policies are in place
DROP POLICY IF EXISTS "Users can view own social accounts" ON social_accounts;
CREATE POLICY "Users can view own social accounts" 
ON social_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own social accounts" ON social_accounts;
CREATE POLICY "Users can update own social accounts" 
ON social_accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own social accounts" ON social_accounts;
CREATE POLICY "Users can delete own social accounts" 
ON social_accounts 
FOR DELETE 
USING (auth.uid() = user_id);

