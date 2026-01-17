-- Migration: Update Subscriptions to Ongoing Model
-- Removes expires_at field and makes subscriptions continue until canceled

-- First, drop the existing function that depends on expires_at
DROP FUNCTION IF EXISTS get_user_active_subscription(UUID);

-- Remove expires_at column from user_subscriptions table
ALTER TABLE user_subscriptions 
DROP COLUMN IF EXISTS expires_at;

-- Update the function to remove expires_at reference
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_uuid UUID)
RETURNS TABLE(
  id UUID,
  plan_id TEXT,
  credits_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.plan_id,
    us.credits_remaining
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid
  AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments to reflect new model
COMMENT ON TABLE user_subscriptions IS 'User subscription records - ongoing until canceled';
COMMENT ON COLUMN user_profiles.has_active_subscription IS 'Whether user has an active subscription (ongoing until canceled)';
