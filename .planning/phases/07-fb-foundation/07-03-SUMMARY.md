---
phase: 07-fb-foundation
plan: 03
subsystem: api-infrastructure
tags: [refactoring, admin-utilities, shared-module, api-routes]
dependency-graph:
  requires: ["07-01", "07-02"]
  provides: ["shared-admin-module", "deduplicated-api-routes"]
  affects: ["08-*", "09-*", "10-*", "11-*", "12-*"]
tech-stack:
  added: []
  patterns: ["shared-utility-module", "centralized-admin-auth"]
key-files:
  created:
    - src/lib/api/admin.ts
  modified:
    - src/app/api/mailboxes/route.ts
    - src/app/api/mailboxes/[id]/route.ts
    - src/app/api/mailboxes/[id]/test-connection/route.ts
    - src/app/api/sync/route.ts
    - src/app/api/sync/process/route.ts
    - src/app/api/sync/status/[jobId]/route.ts
    - src/app/api/threads/route.ts
    - src/app/api/threads/[id]/route.ts
    - src/app/api/threads/build/route.ts
    - src/app/api/analysis/route.ts
    - src/app/api/analysis/process/route.ts
    - src/app/api/analysis/status/[jobId]/route.ts
    - src/app/api/reports/route.ts
    - src/app/api/reports/[id]/route.ts
    - src/app/api/prompts/route.ts
    - src/app/api/ai-config/route.ts
    - src/app/api/dashboard/route.ts
    - src/app/api/admin/users/route.ts
    - src/app/api/admin/create-user/route.ts
    - src/app/api/dev/clear/route.ts
    - src/app/api/dev/seed/route.ts
decisions:
  - id: "07-03-01"
    decision: "Shared module pattern z lazy init getAdminClient() i async verifyAdmin()"
    rationale: "Eliminacja 21 kopii identycznego kodu, single source of truth"
metrics:
  duration: "~7 min"
  completed: "2026-02-12"
  lines-removed: 483
  lines-added: 53
  files-changed: 22
---

# Phase 7 Plan 03: Shared Admin Utilities Module Summary

**One-liner:** Ekstrakcja verifyAdmin()/getAdminClient() do src/lib/api/admin.ts i zamiana 21 lokalnych kopii na import z shared module.

## What Was Done

### Task 1: Utworzenie shared module (d40d07d)
- Utworzono `src/lib/api/admin.ts` z eksportowanymi `getAdminClient()` i `verifyAdmin()`
- Zachowano lazy init pattern (wymog Vercel cold start)
- Zachowano SSR cookie sync via `createClient as createServerClient` z `@/lib/supabase/server`
- JSDoc komentarze dla obu funkcji

### Task 2: Aktualizacja 21 API routes (9880239)
- Usunieto lokalne definicje `getAdminClient()` i `verifyAdmin()` z 21 plikow
- Dodano import `{ verifyAdmin, getAdminClient } from '@/lib/api/admin'` w kazdym
- Usunieto nieuzywane importy `createClient` z `@supabase/supabase-js` i `@/lib/supabase/server`
- Zero zmian w logice biznesowej -- czysty refaktoring importow
- Build przechodzi bez bledow

## Verification Results

| Check | Result |
|-------|--------|
| `function getAdminClient()` w API routes | 0 plikow (usuniety ze wszystkich) |
| `function verifyAdmin()` w API routes | 0 plikow (usuniety ze wszystkich) |
| `from '@/lib/api/admin'` w API routes | 21 plikow (wszystkie korzystaja) |
| `npm run build` | PASS -- zero bledow |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Shared module pattern** -- `src/lib/api/admin.ts` jako jedyne zrodlo `verifyAdmin()` i `getAdminClient()`. Nowe FB API routes (fazy 8-12) importuja z tego samego miejsca.

## Impact

- **-483 linii kodu** -- usuniety zduplikowany boilerplate
- **+53 linii** -- shared module + importy
- **Netto: -430 linii** -- znaczaca redukcja duplikacji
- Przyszle API routes wymagaja 1 linjki importu zamiast 20+ linii boilerplate

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d40d07d | refactor | Create shared admin utilities module |
| 9880239 | refactor | Replace local admin utilities with shared module in 21 API routes |

## Next Phase Readiness

Phase 7 COMPLETE. Wszystkie 3 plany zrealizowane:
- 07-01: Fundament danych (SQL + typy TS)
- 07-02: Nawigacja FB Analyzer (sidebar + shell pages)
- 07-03: Shared admin module (refaktoring 21 routes)

Gotowe do Phase 8 (FB Groups CRUD) -- nowe routes moga importowac `{ verifyAdmin, getAdminClient }` z `@/lib/api/admin`.
