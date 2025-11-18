-- Migration: Add HeyGen template preferences for SaaS vertical videos
-- Adds columns that let each user store a template ID, script variable key,
-- and optional JSON variables that will be sent to HeyGen Template API.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS heygen_vertical_template_id TEXT,
  ADD COLUMN IF NOT EXISTS heygen_vertical_template_script_key TEXT DEFAULT 'script',
  ADD COLUMN IF NOT EXISTS heygen_vertical_template_variables JSONB DEFAULT '{}'::jsonb;

-- Backfill defaults for existing rows
UPDATE user_preferences
SET
  heygen_vertical_template_script_key = COALESCE(heygen_vertical_template_script_key, 'script'),
  heygen_vertical_template_variables = COALESCE(heygen_vertical_template_variables, '{}'::jsonb)
WHERE
  heygen_vertical_template_script_key IS NULL
  OR heygen_vertical_template_variables IS NULL;


