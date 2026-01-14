-- Ensure support_messages table is included in the supabase_realtime publication
-- This is necessary for the frontend to receive real-time updates (INSERT/UPDATE/DELETE)
-- We use a DO block to avoid errors if it's already added or if the publication doesn't exist (though it should)

DO $$
BEGIN
  -- Check if publication exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Check if table is not already in publication
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
    END IF;
  END IF;
END $$;
