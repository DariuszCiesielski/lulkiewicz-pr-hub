---
phase: 07-fb-foundation
plan: 01
subsystem: database
tags: [supabase, sql, typescript, rls, fb-analyzer]
dependency-graph:
  requires: []
  provides: [fb-tables, fb-types, fb-rls]
  affects: [07-02, 07-03, 08, 09, 10, 11, 12]
tech-stack:
  added: []
  patterns: [admin-only-rls, text-status-enums, updated-at-trigger, unique-constraint-dedup]
key-files:
  created:
    - supabase/migrations/20260212_07_01_fb_analyzer.sql
    - src/types/fb.ts
  modified: []
decisions:
  - "Status/sentiment jako TEXT z CHECK (nie PostgreSQL enum) — wzorzec z email-analyzer"
  - "updated_at trigger function CREATE OR REPLACE — idempotentna"
  - "RLS policy pattern: EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin')"
metrics:
  duration: ~2 min
  completed: 2026-02-12
---

# Phase 7 Plan 01: FB Analyzer — Fundament danych (SQL + Typy TS)

**One-liner:** 6 tabel FB (groups/posts/comments/scrape_jobs/analysis_jobs/reports) z admin-only RLS, 12 indeksow, CHECK constraints + 11 eksportowanych typow TS

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Migracja SQL — 6 tabel FB z RLS, indeksami i constraintami | `de508e7` | `supabase/migrations/20260212_07_01_fb_analyzer.sql` |
| 2 | Typy TypeScript domeny FB | `d27709d` | `src/types/fb.ts` |

## What Was Built

### Migracja SQL (184 linii)
- **6 tabel**: fb_groups, fb_posts, fb_comments, fb_scrape_jobs, fb_analysis_jobs, fb_reports
- **6 RLS policies**: Admin-only (ENABLE ROW LEVEL SECURITY + CREATE POLICY) na kazdej tabeli
- **12 indeksow**: Na FK, statusach, datach, sentiment, relevance_score, developer
- **6 CHECK constraints**: Walidacja statusow i sentimentu na poziomie DB
- **1 UNIQUE constraint**: fb_posts(group_id, facebook_post_id) — deduplikacja postow
- **3 triggery**: updated_at na fb_groups, fb_posts, fb_reports
- **1 helper function**: update_updated_at_column() (CREATE OR REPLACE — idempotentna)

### Typy TypeScript (102 linie)
- **6 interfejsow**: FbGroup, FbPost, FbComment, FbScrapeJob, FbAnalysisJob, FbReport
- **5 union types**: FbGroupStatus, FbSentiment, FbScrapeStatus, FbAnalysisStatus, FbReportStatus
- Pola nullable odpowiadaja kolumnom bez NOT NULL
- Daty jako string (ISO format z Supabase)
- Kompilacja `tsc --noEmit` bez bledow

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| TEXT z CHECK zamiast PostgreSQL ENUM | Elastycznosc — dodanie wartosci nie wymaga ALTER TYPE. Wzorzec z email-analyzer (sync_status TEXT) |
| CREATE OR REPLACE na trigger function | Idempotentnosc — bezpieczne ponowne uruchomienie migracji |
| EXISTS subquery w RLS zamiast IN | Wydajnosc — EXISTS zatrzymuje sie po pierwszym wyniku |
| UNIQUE(group_id, facebook_post_id) | Deduplikacja na poziomie DB — Apify moze zwrocic te same posty przy kolejnych scrapach |

## Deviations from Plan

None — plan wykonany dokladnie jak zapisano.

## Verification Results

- [x] 6 CREATE TABLE statements
- [x] 6 ENABLE ROW LEVEL SECURITY + 6 CREATE POLICY
- [x] UNIQUE(group_id, facebook_post_id) na fb_posts
- [x] 6 CHECK constraints (status/sentiment)
- [x] 12 CREATE INDEX
- [x] 3 updated_at triggers
- [x] tsc --noEmit kompilacja bez bledow
- [x] 6 interfejsow + 5 union types eksportowanych

## Next Steps

- User musi wkleic SQL w Supabase Dashboard > SQL Editor (Supabase CLI jest zepsuty)
- Plan 07-02: Konfiguracja narzedzia FB Analyzer (tools config, sidebar, routing)
- Plan 07-03: API CRUD dla fb_groups
