-- Migration: Add HeyGen template override storage

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS heygen_vertical_template_overrides JSONB DEFAULT '{}'::jsonb;

UPDATE user_preferences
SET heygen_vertical_template_overrides = COALESCE(heygen_vertical_template_overrides, '{}'::jsonb)
WHERE heygen_vertical_template_overrides IS NULL;


