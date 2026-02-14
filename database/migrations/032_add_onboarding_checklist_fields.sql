-- Migration: Add onboarding checklist tracking fields to user_preferences

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_checklist_completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS onboarding_checklist_hidden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE user_preferences
SET onboarding_checklist_completed_steps = COALESCE(onboarding_checklist_completed_steps, ARRAY[]::TEXT[]),
    onboarding_checklist_hidden = COALESCE(onboarding_checklist_hidden, false)
WHERE onboarding_checklist_completed_steps IS NULL
   OR onboarding_checklist_hidden IS NULL;
