CREATE TABLE IF NOT EXISTS image_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT,
  provider_tier TEXT NOT NULL DEFAULT 'nano-banana',
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_library_user_created_at ON image_library(user_id, created_at DESC);

ALTER TABLE image_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own image library" ON image_library;
CREATE POLICY "Users can view own image library" ON image_library
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own image library" ON image_library;
CREATE POLICY "Users can insert own image library" ON image_library
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own image library" ON image_library;
CREATE POLICY "Users can delete own image library" ON image_library
  FOR DELETE USING (auth.uid() = user_id);
