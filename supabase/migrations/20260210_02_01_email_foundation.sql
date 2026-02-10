-- Phase 2, Plan 01: Email Foundation Migration
-- Applied via Supabase Management API (CLI is broken)
-- Date: 2026-02-10

-- ============================================
-- 1. MAILBOXES: convert sync_status from enum to TEXT
-- ============================================
ALTER TABLE mailboxes ALTER COLUMN sync_status DROP DEFAULT;
ALTER TABLE mailboxes ALTER COLUMN sync_status TYPE TEXT USING sync_status::TEXT;
ALTER TABLE mailboxes ALTER COLUMN sync_status SET DEFAULT 'never_synced';

-- Make legacy columns nullable for new Phase 2 mailboxes
ALTER TABLE mailboxes ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE mailboxes ALTER COLUMN name DROP NOT NULL;
ALTER TABLE mailboxes ALTER COLUMN provider DROP NOT NULL;

-- Add new columns for Phase 2
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'ropc';
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS credentials_encrypted TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS total_emails INTEGER DEFAULT 0;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS delta_link TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 2. SYNC_JOBS: new table
-- ============================================
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  job_type TEXT NOT NULL DEFAULT 'full',
  page_token TEXT,
  emails_fetched INTEGER DEFAULT 0,
  emails_total_estimate INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. EMAILS: add missing columns
-- ============================================
ALTER TABLE emails ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE emails ALTER COLUMN external_id DROP NOT NULL;

ALTER TABLE emails ADD COLUMN IF NOT EXISTS internet_message_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS graph_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS conversation_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS from_address TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS from_name TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS to_addresses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS cc_addresses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS header_message_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS header_in_reply_to TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS header_references TEXT[];
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Unique constraint: one internet_message_id per mailbox
ALTER TABLE emails ADD CONSTRAINT emails_mailbox_internet_msg_unique
  UNIQUE (mailbox_id, internet_message_id);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_mailbox_id ON sync_jobs(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

-- ============================================
-- 5. RLS POLICIES
-- ============================================
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Remove old organization-based policies
DROP POLICY IF EXISTS "Członkowie widzą skrzynki org" ON mailboxes;
DROP POLICY IF EXISTS "Członkowie tworzą skrzynki" ON mailboxes;
DROP POLICY IF EXISTS "Członkowie edytują skrzynki" ON mailboxes;
DROP POLICY IF EXISTS "Admini usuwają skrzynki" ON mailboxes;
DROP POLICY IF EXISTS "Członkowie widzą emaile org" ON emails;
DROP POLICY IF EXISTS "System tworzy emaile" ON emails;

-- New admin-based policies (service_role bypasses RLS automatically)
CREATE POLICY "Admins can manage mailboxes" ON mailboxes FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view sync_jobs" ON sync_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view emails" ON emails FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));
