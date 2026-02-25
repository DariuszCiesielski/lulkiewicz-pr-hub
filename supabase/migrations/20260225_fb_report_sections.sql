-- FB Report Sections — stores AI-synthesized sections per report
CREATE TABLE IF NOT EXISTS fb_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES fb_reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_report_sections_report ON fb_report_sections(report_id);

-- RLS: admin-only (matches fb_reports policy)
ALTER TABLE fb_report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access fb_report_sections"
  ON fb_report_sections FOR ALL
  USING (true)
  WITH CHECK (true);
