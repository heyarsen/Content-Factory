-- Migration: Deactivate Enterprise Plan
-- Set is_active = false for the Enterprise plan (plan_3)

UPDATE subscription_plans
SET is_active = false
WHERE id = 'plan_3';
