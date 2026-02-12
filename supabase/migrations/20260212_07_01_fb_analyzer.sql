-- Phase 7, Plan 01: FB Analyzer Foundation — Database Schema
-- Date: 2026-02-12
--
-- 6 tabel: fb_groups, fb_posts, fb_comments, fb_scrape_jobs, fb_analysis_jobs, fb_reports
-- Kazda tabela ma admin-only RLS policy
-- WAZNE: Supabase CLI jest zepsuty — user aplikuje przez SQL Editor w Supabase Dashboard

-- ============================================
-- 0. HELPER: updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. FB_GROUPS — grupy Facebook do monitorowania
-- ============================================
CREATE TABLE IF NOT EXISTS fb_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  facebook_url TEXT NOT NULL,
  developer TEXT,                                         -- deweloper/klient (do grupowania w raportach)
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  last_scraped_at TIMESTAMPTZ,
  total_posts INTEGER NOT NULL DEFAULT 0,
  apify_actor_id TEXT DEFAULT 'curious_coder/facebook-post-scraper',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_groups_developer ON fb_groups(developer);
CREATE INDEX IF NOT EXISTS idx_fb_groups_status ON fb_groups(status);

CREATE TRIGGER fb_groups_updated_at
  BEFORE UPDATE ON fb_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. FB_POSTS — posty z grup Facebook
-- ============================================
CREATE TABLE IF NOT EXISTS fb_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES fb_groups(id) ON DELETE CASCADE,
  facebook_post_id TEXT NOT NULL,                         -- ID posta z Facebooka
  author_name TEXT,
  content TEXT,
  posted_at TIMESTAMPTZ,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  post_url TEXT,                                          -- link do oryginalnego posta na FB (krytyczny!)
  media_url TEXT,                                         -- URL do zalacznika/zdjecia
  sentiment TEXT
    CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  relevance_score REAL,                                   -- 0.0 do 10.0
  ai_snippet TEXT,                                        -- 1-2 zdania streszczenia AI
  ai_categories TEXT[],                                   -- kategorie tematyczne
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, facebook_post_id)                     -- deduplikacja!
);

CREATE INDEX IF NOT EXISTS idx_fb_posts_group_id ON fb_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_fb_posts_posted_at ON fb_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_fb_posts_sentiment ON fb_posts(sentiment);
CREATE INDEX IF NOT EXISTS idx_fb_posts_relevance_score ON fb_posts(relevance_score);

CREATE TRIGGER fb_posts_updated_at
  BEFORE UPDATE ON fb_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. FB_COMMENTS — komentarze do postow
-- ============================================
CREATE TABLE IF NOT EXISTS fb_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES fb_posts(id) ON DELETE CASCADE,
  facebook_comment_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT,
  posted_at TIMESTAMPTZ,
  sentiment TEXT
    CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_comments_post_id ON fb_comments(post_id);

-- ============================================
-- 4. FB_SCRAPE_JOBS — zadania scrapowania Apify
-- ============================================
CREATE TABLE IF NOT EXISTS fb_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES fb_groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'downloading', 'completed', 'failed')),
  posts_found INTEGER NOT NULL DEFAULT 0,
  posts_new INTEGER NOT NULL DEFAULT 0,
  posts_updated INTEGER NOT NULL DEFAULT 0,
  apify_run_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_scrape_jobs_group_id ON fb_scrape_jobs(group_id);
CREATE INDEX IF NOT EXISTS idx_fb_scrape_jobs_status ON fb_scrape_jobs(status);

-- ============================================
-- 5. FB_ANALYSIS_JOBS — zadania analizy AI
-- ============================================
CREATE TABLE IF NOT EXISTS fb_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES fb_groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_posts INTEGER NOT NULL DEFAULT 0,
  analyzed_posts INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0.0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_analysis_jobs_group_id ON fb_analysis_jobs(group_id);
CREATE INDEX IF NOT EXISTS idx_fb_analysis_jobs_status ON fb_analysis_jobs(status);

-- ============================================
-- 6. FB_REPORTS — raporty z analizy grup FB
-- ============================================
CREATE TABLE IF NOT EXISTS fb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_markdown TEXT,
  summary_data JSONB,
  group_ids TEXT[],                                       -- grupy objete raportem
  date_from DATE,
  date_to DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_reports_created_at ON fb_reports(created_at);

CREATE TRIGGER fb_reports_updated_at
  BEFORE UPDATE ON fb_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. RLS POLICIES (admin only — wzorzec z email-analyzer)
-- ============================================
ALTER TABLE fb_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on fb_groups" ON fb_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access on fb_posts" ON fb_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access on fb_comments" ON fb_comments FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access on fb_scrape_jobs" ON fb_scrape_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access on fb_analysis_jobs" ON fb_analysis_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access on fb_reports" ON fb_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));
