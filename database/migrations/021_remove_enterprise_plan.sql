-- Migration: Remove Enterprise Plan
-- Deactivates the enterprise subscription plan

-- Deactivate enterprise plan
UPDATE subscription_plans 
SET is_active = false 
WHERE id = 'plan_3';

-- Cancel any active enterprise subscriptions
UPDATE user_subscriptions 
SET status = 'cancelled', cancelled_at = NOW()
WHERE plan_id = 'plan_3' AND status = 'active';

COMMENT ON COLUMN subscription_plans.id IS 'Enterprise plan (plan_3) has been deactivated';
