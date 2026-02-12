---
phase: 08-group-management
plan: 02
subsystem: fb-api
tags: [api, crud, encryption, bulk-operations, supabase, admin]
dependency_graph:
  requires: ["08-01"]
  provides: ["fb-groups-api", "fb-settings-api", "bulk-operations", "encrypted-settings"]
  affects: ["08-03", "08-04", "09"]
tech_stack:
  added: []
  patterns: ["verifyAdmin guard", "soft-delete filter", "encrypted settings", "bulk atomic ops", "super admin gate"]
key_files:
  created:
    - src/app/api/fb-groups/route.ts
    - src/app/api/fb-groups/[id]/route.ts
    - src/app/api/fb-groups/bulk/route.ts
    - src/app/api/fb-groups/developers/route.ts
    - src/app/api/fb-settings/route.ts
  modified: []
decisions:
  - "Record<string, unknown> cast for Supabase string-based selects (no generated types)"
  - "bulk ops filter .is('deleted_at', null) to prevent operating on soft-deleted groups"
  - "POST fb-settings validates key prefix — only allowed keys accepted"
metrics:
  duration: "~5 min"
  completed: "2026-02-12"
---

# Phase 8 Plan 02: FB Groups API Routes Summary

**One-liner:** 5 API route files covering full CRUD, bulk operations, developer autosuggest, and encrypted settings with AES-256-GCM via shared admin module.

## Tasks Completed

### Task 1: CRUD API routes for fb-groups (db07756)

Created 3 API route files following the mailboxes pattern (verifyAdmin + getAdminClient):

**`src/app/api/fb-groups/route.ts`** (GET list + POST single/bulk):
- GET: filtry `?developer=X&status=active|paused`, enriched z `relevant_posts` (count fb_posts) i `has_custom_cookies` (boolean)
- POST single: walidacja name + facebook_url regex, insert + return 201
- POST bulk: body `{ urls: [], developer? }`, max 100 URLs, duplikaty wykrywane pre-insert (DB + batch), extractGroupName z URL path

**`src/app/api/fb-groups/[id]/route.ts`** (GET detail + PATCH update + DELETE soft):
- GET: enriched detail z relevant_posts i has_custom_cookies
- PATCH: dozwolone pola (name, facebook_url, developer, status, ai_instruction, cookies_encrypted, apify_actor_id), encryption dla cookies, super admin gate na actor_id
- DELETE: soft delete (ustawia deleted_at)

**`src/app/api/fb-groups/developers/route.ts`** (GET distinct):
- Deduplikacja w JS, sortowanie po polsku (localeCompare 'pl')

### Task 2: Bulk operations + fb-settings (74bc879)

**`src/app/api/fb-groups/bulk/route.ts`** (PATCH):
- 3 akcje: set_status (active/paused), set_developer, soft_delete
- Atomowe operacje: `.in('id', ids)` zamiast petli
- Dodano `.is('deleted_at', null)` — nie operuje na juz usunietych grupach

**`src/app/api/fb-settings/route.ts`** (GET + POST):
- GET: zwraca `has_apify_token` (bool), `has_fb_cookies` (bool), `apify_actor_id` (string), `developer_instructions` (object) — NIGDY value_encrypted
- POST: upsert z onConflict='key', szyfrowanie AES-256-GCM dla apify_token/fb_cookies, plain text dla actor_id i developer_instruction:*
- Super admin gate na apify_actor_id
- Walidacja klucza — tylko dozwolone prefiksy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase typed client string-select casting**
- **Found during:** Task 1
- **Issue:** Supabase client returns `GenericStringError` type when using concatenated string selects (e.g., `GROUP_SELECT_COLUMNS + ', cookies_encrypted'`). Destructuring `{ cookies_encrypted, ...rest }` failed TypeScript compilation.
- **Fix:** Changed from concatenated string constants to inline full column lists, cast results as `Record<string, unknown>` for type safety
- **Files modified:** src/app/api/fb-groups/route.ts, src/app/api/fb-groups/[id]/route.ts
- **Commit:** db07756

**2. [Rule 2 - Missing Critical] Bulk ops filter soft-deleted groups**
- **Found during:** Task 2
- **Issue:** Plan specified `.in('id', ids)` without `.is('deleted_at', null)` — bulk operations could accidentally modify already soft-deleted groups
- **Fix:** Added `.is('deleted_at', null)` to all 3 bulk action queries
- **Files modified:** src/app/api/fb-groups/bulk/route.ts
- **Commit:** 74bc879

## Verification Results

- [x] 5 plikow API route istnieje w src/app/api/
- [x] Kazdy plik importuje z @/lib/api/admin
- [x] Kazdy GET/PATCH/DELETE na fb_groups filtruje `.is('deleted_at', null)`
- [x] GET fb-groups NIE zwraca cookies_encrypted
- [x] GET fb-settings zwraca boolean flagi, NIE encrypted values
- [x] POST fb-settings szyfruje apify_token i fb_cookies
- [x] PATCH fb-groups/bulk uzywa `.in('id', ids)`
- [x] Zmiana apify_actor_id wymaga super admin
- [x] `npx tsc --noEmit` przechodzi (0 errors)

## Commits

| Hash | Message |
|------|---------|
| db07756 | feat(08-02): CRUD API routes for fb-groups |
| 74bc879 | feat(08-02): bulk operations API + fb-settings with encryption |

## Next Phase Readiness

Plan 08-03 (Group Management UI) can now consume all 5 API endpoints:
- `GET/POST /api/fb-groups` — lista i tworzenie grup
- `GET/PATCH/DELETE /api/fb-groups/[id]` — szczegoly, edycja, usuwanie
- `PATCH /api/fb-groups/bulk` — operacje masowe
- `GET /api/fb-groups/developers` — autosuggest deweloperow
- `GET/POST /api/fb-settings` — konfiguracja Apify

No blockers for 08-03 or 08-04.
