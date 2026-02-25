# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Hub narzędziowy — AI analizuje maile (email-analyzer) i posty z grup FB (fb-analyzer) dla audytu komunikacji administracji osiedli
**Current focus:** Milestone v1.1 — FB Analyzer. Phases 7-10 COMPLETE. Phase 12 (FB Reports) 6/8 tasks done. Analysis Profiles v2 COMPLETE. Default developer AI instructions added. Mock data removed — all FB pages use real Supabase data.

## Current Position

Phase: Phase 10 (AI Sentiment Analysis) — COMPLETE
Plan: 3 of 3
Status: All plans COMPLETE. Phase 10 done. v1.0.10 tagged & deployed.
Last activity: 2026-02-25 — Vercel Pro upgrade (maxDuration 300s, AI timeout 240s), report generation fixes, DOCX table fix

### Side Task: Analysis Profiles v2 (DB-driven)
Status: ALL 6 PHASES COMPLETE
Plan: .claude/plans/recursive-hopping-book.md
Handoff: docs/HANDOFF-2026-02-25-D.md (+ bazowy docs/HANDOFF-2026-02-25.md + docs/HANDOFF-2026-02-24-v2.md)
Progress: 6/6 faz
- [x] Faza A: Schemat DB + seed migracja (applied to Supabase)
- [x] Faza B: API profili CRUD + profile-loader.ts
- [x] Faza C: Pipeline integration (per-section model override)
- [x] Faza D: UI strona promptow z profilem (profile dropdown, CRUD, thread prompt editor, AI config, focus prompts, seed reset)
- [x] Faza E: UI dropdown na stronie analizy + mailbox form + dynamiczny badge
- [x] Faza F: Czyszczenie (PROFILE_OPTIONS usunięty, unused imports) + build OK
Parallel: CC Thread Filtering (docs/plans/2026-02-24-cc-thread-filtering-plan.md) — brak blokujących konfliktów

