-- Add app settings storage and Sora provider tracking

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('sora_provider', 'poyo')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS sora_provider text;

UPDATE videos
SET sora_provider = 'poyo'
WHERE sora_provider IS NULL
  AND sora_task_id IS NOT NULL;
