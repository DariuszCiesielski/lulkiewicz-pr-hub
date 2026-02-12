# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Hub narzędziowy — AI analizuje maile (email-analyzer) i posty z grup FB (fb-analyzer) dla audytu komunikacji administracji osiedli
**Current focus:** Milestone v1.1 — FB Analyzer (defining requirements)

## Current Position

Phase: v1.0 Email Analyzer phases 1-6 complete (with known gaps), v1.1 research pending
Plan: —
Status: v1.0 feature-complete (known gaps: .docx/.pdf export, eval criteria UI), v1.1 defining requirements
Last activity: 2026-02-12 — v1.0 docs updated, v1.1 research pending

Progress (v1.0 Email Analyzer): [##################..] ~90% (Phases 1-6 complete, known gaps: .docx/.pdf export, eval criteria UI)
Progress (v1.1 FB Analyzer): [....................] 0% (milestone started, research pending)

## Planning Status

**Phase 1 plans (3 plans, 2 waves) — ALL COMPLETE:**
- [x] 01-01-PLAN.md (Wave 1) — Scaffold Next.js + Supabase Auth (f6e644a, 1a4150e, e055b5e)
- [x] 01-02-PLAN.md (Wave 2) — System rol admin/user + panel admina (f32245f)
- [x] 01-03-PLAN.md (Wave 2) — Hub UI: grid, sidebar, design system, footer (6954168)

**Phase 2 plans (4 plans, 3 waves) — ALL COMPLETE:**
- [x] 02-01-PLAN.md (Wave 1, autonomous) — Fundament emailowy (b12e7b1, 1e5e4fe, 6602942)
- [x] 02-02-PLAN.md (Wave 2, checkpoint) — Mailbox CRUD API + test connection + UI (c7560f5, 95f07ae, 41dc226, d1930f2)
- [x] 02-03-PLAN.md (Wave 2, autonomous) — Sync engine: email fetcher, parser, API routes (540fd72, 45e9adc)
- [x] 02-04-PLAN.md (Wave 3, checkpoint) — useSyncJob hook, progress bar, full+delta sync UI (2f22a50, 5b92531)

**Phase 3 plans — COMPLETE (fast-tracked in 1f853d6, 2026-02-11):**
- [x] 03-01: Algorytm threadingu (Union-Find) + migracja (email_threads) + thread-builder.ts
- [x] 03-02: UI listy watkow, drill-down, filtrowanie (ThreadList, ThreadCard, ThreadFilters, EmailMessage)

**Phase 4 plans — COMPLETE (fast-tracked in 1f853d6, 2026-02-11):**
- [x] 04-01: Konfiguracja AI (provider, klucz, model) + migracja + ai-provider.ts
- [x] 04-02: Prompt management UI — edycja promptow per sekcja, default-prompts.ts
- [x] 04-03: Evaluation criteria — tabela istnieje w DB (brak UI — known gap)
- [x] 04-04: Map-Reduce AI pipeline — analiza per watek z anonimizacja, useAnalysisJob hook

**Phase 5 plans — COMPLETE (fast-tracked in 1f853d6 + fix 48582a0, 2026-02-11):**
- [x] 05-01: Generowanie raportu + migracja (reports) + API routes
- [x] 05-02: Podglad raportu (markdown), edycja sekcji, historia raportow
- [ ] 05-03: Eksport .docx/.pdf — NOT IMPLEMENTED (clipboard markdown only — known gap)

**Phase 6 plans — COMPLETE (fast-tracked in 1f853d6 + fix 48582a0, 2026-02-11):**
- [x] 06-01: Dashboard — KPI tiles, podsumowania per skrzynka, quick actions, ostatnie raporty

## Accumulated Context

### Decisions

- [Roadmap]: 6 faz sekwencyjnych
- [Planning]: Next.js App Router, @supabase/ssr, Jezyk TYLKO PL, Supabase CLI broken
- [01-01]: Tailwind CSS v4 (nie v3), Next.js 16 middleware deprecation (non-blocking)
- [01-01]: Istniejace tabele Supabase zachowane dla pozniejszych faz
- [01-02]: Admin: dariusz.ciesielski.71@gmail.com, UUID: a3e6f759-7167-4470-b456-54f3828938e6
- [01-02]: Service role client do admin ops, "jasna wyspa" modals
- [01-03]: 6 motywow (glass domyslny), CSS variables bez prefixu, LucideIcon type
- [Phase 2 research]: Microsoft Graph API, @azure/msal-node, ROPC + client_credentials
- [Phase 2 research]: Chunked sync (100/batch), polling-driven, html-to-text for parsing
- [Phase 2 research]: Azure App Registration required (tenant_id + client_id)
- [Vercel fix]: Admin client MUST use lazy init (getAdminClient()), never top-level
- [02-01]: sync_status zmieniony z PostgreSQL enum na TEXT (elastycznosc)
- [02-01]: organization_id/name/provider w mailboxes nullable
- [02-01]: Stare org-based RLS policies zastapione admin-based (app_allowed_users)
- [02-01]: Migracje SQL via Management API, pliki w supabase/migrations/ jako dokumentacja
- [02-02]: Redirect /email-analyzer → /mailboxes (brak dedykowanej strony glownej modulu)
- [02-02]: comingSoon pattern w sidebarze dla niezaimplementowanych stron
- [02-03]: Upsert ON CONFLICT (mailbox_id, internet_message_id) dla deduplikacji emaili
- [02-03]: Safety timeout 50s (Vercel limit 60s, 10s bufor)
- [02-03]: 100 messages per batch via Graph API $top=100
- [02-03]: Delta link stored on mailbox for incremental sync
- [02-03]: No $select on @odata.nextLink (already contains params)
- [02-04]: Stale closure fix — onComplete notification via useEffect watching status, not useCallback
- [v1.1 milestone]: FB Analyzer = tool-2 w ToolId, fazy 7-13
- [v1.1 milestone]: Apify Actor: curious_coder/facebook-post-scraper (bezposrednio z PR Hub, bez n8n)
- [v1.1 milestone]: Supabase only (bez Airtable), reuse ai-provider.ts, reuse encrypt.ts
- [v1.1 milestone]: 6 tabel: fb_groups, fb_posts, fb_comments, fb_scrape_jobs, fb_analysis_jobs, fb_reports
- [v1.1 milestone]: Wzorce z Clicklease Hub (batch ops, filters, report generator) i Hotel Notera (export DOCX, analytics)

### Blockers/Concerns

- [Phase 2]: Azure App Registration needed — user must configure AZURE_TENANT_ID + AZURE_CLIENT_ID in .env.local
- [Phase 4]: DPA z OpenAI moze byc wymagane
- [Security]: Wyciekly token sbp_ zrotowany (2026-02-10), nowy token NIE zapisywac w plikach repo
- [DB cleanup]: Fantomowa skrzynka dariusz.ciesielski@o2.pl w bazie — do usunięcia przez usera

## Infrastructure

| Service | Name | URL / ID |
|---------|------|----------|
| GitHub | lulkiewicz-pr-hub | https://github.com/DariuszCiesielski/lulkiewicz-pr-hub |
| Vercel | lulkiewicz-pr-hub | Project ID: `prj_plqtl56Fo28Jlr3PNXKFozq2E91s`, Team: `team_wump0nNx40hMZqj8aowjblSw` |
| Supabase | Lulkiewicz PR | ref: `zyqewiqtnxrhkaladoah`, region: eu-north-1, URL: https://zyqewiqtnxrhkaladoah.supabase.co |

- **Branch:** `master`
- **Auto-deploy:** GitHub -> Vercel
- **Supabase Access Token:** (NIE zapisywać w repo — użyj Supabase Dashboard → Account → Access Tokens)

## Supabase Tables (Phase 2 updated)

organizations, organization_members, **mailboxes** (extended: +8 cols, sync_status TEXT), mailbox_credentials, **emails** (extended: +13 cols, UNIQUE mailbox+internet_message_id), threads, reports, report_sections, section_templates, schedules, messages, app_allowed_users, **sync_jobs** (new: status, job_type, page_token, emails_fetched), **email_threads** (Phase 3: Union-Find threading), **analysis_jobs** (Phase 4: AI analysis jobs), **analysis_results** (Phase 4: per-thread results), **prompt_templates** (Phase 4: customizable prompts), **evaluation_criteria** (Phase 4: scoring rubrics, no UI yet)

## Session Continuity

Last session: 2026-02-12
Stopped at: v1.0 all blockers fixed (auth, AI config, encryption). Ready for pipeline test.
Resume file: docs/HANDOFF-2026-02-12.md

### How to resume (v1.1 FB Analyzer):

Run `/gsd:resume-work` and follow these steps:

1. **Research (4 parallel agents)** — GSD new-milestone flow Phase 7
   - Stack research: Apify Actor API (curious_coder/facebook-post-scraper), response format, rate limits
   - Features research: FB group monitoring, sentiment analysis for Polish residential admin context
   - Architecture research: Apify → Next.js API routes → Supabase integration, polling job pattern
   - Pitfalls research: FB scraping legal/ToS, Apify cookie expiration, Polish sentiment accuracy

2. **Define requirements** — scope FB Analyzer features, create REQUIREMENTS.md (FB-* IDs)

3. **Create roadmap** — Phases 7-13 appended to ROADMAP.md (continuing from email-analyzer Phase 6)

4. **Plan Phase 7** — `/gsd:plan-phase 7` (Fundament: DB + Types + Navigation)

### Reference plan:
See: `C:\Users\dariu\.claude\plans\lexical-marinating-blossom.md` — full architecture plan

### Parallel track (v1.0 Email Analyzer — COMPLETE with known gaps):
v1.0 Phases 1-6 zaimplementowane. Fazy 3-6 fast-tracked w commicie 1f853d6 (2026-02-11).
Pozostale braki:
  1. Eksport .docx/.pdf (Phase 5) — do zaimplementowania
  2. Evaluation criteria UI (Phase 4) — tabela istnieje, brak UI
  3. Azure Admin Consent — czeka na administratora TAG Polska
