---
phase: 08-group-management
plan: 01
subsystem: database
tags: [sql, migration, typescript, fb-settings, soft-delete]
dependency-graph:
  requires: [07-01]
  provides: [fb_settings-table, fb_groups-extended-schema, fb-types-phase8]
  affects: [08-02, 08-03, 08-04]
tech-stack:
  added: []
  patterns: [soft-delete-via-deleted_at, key-value-settings-table, enriched-type-pattern]
key-files:
  created:
    - supabase/migrations/20260212_08_01_fb_groups_settings.sql
  modified:
    - src/types/fb.ts
decisions:
  - id: "08-01-01"
    description: "fb_settings jako key-value store (nie osobne kolumny) — elastycznosc dla nowych kluczy"
  - id: "08-01-02"
    description: "FbGroupEnriched extends FbGroup — pola obliczane oddzielone od modelu DB"
  - id: "08-01-03"
    description: "FbSettingsKey union type z template literal — developer_instruction:{name}"
metrics:
  duration: "~3 min"
  completed: "2026-02-12"
---

# Phase 8 Plan 01: Data Foundation (SQL + Types) Summary

**One-liner:** ALTER TABLE fb_groups (ai_instruction, deleted_at, cookies_encrypted) + CREATE TABLE fb_settings (key-value config) + TypeScript types (FbSettings, FbGroupEnriched, FbSettingsKey)

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Migracja SQL — ALTER TABLE fb_groups + CREATE TABLE fb_settings | `12f7607` | `supabase/migrations/20260212_08_01_fb_groups_settings.sql` |
| 2 | Aktualizacja typow TypeScript — FbGroup + FbSettings | `df561a6` | `src/types/fb.ts` |

## What Was Built

### SQL Migration (`20260212_08_01_fb_groups_settings.sql`)
- **ALTER TABLE fb_groups**: 3 nowe kolumny
  - `ai_instruction TEXT` — instrukcja AI per grupa (co szukac w postach)
  - `deleted_at TIMESTAMPTZ` — soft delete (NULL = aktywna)
  - `cookies_encrypted TEXT` — override FB cookies per grupa (AES-256-GCM)
- **CREATE INDEX** `idx_fb_groups_deleted_at` — przyspieszenie filtrowania aktywnych grup
- **CREATE TABLE fb_settings**: key-value store (6 kolumn)
  - Klucze: `apify_token`, `fb_cookies` (encrypted), `apify_actor_id`, `developer_instruction:{name}` (plain)
- **Trigger** `fb_settings_updated_at` — reuse `update_updated_at_column()`
- **RLS policy** "Admin full access on fb_settings" — admin-only (wzorzec z Phase 7)

### TypeScript Types (`src/types/fb.ts`)
- **FbGroup** — rozszerzony o 3 nowe pola (ai_instruction, deleted_at, cookies_encrypted)
- **FbSettings** — nowy interfejs odzwierciedlajacy tabele fb_settings
- **FbGroupEnriched** — extends FbGroup o pola obliczane (relevant_posts, has_custom_cookies)
- **FbSettingsKey** — union type z template literal dla kluczy konfiguracji

## Decisions Made

1. **fb_settings jako key-value store** — zamiast osobnych kolumn/tabel, jeden elastyczny store. Nowe klucze konfiguracji nie wymagaja migracji.
2. **FbGroupEnriched extends FbGroup** — pola obliczane (np. relevant_posts) oddzielone od modelu bazodanowego. API zwraca enriched, DB przechowuje base.
3. **FbSettingsKey union type** — template literal `developer_instruction:${string}` pozwala na typesafe klucze dynamiczne.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- [x] Plik SQL istnieje w supabase/migrations/
- [x] ALTER TABLE fb_groups dodaje 3 kolumny (ai_instruction, deleted_at, cookies_encrypted)
- [x] CREATE TABLE fb_settings z 6 kolumnami + trigger + RLS
- [x] FbGroup interface ma 3 nowe pola
- [x] FbSettings interface istnieje
- [x] FbGroupEnriched interface rozszerza FbGroup
- [x] `npx tsc --noEmit` przechodzi bez bledow

## Next Phase Readiness

- Migracja SQL gotowa do wklejenia w Supabase SQL Editor
- Typy TS gotowe dla planow 08-02 (API routes), 08-03 (UI), 08-04 (settings UI)
- Brak blockerow
