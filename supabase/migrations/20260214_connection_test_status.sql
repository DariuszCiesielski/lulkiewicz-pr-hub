-- Add connection test status tracking to mailboxes
-- Date: 2026-02-14

ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS connection_tested_at TIMESTAMPTZ;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS connection_test_ok BOOLEAN;
