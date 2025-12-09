-- Add scheduled_post_id to video_plan_items so distribution can track posts
ALTER TABLE public.video_plan_items
ADD COLUMN IF NOT EXISTS scheduled_post_id uuid;

-- Optional: keep a reference to scheduled_posts if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_posts'
  ) THEN
    -- Add a safe FK; ignore if it already exists
    BEGIN
      ALTER TABLE public.video_plan_items
        ADD CONSTRAINT video_plan_items_scheduled_post_id_fkey
        FOREIGN KEY (scheduled_post_id)
        REFERENCES public.scheduled_posts(id)
        ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN
        -- Constraint already exists, do nothing
        NULL;
    END;
  END IF;
END $$;

-- Helpful index for distribution lookups
CREATE INDEX IF NOT EXISTS idx_video_plan_items_scheduled_post_id
  ON public.video_plan_items (scheduled_post_id);

