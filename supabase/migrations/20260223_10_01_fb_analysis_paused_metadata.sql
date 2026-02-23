-- Phase 10, Plan 01: AI Sentiment Analysis — ALTER fb_analysis_jobs
-- Date: 2026-02-23
--
-- Dodaje status 'paused' do CHECK constraint i kolumne metadata JSONB
-- Pattern identyczny jak sync_jobs w email-analyzer
-- WAZNE: Supabase CLI jest zepsuty — wklej w Supabase Dashboard > SQL Editor

-- 1. Dodaj status 'paused' do CHECK constraint
-- Stary: CHECK (status IN ('pending', 'running', 'completed', 'failed'))
-- Nowy: CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed'))
ALTER TABLE fb_analysis_jobs DROP CONSTRAINT IF EXISTS fb_analysis_jobs_status_check;
ALTER TABLE fb_analysis_jobs ADD CONSTRAINT fb_analysis_jobs_status_check
  CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed'));

-- 2. Dodaj kolumne metadata JSONB (pattern identyczny jak sync_jobs)
-- Uzycie: { forceReanalyze: true } zapisywane przy tworzeniu joba
ALTER TABLE fb_analysis_jobs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
