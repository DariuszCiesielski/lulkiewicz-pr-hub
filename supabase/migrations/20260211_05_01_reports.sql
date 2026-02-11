-- Phase 5, Plan 01: Reports Migration
-- Date: 2026-02-11

-- ============================================
-- 1. REPORTS table
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  analysis_job_id UUID REFERENCES analysis_jobs(id) ON DELETE SET NULL,
  template_type TEXT NOT NULL DEFAULT 'internal', -- internal, client
  title TEXT NOT NULL,
  date_range_from TIMESTAMPTZ,
  date_range_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_mailbox ON reports(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_reports_analysis_job ON reports(analysis_job_id);

-- ============================================
-- 2. REPORT_SECTIONS table
-- ============================================
CREATE TABLE IF NOT EXISTS report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_order INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_sections_report ON report_sections(report_id);

-- ============================================
-- 3. RLS POLICIES
-- ============================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reports" ON reports FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage report_sections" ON report_sections FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));
