# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Hub narzędziowy — AI analizuje maile (email-analyzer) i posty z grup FB (fb-analyzer) dla audytu komunikacji administracji osiedli
**Current focus:** Milestone v1.1 — FB Analyzer (defining requirements)

## Current Position

Phase: Not started (defining requirements for v1.1 FB Analyzer)
Plan: —
Status: Defining requirements
Last activity: 2026-02-11 — Milestone v1.1 started

Progress: [##########..........] 50% (Phase 1 complete, Phase 2: 3/4 plans done, 02-04 pending checkpoint)

## Planning Status

**Phase 1 plans (3 plans, 2 waves) — ALL COMPLETE:**
- [x] 01-01-PLAN.md (Wave 1) — Scaffold Next.js + Supabase Auth (f6e644a, 1a4150e, e055b5e)
- [x] 01-02-PLAN.md (Wave 2) — System rol admin/user + panel admina (f32245f)
- [x] 01-03-PLAN.md (Wave 2) — Hub UI: grid, sidebar, design system, footer (6954168)

**Phase 2 plans (4 plans, 3 waves) — IN PROGRESS:**
- [x] 02-01-PLAN.md (Wave 1, autonomous) — Fundament emailowy (b12e7b1, 1e5e4fe, 6602942)
- [x] 02-02-PLAN.md (Wave 2, checkpoint) — Mailbox CRUD API + test connection + UI (c7560f5, 95f07ae, 41dc226, d1930f2)
- [x] 02-03-PLAN.md (Wave 2, autonomous) — Sync engine: email fetcher, parser, API routes (540fd72, 45e9adc)
- [ ] 02-04-PLAN.md (Wave 3, checkpoint) — useSyncJob hook, progress bar, full+delta sync UI
  - Tasks 1-2 DONE: 2f22a50, 5b92531
  - Task 3 (checkpoint:human-verify): PENDING — user musi przetestować sync flow end-to-end

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

organizations, organization_members, **mailboxes** (extended: +8 cols, sync_status TEXT), mailbox_credentials, **emails** (extended: +13 cols, UNIQUE mailbox+internet_message_id), threads, reports, report_sections, section_templates, schedules, messages, app_allowed_users, **sync_jobs** (new: status, job_type, page_token, emails_fetched)

## Session Continuity

Last session: 2026-02-10
Stopped at: 02-04 tasks 1-2 done, checkpoint pending user approval
Resume file: None
Next:
  1. User approves 02-04 checkpoint (test sync flow) → "approved" lub opisz problemy
  2. Create 02-04-SUMMARY.md
  3. Phase 2 verification (gsd-verifier)
  4. Update ROADMAP.md → Phase 2 complete
  5. Offer Phase 3 planning
