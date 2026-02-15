# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Hub narzędziowy — AI analizuje maile (email-analyzer) i posty z grup FB (fb-analyzer) dla audytu komunikacji administracji osiedli
**Current focus:** Phase 2.2 (Email Analyzer Quality) — Plan 04 COMPLETE. Milestone v1.1 — FB Analyzer (phase 8 COMPLETE, ready for phase 9).

## Current Position

Phase: Phase 2.2 (Email Analyzer Quality) — Plan 04 COMPLETE
Plan: 4 of 4
Status: Plan 02.2-04 COMPLETE. Wave 2 done (02.2-03 may still be in progress in parallel).
Last activity: 2026-02-15 — Completed 02.2-04-PLAN.md (UI/UX Polish)

Progress (v1.0 Email Analyzer): [####################] 100% (Phases 1-6 + Phase 2.1 + Phase 2.2 COMPLETE)
Progress (v1.1 FB Analyzer): [########............] 40% (phases 7-8 COMPLETE, ready for phase 9)

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

**Phase 7 plans (3 plans, 2 waves) — ALL COMPLETE:**
- [x] 07-01-PLAN.md (Wave 1, autonomous) — Fundament danych: migracja SQL 6 tabel FB + typy TS (de508e7, d27709d)
- [x] 07-02-PLAN.md (Wave 1, autonomous) — Nawigacja FB Analyzer + shell pages (4646ff5, 14bc39d)
- [x] 07-03-PLAN.md (Wave 2, autonomous) — Shared admin module + refaktoring 21 API routes (d40d07d, 9880239)

**Phase 2.1 plans (3 plans, 2 waves) — ALL COMPLETE:**
- [x] 02.1-01-PLAN.md (Wave 1, autonomous) — Schema DB + graph-folders helper + email-fetcher all-folders endpoints (a487504, 7f7a227, 0bde990)
- [x] 02.1-02-PLAN.md (Wave 1, autonomous) — Sync API routes adaptacja + email-parser folder_id (3b3624b, d8c0874, b7db1b8)
- [x] 02.1-03-PLAN.md (Wave 2, autonomous) — Legenda statusow + polskie znaki diakrytyczne (c4ce978, b33137d, 56864cc, 153eaa4, 4868dbf, aec9b43)

**Phase 2.2 plans (4 plans, 2 waves) — IN PROGRESS:**
- [x] 02.2-01-PLAN.md (Wave 1, autonomous) — Thread Intelligence: AI summary per wątek, ulepszone statusy, persisted mailbox (d5cee2a, 8ad58e6, 1e67f83, 3f2d708, 4f42b83)
- [x] 02.2-02-PLAN.md (Wave 1, autonomous) — Analysis UX: date presets, spinner+ETA, dźwięk, historia analiz (27cb22b, b7b9d60, d4659db, 2bd0bcc)
- [ ] 02.2-03-PLAN.md (Wave 2, checkpoint) — Synthetic Reports: AI REDUCE, formatowanie, nazwy DOCX (parallel, may still be in progress)
- [x] 02.2-04-PLAN.md (Wave 2, autonomous) — UI/UX Polish: kontrast WCAG AA, nawigacja, prompt CRUD, podglad klucza API (0697333, a23305e, 4a1a902, 0c99fda)

**Phase 8 plans (4 plans, 3 waves) — ALL COMPLETE:**
- [x] 08-01-PLAN.md (Wave 1, autonomous) — Data foundation: ALTER fb_groups + CREATE fb_settings + TS types (12f7607, df561a6)
- [x] 08-02-PLAN.md (Wave 2, autonomous) — Group CRUD API routes: 5 endpoints, bulk ops, encrypted settings (db07756, 74bc879)
- [x] 08-03-PLAN.md (Wave 3, autonomous) — Groups UI: tabela, modal CRUD, bulk upload, bulk toolbar (a9c787d, 049c10d)
- [x] 08-04-PLAN.md (Wave 3, autonomous) — Settings UI: Apify token, cookies, actor ID, AI instructions (b1211a3)

## Accumulated Context

### Decisions

- [Roadmap]: 12 faz sekwencyjnych (v1.0: 1-6, v1.1: 7-12)
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
- [v1.1 milestone]: FB Analyzer = fb-analyzer w ToolId, fazy 7-12
- [v1.1 milestone]: Apify Actor: curious_coder/facebook-post-scraper (bezposrednio z PR Hub, bez n8n)
- [v1.1 milestone]: Supabase only (bez Airtable), reuse ai-provider.ts, reuse encrypt.ts
- [v1.1 milestone]: 6 tabel: fb_groups, fb_posts, fb_comments, fb_scrape_jobs, fb_analysis_jobs, fb_reports
- [v1.1 milestone]: Wzorce z Clicklease Hub (batch ops, filters, report generator) i Hotel Notera (export DOCX, analytics)
- [07-01]: Status/sentiment jako TEXT z CHECK (nie enum) — wzorzec z email-analyzer
- [07-01]: UNIQUE(group_id, facebook_post_id) na fb_posts — deduplikacja scrapowanych postow
- [07-01]: updated_at trigger (CREATE OR REPLACE) na fb_groups, fb_posts, fb_reports
- [07-02]: Ikony FB nav: BarChart3, Users, MessageSquare, Brain, ClipboardList, Cog
- [07-02]: Wszystkie children FB Analyzer = adminOnly: true (wzorzec email-analyzer)
- [07-03]: Shared admin module src/lib/api/admin.ts — verifyAdmin()+getAdminClient() w jednym miejscu
- [07-03]: Nowe FB routes importuja z @/lib/api/admin (nie kopiuja boilerplate)
- [08-01]: fb_settings jako key-value store (nie osobne kolumny) — elastycznosc dla nowych kluczy
- [08-01]: FbGroupEnriched extends FbGroup — pola obliczane oddzielone od modelu DB
- [08-01]: FbSettingsKey union type z template literal — developer_instruction:{name}
- [08-02]: Record<string, unknown> cast dla Supabase string-based selects (brak generated types)
- [08-02]: Bulk ops filtruja .is('deleted_at', null) — zapobiega operacjom na soft-deleted grupach
- [08-02]: POST fb-settings waliduje prefiks klucza — tylko dozwolone klucze akceptowane

- [Phase 2.1 INSERTED]: Multi-folder sync — /messages zamiast /mailFolders/inbox/messages
- [Phase 2.1]: Delta sync zmieniony na smart resync z $filter=receivedDateTime ge (delta per-folder only w Graph API)
- [Phase 2.1]: Excluded folders: drafts, junkemail, deleteditems (cached in sync_jobs.metadata)
- [Phase 2.1]: isIncoming() zmieniony na domain-based comparison (nie exact email match)
- [Phase 2.1]: Hotfixy wykonane w Cursor: deduplikacja batchy, paginacja 1000-row limit, batch thread building, totalInDatabase w UI
- [02.1-01]: parentFolderId dodany do MESSAGE_SELECT_FIELDS — identyfikacja folderu zrodlowego
- [02.1-01]: getMailboxMessageCount zmieniony na /messages z $count (ConsistencyLevel: eventual)
- [02.1-01]: fetchDeltaPage zachowany z @deprecated — backward compatibility do czasu migracji route
- [02.1-01]: filterExcludedFolders jako pure function — filtrowanie in-memory po pobraniu batcha
- [02.1-02]: folder_id dodany do Email interface, parsera i upsert rows — dane folderu zapisywane do bazy
- [02.1-02]: Delta sync walidacja zmieniona z delta_link na last_sync_at (sync/route.ts)
- [02.1-02]: Excluded folder IDs cachowane w sync_jobs.metadata — reuse miedzy batchami (1 API call per sync)
- [02.1-02]: fetchDeltaPage calkowicie usuniete z sync/process — zastapione fetchMessagesSince
- [02.1-03]: Legenda statusow zwijalna domyslnie (useState false) — minimalizacja zasmiecenia UI
- [02.1-03]: Kolory legendy identyczne z ThreadCard STATUS_STYLES (rgba)
- [02.1-03]: 60+ poprawek polskich znakow diakrytycznych w 9 plikach UI (plan mowil o 47 w 8 plikach, znaleziono wiecej)

- [02.2-01]: AI summary prompt zwraca JSON {summary, status} — 1 API call per watek
- [02.2-01]: Batch 5 watkow rownolegle via Promise.allSettled
- [02.2-01]: Graceful fallback — brak AI config = puste summary, status z heurystyki
- [02.2-01]: localStorage klucz 'ea-selected-mailbox' wspoldzielony miedzy threads/analyze/reports
- [02.2-01]: ThreadStatus rozszerzony: open, closed_positive, closed_negative, pending (+ legacy 'closed')
- [02.2-02]: Web Audio API oscillator dla dźwiękowego powiadomienia (nie base64 audio)
- [02.2-02]: ETA obliczane w AnalysisProgress z props startedAt (hook = dane, komponent = prezentacja)
- [02.2-02]: Historia analiz jako sekcja inline na stronie analyze (nie osobna strona)
- [02.2-02]: GET /api/analysis dodany do istniejącego route.ts obok POST (RESTful)
- [02.2-04]: textMuted w jasnych motywach: #64748b (default/corporate), #737373 (minimal) — WCAG AA >= 4.5:1
- [02.2-04]: Globalny prompt raportu: section_key='_global_context', section_order=0
- [02.2-04]: Reset button: zapisuje domyslne z default-prompts.ts do DB (nie tylko local)
- [02.2-04]: maskApiKey: 6 pierwszych + ... + 4 ostatnie znaki (decrypt server-side)
- [02.2-04]: Soft delete promptow: is_active=false, custom sections usuwalne, default nie
- [02.2-04]: Checkboxy in_internal_report/in_client_report per sekcja (SQL migration required)

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

## Supabase Tables (Phase 8 updated)

organizations, organization_members, **mailboxes** (extended: +8 cols, sync_status TEXT), mailbox_credentials, **emails** (extended: +13 cols + folder_id TEXT, UNIQUE mailbox+internet_message_id), threads, reports, report_sections, section_templates, schedules, messages, app_allowed_users, **sync_jobs** (new: status, job_type, page_token, emails_fetched, metadata JSONB), **email_threads** (Phase 3: Union-Find threading, +summary TEXT Phase 2.2), **analysis_jobs** (Phase 4: AI analysis jobs), **analysis_results** (Phase 4: per-thread results), **prompt_templates** (Phase 4: customizable prompts, +in_internal_report BOOLEAN, +in_client_report BOOLEAN Phase 2.2), **evaluation_criteria** (Phase 4: scoring rubrics, no UI yet), **fb_groups** (Phase 7+8: grupy FB, +ai_instruction, +deleted_at, +cookies_encrypted), **fb_posts** (Phase 7: posty z grup, UNIQUE group+facebook_post_id), **fb_comments** (Phase 7: komentarze do postow), **fb_scrape_jobs** (Phase 7: zadania scrapowania Apify), **fb_analysis_jobs** (Phase 7: zadania analizy AI postow), **fb_reports** (Phase 7: raporty z analizy grup FB), **fb_settings** (Phase 8: key-value config store, RLS admin-only)

## Session Continuity

Last session: 2026-02-15T13:45Z
Stopped at: Completed 02.2-04-PLAN.md (UI/UX Polish)
Resume file: .planning/phases/02.2-email-analyzer-quality/02.2-04-SUMMARY.md
Next step: Wait for 02.2-03 (Synthetic Reports) to complete, then Phase 9 (FB Scraping Engine)
