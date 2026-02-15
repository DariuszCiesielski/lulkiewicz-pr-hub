-- Migration: Add exact token tracking and cost to analysis_results
-- Enables precise cost calculation instead of blended rate estimates.
-- IMPORTANT: Paste this in Supabase SQL Editor (Supabase CLI is broken)

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,6) DEFAULT 0;

-- Index for fast cost aggregation per job
CREATE INDEX IF NOT EXISTS idx_analysis_results_job_cost
  ON analysis_results (analysis_job_id)
  INCLUDE (prompt_tokens, completion_tokens, cost_usd, tokens_used);
