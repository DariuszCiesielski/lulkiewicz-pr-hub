-- CC Thread Filtering: per-mailbox filtering of CC-only threads from analysis

-- 1. Add cc_filter_status to email_threads
ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS cc_filter_status TEXT NOT NULL DEFAULT 'unknown';

-- 2. Add cc_filter_mode to mailboxes
ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS cc_filter_mode TEXT NOT NULL DEFAULT 'off';

-- 3. Set default cc_filter_mode based on analysis_profile for existing mailboxes
UPDATE mailboxes
  SET cc_filter_mode = 'never_in_to'
  WHERE analysis_profile = 'case_analytics';

-- 4. Index for filtering in analysis queries
CREATE INDEX IF NOT EXISTS idx_email_threads_cc_filter_status
  ON email_threads(cc_filter_status);
