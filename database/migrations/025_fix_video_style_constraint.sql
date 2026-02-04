-- Migration: Ensure video style constraint is case-insensitive and includes all supported styles

ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_style_check;

UPDATE videos
SET style = CASE
  WHEN style IS NULL OR TRIM(style) = '' THEN 'Realistic'
  WHEN lower(style) IN ('3d', '3d_render', '3drender', '3d render') THEN '3D Render'
  WHEN lower(style) = 'casual' THEN 'Casual'
  WHEN lower(style) = 'professional' THEN 'Professional'
  WHEN lower(style) = 'energetic' THEN 'Energetic'
  WHEN lower(style) = 'educational' THEN 'Educational'
  WHEN lower(style) = 'cinematic' THEN 'Cinematic'
  WHEN lower(style) = 'realistic' THEN 'Realistic'
  WHEN lower(style) = 'anime' THEN 'Anime'
  WHEN lower(style) = 'cyberpunk' THEN 'Cyberpunk'
  WHEN lower(style) = 'minimalist' THEN 'Minimalist'
  WHEN lower(style) = 'documentary' THEN 'Documentary'
  ELSE 'Realistic'
END;

ALTER TABLE videos
ADD CONSTRAINT videos_style_check
CHECK (lower(style) IN (
  'casual',
  'cinematic',
  'educational',
  'energetic',
  'professional',
  'realistic',
  'anime',
  '3d render',
  'cyberpunk',
  'minimalist',
  'documentary'
));

COMMENT ON CONSTRAINT videos_style_check ON videos IS 'Valid video styles including tone-based options (case-insensitive)';
