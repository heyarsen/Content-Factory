-- Migration: Update video style constraint to support more styles
-- Fixed to handle existing data with invalid styles by DROPPING constraint first

-- 1. Drop the existing constraint FIRST to allow updates to new styles
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_style_check;

-- 2. Sanitize existing data
-- Update any video with a style that isn't in our new allowed list to 'Realistic'
-- This explicitly handles NULLs and empty strings
UPDATE videos 
SET style = 'Realistic'
WHERE style IS NULL 
   OR TRIM(style) = ''
   OR style NOT IN (
    'Cinematic', 'Realistic', 'Anime', '3D Render', 'Cyberpunk', 'Minimalist', 'Documentary'
   );

-- 3. Add the new constraint with all supported styles
ALTER TABLE videos 
ADD CONSTRAINT videos_style_check 
CHECK (style IN (
  'Cinematic', 
  'Realistic', 
  'Anime', 
  '3D Render', 
  'Cyberpunk', 
  'Minimalist', 
  'Documentary'
));

-- Add comment
COMMENT ON CONSTRAINT videos_style_check ON videos IS 'Valid video styles including new options';
