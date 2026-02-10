# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** AI analizuje tysiace maili i generuje raport oceniajacy jakosc komunikacji administracji osiedli z mieszkancami
**Current focus:** Phase 2 IN PROGRESS — plans 02-01 and 02-03 complete

## Current Position

Phase: 2 of 6 — IN PROGRESS
Plan: 2 of 4 complete (02-01, 02-03)
Status: Plans 02-01 (Fundament) and 02-03 (Sync Engine) complete, 02-02 in progress, 02-04 waiting
Last activity: 2026-02-10 — Completed 02-03-PLAN.md (email parser, email fetcher, sync API routes)

Progress: [########............] 40% (Phase 1 complete, Phase 2: 2/4 plans done)

## Planning Status

**Phase 1 plans (3 plans, 2 waves) — ALL COMPLETE:**
- [x] 01-01-PLAN.md (Wave 1) — Scaffold Next.js + Supabase Auth (f6e644a, 1a4150e, e055b5e)
- [x] 01-02-PLAN.md (Wave 2) — System rol admin/user + panel admina (f32245f)
- [x] 01-03-PLAN.md (Wave 2) — Hub UI: grid, sidebar, design system, footer (6954168)

**Phase 2 plans (4 plans, 3 waves) — IN PROGRESS:**
- [x] 02-01-PLAN.md (Wave 1, autonomous) — Fundament emailowy (b12e7b1, 1e5e4fe, 6602942)
- [ ] 02-02-PLAN.md (Wave 2, checkpoint) — Mailbox CRUD API + test connection + UI
- [x] 02-03-PLAN.md (Wave 2, autonomous) — Sync engine: email fetcher, parser, API routes (540fd72, 45e9adc)
- [ ] 02-04-PLAN.md (Wave 3, checkpoint) — useSyncJob hook, progress bar, full+delta sync UI

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
- [02-01]: organization_id/name/provider w mailboxes nullable (nowe mailboxy Phase 2 nie wymagaja org)
- [02-01]: Stare org-based RLS policies zastapione admin-based (app_allowed_users)
- [02-01]: Istniejace kolumny emails zachowane (external_id, thread_id) + nowe dodane obok
- [02-01]: Migracje SQL via Management API, pliki w supabase/migrations/ jako dokumentacja
- [02-03]: Upsert ON CONFLICT (mailbox_id, internet_message_id) dla deduplikacji emaili
- [02-03]: Safety timeout 50s (Vercel limit 60s, 10s bufor)
- [02-03]: 100 messages per batch via Graph API $top=100
- [02-03]: Delta link stored on mailbox for incremental sync
- [02-03]: No $select on @odata.nextLink (already contains params)

### Blockers/Concerns

- [Phase 2]: Azure App Registration needed — user must create before 02-02 checkpoint
- [Phase 4]: DPA z OpenAI moze byc wymagane

## Infrastructure

| Service | Name | URL / ID |
|---------|------|----------|
| GitHub | lulkiewicz-pr-hub | https://github.com/DariuszCiesielski/lulkiewicz-pr-hub |
| Vercel | lulkiewicz-pr-hub | Project ID: `prj_plqtl56Fo28Jlr3PNXKFozq2E91s`, Team: `team_wump0nNx40hMZqj8aowjblSw` |
| Supabase | Lulkiewicz PR | ref: `zyqewiqtnxrhkaladoah`, region: eu-north-1, URL: https://zyqewiqtnxrhkaladoah.supabase.co |

- **Branch:** `master`
- **Auto-deploy:** GitHub -> Vercel
- **Supabase Access Token:** sbp_719245360655623f2bd4b851f58f305360bdad17

## Supabase Tables (Phase 2 updated)

organizations, organization_members, **mailboxes** (extended: +8 cols, sync_status TEXT), mailbox_credentials, **emails** (extended: +13 cols, UNIQUE mailbox+internet_message_id), threads, reports, report_sections, section_templates, schedules, messages, app_allowed_users, **sync_jobs** (new: status, job_type, page_token, emails_fetched)

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 02-03-PLAN.md (2 tasks, 2 commits)
Resume file: None
Next: Complete 02-02-PLAN.md (Mailbox CRUD + UI), then 02-04-PLAN.md (Sync UI) — Wave 3
