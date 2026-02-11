-- Phase 4, Plan 01: AI Analysis & Anonymization Migration
-- Date: 2026-02-11

-- ============================================
-- 1. AI_CONFIG — provider configuration
-- ============================================
CREATE TABLE IF NOT EXISTS ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'openai', -- openai, anthropic, azure
  api_key_encrypted TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature DOUBLE PRECISION DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 4096,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PROMPT_TEMPLATES — 3-tier system
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL, -- summary, communication_quality, response_time, etc.
  tier TEXT NOT NULL DEFAULT 'default', -- default, global, per_report
  report_id UUID, -- only for per_report tier
  title TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  section_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_section ON prompt_templates(section_key, tier);

-- ============================================
-- 3. EVALUATION_CRITERIA — checklists + scoring rubrics
-- ============================================
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria_type TEXT NOT NULL DEFAULT 'checklist', -- checklist, rubric
  criteria_data JSONB NOT NULL DEFAULT '{}', -- {items: [...]} or {levels: [...]}
  weight DOUBLE PRECISION DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ANALYSIS_JOBS — analysis job tracking
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0,
  total_threads INTEGER DEFAULT 0,
  processed_threads INTEGER DEFAULT 0,
  date_range_from TIMESTAMPTZ,
  date_range_to TIMESTAMPTZ,
  ai_config_id UUID REFERENCES ai_config(id),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_mailbox ON analysis_jobs(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);

-- ============================================
-- 5. ANALYSIS_RESULTS — per-thread per-section results
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  result_data JSONB NOT NULL DEFAULT '{}', -- {content, score, checklist_results, ...}
  tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_job ON analysis_results(analysis_job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_thread ON analysis_results(thread_id);

-- ============================================
-- 6. ANONYMIZATION_MAP — PII mapping
-- ============================================
CREATE TABLE IF NOT EXISTS anonymization_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  original_value TEXT NOT NULL,
  anonymized_value TEXT NOT NULL,
  pii_type TEXT NOT NULL, -- name, phone, email, pesel, bank_account, address
  context TEXT, -- where it was found
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymization_map_job ON anonymization_map(analysis_job_id);

-- ============================================
-- 7. RLS POLICIES (admin only)
-- ============================================
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymization_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_config" ON ai_config FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage prompt_templates" ON prompt_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage evaluation_criteria" ON evaluation_criteria FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage analysis_jobs" ON analysis_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage analysis_results" ON analysis_results FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage anonymization_map" ON anonymization_map FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));
