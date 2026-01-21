-- Enable real-time for videos table
-- This allows the frontend to receive instant updates when a video status changes

-- 1. Create a publication for real-time if it doesn't exist
-- 2. Add the videos table to the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Add the table to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE videos;
EXCEPTION
  WHEN duplicate_object THEN
    -- If table is already in publication, just log it
    RAISE NOTICE 'Table videos already in publication supabase_realtime';
END $$;

-- Also ensure that REPLICA IDENTITY is set to FULL if we want to receive old values,
-- but for status updates, DEFAULT identity (PKEY) is usually enough.
ALTER TABLE videos REPLICA IDENTITY DEFAULT;