Progress (v1.0 Email Analyzer): [####################] 100% (Phases 1-6 + Phase 2.1 + Phase 2.2 ALL COMPLETE)
Progress (v1.1 FB Analyzer): [###################.] 92% (phases 7-10 COMPLETE, phase 12 75% done, phase 11 pending)

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

**Phase 2.2 plans (4 plans, 2 waves) — ALL COMPLETE:**
- [x] 02.2-01-PLAN.md (Wave 1, autonomous) — Thread Intelligence: AI summary per wątek, ulepszone statusy, persisted mailbox (d5cee2a, 8ad58e6, 1e67f83, 3f2d708, 4f42b83)
- [x] 02.2-02-PLAN.md (Wave 1, autonomous) — Analysis UX: date presets, spinner+ETA, dźwięk, historia analiz (27cb22b, b7b9d60, d4659db, 2bd0bcc)
- [x] 02.2-03-PLAN.md (Wave 2, checkpoint) — Synthetic Reports: AI REDUCE, formatowanie, nazwy DOCX (427b15e, 36c5b09, ecc1517, 0d56339, 51646c3)
- [x] 02.2-04-PLAN.md (Wave 2, autonomous) — UI/UX Polish: kontrast WCAG AA, nawigacja, prompt CRUD, podglad klucza API (0697333, a23305e, 4a1a902, 0c99fda)

**Phase 8 plans (4 plans, 3 waves) — ALL COMPLETE:**
- [x] 08-01-PLAN.md (Wave 1, autonomous) — Data foundation: ALTER fb_groups + CREATE fb_settings + TS types (12f7607, df561a6)
- [x] 08-02-PLAN.md (Wave 2, autonomous) — Group CRUD API routes: 5 endpoints, bulk ops, encrypted settings (db07756, 74bc879)
- [x] 08-03-PLAN.md (Wave 3, autonomous) — Groups UI: tabela, modal CRUD, bulk upload, bulk toolbar (a9c787d, 049c10d)
- [x] 08-04-PLAN.md (Wave 3, autonomous) — Settings UI: Apify token, cookies, actor ID, AI instructions (b1211a3)

**Phase 9 plans (4 plans, 2 waves) — ALL COMPLETE (incl. gap closure):**
- [x] 09-01-PLAN.md (Wave 1, autonomous) — Apify client + post mapper + scraping types (b1c3606, 30780e8)
- [x] 09-02-PLAN.md (Wave 1, autonomous) — Scrape API routes: start, process(3-mode), status (7d568d4, 2c1efac)
- [x] 09-03-PLAN.md (Wave 2, autonomous) — Scrape UI: useScrapeJob hook, ScrapeProgress, ScrapeButton (5ef5572, 2ebc558)
- [x] 09-04-PLAN.md (Wave 1, autonomous, gap closure) — Cookie health check: pre-scrape validation (aa9aaf3, fe9f981)

**Phase 10 plans (3 plans, 2 waves) — ALL COMPLETE:**
- [x] 10-01-PLAN.md (Wave 1, autonomous) — AI Foundation: SQL migration, callAI responseFormat, fb-analysis-prompt, fb-keywords, default-prompts (f9ded10, 748ecbb)
- [x] 10-02-PLAN.md (Wave 2, autonomous) — API routes: create job, process batch, pause/resume/cancel (1ca8658, 066bc3b)
- [x] 10-03-PLAN.md (Wave 2, autonomous) — UI: useFbAnalysisJob hook, FbAnalysisPanel, keywords settings (c835b15, 53d2ea0)

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
- [02-03]: Safety timeout 240s (Vercel Pro limit 300s, 60s bufor)
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
- [09-01]: Native fetch() zamiast apify-client npm — 3 endpointy nie uzasadniaja 12 deps / 2.8 MB
- [09-01]: ApifyActorInput z dot-notation key scrapeGroupPosts.groupUrl (zweryfikowane z N8N)
- [09-01]: formatApifyDate bez leading zero (yyyy-M-dd) — format wymagany przez aktora
- [09-01]: MappedFbPost/MappedFbComment osobne od FbPost/FbComment — mapper tworzy rows do upsert
- [09-01]: extractFacebookPostId: 3 patterny URL + fallback na caly URL (nigdy pusty string)
- [09-01]: logRawPostSample debug helper — weryfikacja schematu aktora przy pierwszym scrapowaniu
- [09-02]: datasetId z getRunStatus() response (defaultDatasetId) zamiast kodowania w apify_run_id
- [09-02]: loadToken osobny helper od loadScrapeConfig — MODE 2/3 potrzebuja tylko token
- [09-02]: Pre-flight config check w start route — walidacja token+cookies przed tworzeniem joba
- [09-02]: Upsert errors logowane ale nie failuja joba — partial progress zachowany
- [09-02]: Per-group cookie override: group.cookies_encrypted > fb_settings.fb_cookies
- [09-03]: useScrapeJob polling: 5s for running (Apify), 2s for downloading (upsert) — differentiated intervals
- [09-03]: Bulk scrape with 180-360s random delay between groups — client-side rate limiting
- [09-03]: ScrapeProgress extended with isWaitingBetweenGroups + waitSecondsRemaining (not new status value)
- [09-03]: scrapingGroupId tracked in page state for reliable GroupTable prop (not derived from progress.currentGroup)
- [09-04]: Cookie health check only on single scrape (not bulk) — bulk pausing per-group would be disruptive
- [09-04]: scrapeUntil=today for minimal Apify run (no maxPosts param in ApifyActorInput)
- [09-04]: 45s poll timeout with 15s Vercel buffer for health check endpoint
- [09-04]: Proceed-after-warning override — user can skip failed check (false positives possible)
- [10-01]: callAI() rozszerzony o opcjonalny 4. parametr responseFormat (backward compatible)
- [10-01]: JSON schema strict:true — gwarantowany structured output z OpenAI API
- [10-01]: System prompt eksplicytnie obsluguje PL sarkazm, kolokwializmy, pasywno-agresywny ton (8+ przykladow)
- [10-01]: fb_keywords w fb_settings jako value_plain (JSON array) — nie szyfrowane
- [10-01]: FB prompt zarejestrowany w DEFAULT_PROMPTS z section_order: 100 (po emailowych 0-13)
- [10-01]: FbAnalysisStatus rozszerzony o paused + metadata JSONB — wzorzec z sync_jobs
- [10-02]: forceReanalyze persisted w job.metadata JSONB — process route czyta z DB (nie request body)
- [10-02]: Pre-filter <20 chars jako nieistotne bez AI call — oszczednosc kosztow API
- [10-02]: AI errors per post logowane ale nie failuja joba — graceful degradation
- [10-02]: Keyword boost +1-2 w process route (nie w prompcie) — deterministyczne scoring
- [10-02]: Prompt override z prompt_templates DB, fallback na hardcoded defaults
- [10-03]: useFbAnalysisJob uproszczony vs useAnalysisJob — bez ETA, startedAt, processedAtStart (FB analysis szybsza)
- [10-03]: FbAnalysisPanel jako osobny komponent (reusable) z group select, progress bar, pause/resume, recent jobs
- [10-03]: Keywords parse: split by comma + newline, trim, lowercase, unique — robust input handling
- [10-03]: Prompt preview readonly z linkiem do /email-analyzer/prompts (existing page, new tab)
- [10-03]: fb_keywords w GET response z JSON.parse + try/catch (graceful na corrupted data)

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
- [02.2-03]: Two-level AI synthesis: single-pass <=100 watkow, batch 30 + meta-synthesis >100
- [02.2-03]: Promise.allSettled per sekcja raportu (parallel synthesis, Vercel 60s timeout)
- [02.2-03]: Globalny prompt raportu: report_global w prompt_templates jako kontekst syntezy
- [02.2-03]: DOCX filename: Raport_typ_skrzynka_daty.docx z polskimi znakami
- [02.2-03]: Spis tresci z anchor links per sekcja, CSS formatting .report-content
- [Cost tracking]: Exact cost (prompt_tokens + completion_tokens) zamiast blended rate estimate
- [Cost tracking]: pricing.ts — 10 modeli, 3 providerzy (OpenAI GPT-5.x, Anthropic Claude 4.x, Google Gemini 2.5/3)
- [Cost tracking]: Legacy fallback — stare dane bez split tokens uzywaja blended rate 70/30
- [Cost tracking]: SQL migration: prompt_tokens, completion_tokens, cost_usd na analysis_results
- [v1.0.3]: Report generation respects in_internal_report/in_client_report flags from prompt_templates DB
- [v1.0.3]: _global_context excluded from report synthesis (context only, loaded as globalContext)
- [v1.0.3]: Global context loaded from _global_context in prompt_templates (not report_global)
- [v1.0.3]: DELETE /api/reports/[id] — cascade delete sections + report
- [v1.0.3]: Demo badges removed from Sidebar (production mode)
- [v1.0.4]: Report sections overhaul — 7 sekcji zastąpione 13 sekcjami wg wymagań klienta (Struktura_2in1 + All_bez_struktury)
- [v1.0.4]: Nowe sekcje: metadata_analysis, response_speed, service_effectiveness, client_relationship, communication_cycle, client_feedback, expression_form, recipient_clarity, organization_consistency, proactive_actions, internal_communication, data_security, recommendations
- [v1.0.4]: Usunięte sekcje: summary, communication_quality, response_time, case_status, contact_info, gdpr_compliance
- [v1.0.4]: Raport kliencki: 12 sekcji (bez internal_communication), raport wewnętrzny: 13 sekcji
- [v1.0.4]: Istniejące analizy niekompatybilne z nowymi sekcjami — wymaga ponownego uruchomienia analizy AI

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

organizations, organization_members, **mailboxes** (extended: +8 cols, sync_status TEXT), mailbox_credentials, **emails** (extended: +13 cols + folder_id TEXT, UNIQUE mailbox+internet_message_id), threads, reports, report_sections, section_templates, schedules, messages, app_allowed_users, **sync_jobs** (new: status, job_type, page_token, emails_fetched, metadata JSONB), **email_threads** (Phase 3: Union-Find threading, +summary TEXT Phase 2.2), **analysis_jobs** (Phase 4: AI analysis jobs), **analysis_results** (Phase 4: per-thread results), **prompt_templates** (Phase 4: customizable prompts, +in_internal_report BOOLEAN, +in_client_report BOOLEAN Phase 2.2), **evaluation_criteria** (Phase 4: scoring rubrics, no UI yet), **fb_groups** (Phase 7+8: grupy FB, +ai_instruction, +deleted_at, +cookies_encrypted), **fb_posts** (Phase 7: posty z grup, UNIQUE group+facebook_post_id), **fb_comments** (Phase 7: komentarze do postow), **fb_scrape_jobs** (Phase 7: zadania scrapowania Apify), **fb_analysis_jobs** (Phase 7: zadania analizy AI postow, +metadata JSONB +paused status Phase 10), **fb_reports** (Phase 7: raporty z analizy grup FB), **fb_settings** (Phase 8: key-value config store, RLS admin-only)

## Session Continuity

Last session: 2026-02-25
Stopped at: v1.1.1 deployed — FB Reports (phase 12) 6/8 tasks, default developer AI instructions, Vercel Pro.
Resume file: docs/HANDOFF-2026-02-25-G.md
Next step: /gsd:discuss-phase 11 (FB Dashboard Analytics) or finish phase 12 remaining 2 tasks
Version tag: v1.1.1
SQL migration 20260223_10_01 APPLIED (paused status + metadata JSONB on fb_analysis_jobs)
SQL migration 20260225_case_analytics_prompts_update pending commit
