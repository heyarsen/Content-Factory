-- Migration: Add credits_burned column to user_subscriptions
-- This tracks how many credits were burned during subscription renewals

-- Add credits_burned column to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS credits_burned INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN user_subscriptions.credits_burned IS 'Number of credits burned during subscription renewal (from previous period + top-ups)';

-- Update existing records to have 0 credits_burned (for historical data)
UPDATE user_subscriptions 
SET credits_burned = 0 
WHERE credits_burned IS NULL;
