-- Migration: Subscriptions System
-- Creates subscription plans and user subscriptions

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY, -- e.g., 'plan_1', 'plan_2', 'plan_3'
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert subscription plans
INSERT INTO subscription_plans (id, name, credits, price_usd, display_name, description, sort_order) VALUES
  ('plan_free', 'free', 0, 0.00, 'Free Plan', 'Free plan (3 credits for new accounts)', 0),
  ('plan_1', 'starter', 20, 10.00, 'Starter Plan', '20 credits per month - ongoing until canceled', 1),
  ('plan_2', 'professional', 70, 30.00, 'Professional Plan', '70 credits per month - ongoing until canceled', 2),
  ('plan_3', 'enterprise', 250, 100.00, 'Enterprise Plan', '250 credits per month - ongoing until canceled', 3)
ON CONFLICT (id) DO UPDATE SET
  credits = EXCLUDED.credits,
  price_usd = EXCLUDED.price_usd,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'failed')),
  credits_included INTEGER NOT NULL, -- Credits that came with this subscription
  credits_remaining INTEGER NOT NULL, -- Remaining credits from this subscription
  payment_id TEXT, -- WayForPay transaction ID
  payment_status TEXT, -- 'pending', 'completed', 'failed', 'refunded'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL means no expiration
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(user_id, status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
DROP POLICY IF EXISTS "Anyone can view active plans" ON subscription_plans;
CREATE POLICY "Anyone can view active plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for user_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create subscriptions" ON user_subscriptions;
CREATE POLICY "System can create subscriptions"
  ON user_subscriptions FOR INSERT
  WITH CHECK (true); -- Will be controlled by backend

-- Update user_profiles to track subscription status
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS has_active_subscription BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_subscription_id UUID REFERENCES user_subscriptions(id);

-- Create index for subscription lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(has_active_subscription) WHERE has_active_subscription = true;

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_uuid UUID)
RETURNS TABLE(
  id UUID,
  plan_id TEXT,
  credits_remaining INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.plan_id,
    us.credits_remaining,
    us.expires_at
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid
    AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE subscription_plans IS 'Available subscription plans';
COMMENT ON TABLE user_subscriptions IS 'User subscription records';
COMMENT ON COLUMN user_profiles.has_active_subscription IS 'Whether user has an active subscription';
COMMENT ON COLUMN user_profiles.current_subscription_id IS 'Reference to current active subscription';

