-- Migration: Fix Support Messages Update RLS
-- Description: Adds UPDATE policy to support_messages so is_read status can be updated

DROP POLICY IF EXISTS "Users can update read status of messages" ON support_messages;
CREATE POLICY "Users can update read status of messages" ON support_messages
  FOR UPDATE USING (
    ticket_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    ticket_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Optimize unread count query with a better index if not already there
-- We already have idx_support_messages_is_read and idx_support_messages_sender_id
-- A combined index might be better for the specific query: WHERE is_read = false AND sender_id != user_id
CREATE INDEX IF NOT EXISTS idx_support_messages_unread_filtering ON support_messages(is_read, sender_id);
