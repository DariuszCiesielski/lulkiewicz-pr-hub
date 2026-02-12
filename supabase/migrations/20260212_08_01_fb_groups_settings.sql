-- Phase 8: Group Management — ALTER TABLE fb_groups + CREATE TABLE fb_settings
-- Uwaga: Wklej w Supabase Dashboard > SQL Editor (Supabase CLI zepsuty)

-- ============================================
-- 1. ALTER TABLE fb_groups — nowe kolumny
-- ============================================

-- ai_instruction: instrukcja AI (free text) co szukac w postach tej grupy (nullable)
-- deleted_at: soft delete — NULL = aktywna, timestamp = usunieta (nullable)
-- cookies_encrypted: override FB cookies per grupa, AES-256-GCM encrypted (nullable, NULL = uzyj globalnych)

ALTER TABLE fb_groups
  ADD COLUMN IF NOT EXISTS ai_instruction TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cookies_encrypted TEXT;

-- Indeks na deleted_at — przyspieszenie filtrowania .is('deleted_at', null)
CREATE INDEX IF NOT EXISTS idx_fb_groups_deleted_at ON fb_groups(deleted_at);

-- ============================================
-- 2. CREATE TABLE fb_settings — klucz-wartosc dla konfiguracji FB Analyzer
-- ============================================
-- Klucze uzywane:
--   'apify_token'                      -> value_encrypted (globalny token API Apify)
--   'fb_cookies'                       -> value_encrypted (globalne cookies FB, JSON string encrypted)
--   'apify_actor_id'                   -> value_plain (domyslnie 'curious_coder/facebook-post-scraper')
--   'developer_instruction:{name}'     -> value_plain (domyslna instrukcja AI per deweloper)

CREATE TABLE IF NOT EXISTS fb_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_encrypted TEXT,
  value_plain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at — reuse istniejaca funkcja z Phase 7
CREATE TRIGGER fb_settings_updated_at
  BEFORE UPDATE ON fb_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. RLS — admin-only policy (wzorzec z fb_groups)
-- ============================================
ALTER TABLE fb_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on fb_settings" ON fb_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));
