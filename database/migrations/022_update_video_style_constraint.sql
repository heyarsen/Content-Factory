-- Migration: Update Video Style Constraint
-- Description: Updates the videos_style_check constraint to include new styles (Realistic, Anime, etc.)

-- Drop the existing constraint
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_style_check;

-- Add the updated constraint with all supported styles
ALTER TABLE videos 
ADD CONSTRAINT videos_style_check 
CHECK (style IN ('Cinematic', 'Realistic', 'Anime', '3D Render', 'Cyberpunk', 'Minimalist', 'Documentary'));

-- Add comment
COMMENT ON CONSTRAINT videos_style_check ON videos IS 'Valid video styles including new options';
