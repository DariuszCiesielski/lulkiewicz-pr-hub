---
phase: 07-fb-foundation
plan: 02
subsystem: navigation
tags: [next.js, routing, sidebar, shell-pages, fb-analyzer]
dependency-graph:
  requires: [07-01]
  provides: [fb-analyzer-routes, fb-analyzer-nav, shell-pages]
  affects: [07-03, 08, 09, 10, 11, 12]
tech-stack:
  added: []
  patterns: [shell-page-pattern, module-layout-pattern, redirect-pattern]
key-files:
  created:
    - src/app/(hub)/fb-analyzer/layout.tsx
    - src/app/(hub)/fb-analyzer/page.tsx
    - src/app/(hub)/fb-analyzer/dashboard/page.tsx
    - src/app/(hub)/fb-analyzer/groups/page.tsx
    - src/app/(hub)/fb-analyzer/posts/page.tsx
    - src/app/(hub)/fb-analyzer/analyze/page.tsx
    - src/app/(hub)/fb-analyzer/reports/page.tsx
    - src/app/(hub)/fb-analyzer/settings/page.tsx
  modified:
    - src/config/tools.ts
    - src/components/layout/Sidebar.tsx
decisions:
  - id: nav-icons
    description: "Ikony FB children: BarChart3 (Dashboard), Users (Grupy), MessageSquare (Posty), Brain (Analiza), ClipboardList (Raporty), Cog (Ustawienia)"
  - id: all-admin-only
    description: "Wszystkie children FB Analyzer maja adminOnly: true (wzorzec z email-analyzer)"
metrics:
  duration: "2m 23s"
  completed: 2026-02-12
---

# Phase 7 Plan 2: FB Analyzer Navigation & Shell Pages Summary

**One-liner:** Aktywacja fb-analyzer na hub grid, sidebar z 6 children, layout + redirect + 6 shell pages z placeholderami

## Tasks Completed

| # | Task | Type | Commit | Key Changes |
|---|------|------|--------|-------------|
| 1 | Aktywacja fb-analyzer w tools.ts + nawigacja sidebar | auto | 4646ff5 | tools.ts: active=true, comingSoon=false; Sidebar: 6 children z ikonami |
| 2 | Layout FB + redirect + 6 stron shell | auto | 14bc39d | 8 nowych plikow: layout, redirect, 6 shell pages |

## Decisions Made

1. **Ikony nawigacji FB** — BarChart3 (Dashboard), Users (Grupy), MessageSquare (Posty), Brain (Analiza), ClipboardList (Raporty), Cog (Ustawienia) — spatne z wzorcem email-analyzer
2. **adminOnly na children** — Wszystkie 6 children FB Analyzer maja `adminOnly: true`, zgodnie ze wzorcem email-analyzer
3. **ToolId** — Typ `fb-analyzer` juz istnial w `src/types/index.ts`, nie wymagal zmian

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- [x] TypeScript: `tsc --noEmit --strict` przechodzi bez bledow
- [x] Build: `npm run build` przechodzi — wszystkie 6 stron fb-analyzer widoczne w output
- [x] tools.ts: fb-analyzer ma `active: true` i `comingSoon: false`
- [x] Sidebar: NAV_ITEMS zawiera wpis `/fb-analyzer` z 6 children
- [x] Wszystkie ikony zaimportowane z lucide-react (Users dodany)

## Files Created/Modified

### Created (8 files)
- `src/app/(hub)/fb-analyzer/layout.tsx` — Client wrapper (identyczny wzorzec jak email-analyzer)
- `src/app/(hub)/fb-analyzer/page.tsx` — Redirect /fb-analyzer -> /fb-analyzer/dashboard
- `src/app/(hub)/fb-analyzer/dashboard/page.tsx` — Shell: Dashboard FB
- `src/app/(hub)/fb-analyzer/groups/page.tsx` — Shell: Grupy FB
- `src/app/(hub)/fb-analyzer/posts/page.tsx` — Shell: Posty
- `src/app/(hub)/fb-analyzer/analyze/page.tsx` — Shell: Analiza AI
- `src/app/(hub)/fb-analyzer/reports/page.tsx` — Shell: Raporty FB
- `src/app/(hub)/fb-analyzer/settings/page.tsx` — Shell: Ustawienia FB

### Modified (2 files)
- `src/config/tools.ts` — fb-analyzer: active=true, comingSoon=false
- `src/components/layout/Sidebar.tsx` — Dodany wpis FB Analyzer z 6 children + import Users

## Next Phase Readiness

Plan 07-03 (Supabase schema: fb_groups, fb_scrape_jobs) moze byc realizowany niezaleznie — shell pages sa gotowe do podlaczenia danych z Supabase w kolejnych fazach.
