-- Migration: Add detail_level to reports table
-- Supports 2 report levels: 'synthetic' (5-6 pages) and 'standard' (15-20 pages)
-- NOTE: Apply via Supabase SQL Editor (CLI is broken)

ALTER TABLE reports ADD COLUMN detail_level TEXT NOT NULL DEFAULT 'standard';

-- Existing reports were generated with current prompts = standard level
COMMENT ON COLUMN reports.detail_level IS 'Report detail level: synthetic (5-6 pages) or standard (15-20 pages)';
