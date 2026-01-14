-- Migration: Add is_read status to support messages
-- Description: Adds is_read column to support_messages to track unread notifications

ALTER TABLE support_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Create index for faster unread count queries
CREATE INDEX IF NOT EXISTS idx_support_messages_is_read ON support_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON support_messages(sender_id);

-- Add comment
COMMENT ON COLUMN support_messages.is_read IS 'Whether the message has been read by the recipient';
