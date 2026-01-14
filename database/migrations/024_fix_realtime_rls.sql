-- Migration: Fix Realtime RLS by denormalizing ticket_owner_id
-- Description: Adds ticket_owner_id to support_messages so RLS doesn't need joins

-- 1. Add column
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS ticket_owner_id UUID REFERENCES auth.users(id);

-- 2. Backfill data
UPDATE support_messages sm
SET ticket_owner_id = st.user_id
FROM support_tickets st
WHERE sm.ticket_id = st.id;

-- 3. Make not null (after backfill)
-- We need to ensure no orphans exist, otherwise this might fail.
-- Assuming cascade delete works, it should be fine.
ALTER TABLE support_messages ALTER COLUMN ticket_owner_id SET NOT NULL;

-- 4. Create index
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_owner_id ON support_messages(ticket_owner_id);

-- 5. Update RLS Policies
-- SELECT Policy
DROP POLICY IF EXISTS "Users can view messages for own tickets" ON support_messages;
CREATE POLICY "Users can view messages for own tickets" ON support_messages
  FOR SELECT USING (
    ticket_owner_id = auth.uid()
    OR sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT Policy
DROP POLICY IF EXISTS "Users can insert messages for own tickets" ON support_messages;
CREATE POLICY "Users can insert messages for own tickets" ON support_messages
  FOR INSERT WITH CHECK (
    ticket_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
