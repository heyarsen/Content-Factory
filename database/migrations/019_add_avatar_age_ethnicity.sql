-- Migration: Add age and ethnicity to avatars table
-- These fields are now required by HeyGen API for look generation

ALTER TABLE avatars ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE avatars ADD COLUMN IF NOT EXISTS ethnicity TEXT;

-- Update existing avatars with default values if needed
-- (Optional: you might want to leave them null and handle in code)
