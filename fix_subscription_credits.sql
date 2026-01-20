-- Fix script for users who received incorrect credits due to subscription bug
-- This script identifies and fixes users who got payment amount (0.1) instead of plan credits

-- First, let's see what subscriptions we have and their current credit status
SELECT 
    us.id,
    us.user_id,
    us.plan_id,
    us.status,
    us.payment_status,
    us.credits_included,
    us.credits_remaining,
    sp.credits as plan_credits,
    sp.display_name,
    up.credits as current_user_credits,
    us.created_at
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN user_profiles up ON us.user_id = up.id
WHERE us.status = 'active' 
  AND us.payment_status = 'completed'
ORDER BY us.created_at DESC;

-- Update subscriptions that have incorrect credits_included (should be plan credits, not payment amount)
UPDATE user_subscriptions 
SET 
    credits_included = sp.credits,
    credits_remaining = CASE 
        WHEN up.credits < sp.credits THEN sp.credits  -- Fix user credits if they're too low
        ELSE up.credits
    END
FROM subscription_plans sp, user_profiles up
WHERE user_subscriptions.plan_id = sp.id
  AND user_subscriptions.user_id = up.id
  AND user_subscriptions.status = 'active'
  AND user_subscriptions.payment_status = 'completed'
  AND user_subscriptions.credits_included != sp.credits;

-- Fix user credits for active subscribers who have less than their plan allocation
UPDATE user_profiles 
SET credits = sp.credits
FROM subscription_plans sp, user_subscriptions us
WHERE user_profiles.id = us.user_id
  AND us.plan_id = sp.id
  AND us.status = 'active'
  AND us.payment_status = 'completed'
  AND user_profiles.credits < sp.credits;

-- Verify the fixes
SELECT 
    us.id,
    us.user_id,
    us.plan_id,
    us.credits_included,
    sp.credits as expected_plan_credits,
    up.credits as current_user_credits,
    sp.display_name,
    CASE 
        WHEN us.credits_included = sp.credits THEN 'FIXED'
        ELSE 'NEEDS ATTENTION'
    END as status
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN user_profiles up ON us.user_id = up.id
WHERE us.status = 'active' 
  AND us.payment_status = 'completed'
ORDER BY us.created_at DESC;
