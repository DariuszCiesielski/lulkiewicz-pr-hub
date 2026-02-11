-- Phase 3, Plan 01: Email Threading Migration
-- Date: 2026-02-11

-- ============================================
-- 1. EMAIL_THREADS table
-- ============================================
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  subject_normalized TEXT NOT NULL,
  first_message_at TIMESTAMPTZ NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL,
  message_count INTEGER DEFAULT 0,
  participant_addresses TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'open', -- open, closed, pending
  avg_response_time_minutes DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. New columns in EMAILS for threading
-- ============================================
ALTER TABLE emails ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES email_threads(id) ON DELETE SET NULL;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS subject_normalized TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_incoming BOOLEAN DEFAULT true;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS response_time_minutes DOUBLE PRECISION;

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox_id ON email_threads(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_subject_normalized ON emails(subject_normalized);
CREATE INDEX IF NOT EXISTS idx_emails_header_message_id ON emails(header_message_id);

-- ============================================
-- 4. RLS POLICIES (admin only, same as emails)
-- ============================================
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_threads" ON email_threads FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));
