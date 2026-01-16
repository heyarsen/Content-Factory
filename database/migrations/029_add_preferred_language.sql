-- Migration: Add preferred_language to user_profiles
-- Description: Adds preferred_language column to store user's language preference

-- Add preferred_language column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en' NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_language ON user_profiles(preferred_language);

-- Add comment
COMMENT ON COLUMN user_profiles.preferred_language IS 'User preferred language code (en, ru, uk, de, es)';
