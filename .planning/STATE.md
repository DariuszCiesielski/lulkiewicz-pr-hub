# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** AI analizuje tysiace maili i generuje raport oceniajacy jakosc komunikacji administracji osiedli z mieszkancami
**Current focus:** Phase 1 — Hub Shell & Fundament (Wave 1 complete, Wave 2 in progress)

## Current Position

Phase: 1 of 6 (Hub Shell & Fundament)
Plan: 1 of 3 in current phase (01-01 COMPLETE)
Status: EXECUTING — Wave 1 done, Wave 2 next (01-02 + 01-03)
Last activity: 2026-02-10 — Plan 01-01 executed (2 tasks, 2 commits)

Progress: [######..............] 33%

## Planning Status

**Phase 1 plans (3 plans, 2 waves):**
- [x] 01-01-PLAN.md (Wave 1) — Scaffold Next.js + Supabase Auth ✓ (f6e644a, 1a4150e)
- [ ] 01-02-PLAN.md (Wave 2) — System rol admin/user + panel admina
- [ ] 01-03-PLAN.md (Wave 2) — Hub UI: grid, sidebar, design system, footer

## Accumulated Context

### Decisions

- [Roadmap]: 6 faz sekwencyjnych — Hub Shell -> Email Connection -> Threading -> AI Analysis -> Reports -> Dashboard
- [Roadmap]: Discovery call z klientem (typ skrzynki O365 vs on-premise) jest pierwszym zadaniem Phase 2
- [Planning]: Next.js App Router (nie Vite) — API routes potrzebne server-side
- [Planning]: @supabase/ssr (nie stary auth-helpers) — nowoczesny pattern
- [Planning]: Wlasny ThemeContext (nie next-themes) — 6 motywow, nie tylko dark/light
- [Planning]: Jezyk TYLKO PL — brak i18n, hardcoded polskie teksty
- [Planning]: Supabase CLI broken — migracje przez Management API
- [01-01]: Tailwind CSS v4 (nie v3) — default create-next-app dla Next.js 16
- [01-01]: Next.js 16 middleware deprecation warning — non-blocking, proxy migration later
- [01-01]: Istniejace tabele Supabase (organizations, emails, threads, etc.) zachowane dla pozniejszych faz

### Pending Todos

- ~~Fix 3 blockers in Phase 1 plans~~ DONE
- ~~Execute plan 01-01~~ DONE
- Execute plans 01-02 + 01-03 (Wave 2)

### Blockers/Concerns

- ~~[Phase 1]: Supabase project needs EU region — RESOLVED (eu-north-1 Stockholm)~~
- [Phase 2]: Typ skrzynki (O365 vs on-premise Exchange) nieznany — wymaga discovery call
- [Phase 2]: GDPR — Supabase EU region ustawiony (eu-north-1)
- [Phase 4]: DPA z OpenAI moze byc wymagane

## Infrastructure

| Service | Name | URL / ID |
|---------|------|----------|
| GitHub | lulkiewicz-pr-hub | https://github.com/DariuszCiesielski/lulkiewicz-pr-hub |
| Vercel | lulkiewicz-pr-hub | Project ID: `prj_plqtl56Fo28Jlr3PNXKFozq2E91s` |
| Supabase | Lulkiewicz PR | ref: `zyqewiqtnxrhkaladoah`, region: eu-north-1 |

- **Branch:** `master`
- **Auto-deploy:** GitHub → Vercel (połączony)
- **Supabase URL:** https://zyqewiqtnxrhkaladoah.supabase.co

## Session Continuity

Last session: 2026-02-10 (sesja 9)
Stopped at: Plan 01-01 complete, Wave 2 next
Resume with: Continue executing Wave 2 (01-02 + 01-03)

### What to do on resume:
1. Execute plan 01-02 (system rol + panel admina) — needs app_allowed_users table + API routes + admin UI
2. Execute plan 01-03 (Hub UI) — needs design system, sidebar, grid, footer [has checkpoint]
3. Both are Wave 2 — can run in parallel
