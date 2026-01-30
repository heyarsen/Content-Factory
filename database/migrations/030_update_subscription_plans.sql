-- Migration: Update Subscription Plans
-- Removes "3 credits for new accounts" and adds $70 plan

-- Update free plan description to remove "3 credits for new accounts"
UPDATE subscription_plans 
SET description = 'Free plan - no credits included'
WHERE id = 'plan_free';

-- Add new $70 plan
INSERT INTO subscription_plans (id, name, credits, price_usd, display_name, description, sort_order) VALUES
  ('plan_4', 'premium', 150, 70.00, 'Premium Plan', '150 credits per month - ongoing until canceled', 3)
ON CONFLICT (id) DO UPDATE SET
  credits = EXCLUDED.credits,
  price_usd = EXCLUDED.price_usd,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Update enterprise plan sort order to move it after premium
UPDATE subscription_plans 
SET sort_order = 4
WHERE id = 'plan_3';
