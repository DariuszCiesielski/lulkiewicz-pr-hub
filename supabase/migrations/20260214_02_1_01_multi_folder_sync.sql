-- Phase 2.1: Multi-Folder Sync — nowe kolumny
-- Uwaga: Wklej w Supabase Dashboard > SQL Editor

-- 1. emails: folder_id do przechowywania ID folderu źródłowego
ALTER TABLE emails ADD COLUMN IF NOT EXISTS folder_id TEXT;

-- 2. sync_jobs: metadata do przechowywania konfiguracji sync (excluded folders, etc.)
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS metadata JSONB;
