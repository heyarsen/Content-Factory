-- Migration: Fix subscription status constraint
-- Add 'pending' and 'failed' to allowed status values

-- Drop the existing constraint
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

-- Add the updated constraint with 'pending' and 'failed' statuses
ALTER TABLE user_subscriptions 
  ADD CONSTRAINT user_subscriptions_status_check 
  CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'failed'));

-- Update default status to 'pending' for new subscriptions
ALTER TABLE user_subscriptions ALTER COLUMN status SET DEFAULT 'pending';

