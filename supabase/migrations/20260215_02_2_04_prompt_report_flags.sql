-- Migration: Add report type flags to prompt_templates
-- Phase 2.2, Plan 04 — Prompt CRUD (in_internal_report, in_client_report)
-- IMPORTANT: Paste this in Supabase SQL Editor (Supabase CLI is broken)

-- Add columns for controlling which report type includes each section
ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS in_internal_report BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_client_report BOOLEAN DEFAULT false;

-- Update existing prompts to match current CLIENT_REPORT_SECTIONS logic
-- Client sections: summary, communication_quality, response_time, recommendations
UPDATE prompt_templates
SET in_client_report = true
WHERE section_key IN ('summary', 'communication_quality', 'response_time', 'recommendations');
