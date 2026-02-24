-- Analysis Profiles: per-mailbox analysis profile configuration
-- Profiles change both the thread analysis prompt and report sections.

-- 1. Add analysis_profile to mailboxes (default: communication_audit)
ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS analysis_profile TEXT NOT NULL DEFAULT 'communication_audit';

-- 2. Add analysis_profile to analysis_jobs (snapshot of profile at job creation)
ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS analysis_profile TEXT;

-- 3. Auto-assign case_analytics for mailboxes with "Rzecznik" in display_name
UPDATE mailboxes
  SET analysis_profile = 'case_analytics'
  WHERE display_name ILIKE '%Rzecznik%';
