---
phase: 10-ai-sentiment-analysis
plan: 01
subsystem: ai-analysis
tags: [ai, sentiment, prompt, keywords, structured-output, json-schema]
dependency-graph:
  requires: [phase-7-foundation, phase-8-group-management, phase-9-scraping-engine]
  provides: [fb-analysis-prompt, fb-keywords, callai-structured-output, sql-paused-metadata]
  affects: [10-02-api-routes, 10-03-ui]
tech-stack:
  added: []
  patterns: [structured-json-output, keyword-boosting, json-schema-response-format]
key-files:
  created:
    - supabase/migrations/20260223_10_01_fb_analysis_paused_metadata.sql
    - src/lib/fb/fb-analysis-prompt.ts
    - src/lib/fb/fb-keywords.ts
  modified:
    - src/lib/ai/ai-provider.ts
    - src/lib/ai/default-prompts.ts
    - src/types/fb.ts
    - src/app/api/fb-settings/route.ts
decisions:
  - "callAI() rozszerzony o opcjonalny responseFormat (4. parametr) — backward compatible"
  - "JSON schema z strict:true — gwarantowany structured output z OpenAI API"
  - "System prompt eksplicytnie obsluguje PL sarkazm, kolokwializmy, pasywno-agresywny ton"
  - "fb_keywords w fb_settings jako value_plain (JSON array) — nie szyfrowane"
  - "FB prompt zarejestrowany w DEFAULT_PROMPTS z section_order: 100 (po emailowych 0-13)"
  - "FbAnalysisStatus rozszerzony o paused — wzorzec z sync_jobs"
  - "metadata JSONB na fb_analysis_jobs — wzorzec identyczny jak sync_jobs"
metrics:
  duration: "4m 30s"
  completed: "2026-02-23"
---

# Phase 10 Plan 01: AI Foundation — Prompt, Keywords, Schema Summary

**Fundament AI dla analizy postow FB: structured JSON output, polski prompt do sentymentu, system slow kluczowych z per-group override i migracja SQL dla pause/resume.**

## What Was Built

### SQL Migration
- `20260223_10_01_fb_analysis_paused_metadata.sql` — ALTER fb_analysis_jobs:
  - Dodany status `paused` do CHECK constraint (umozliwia pause/resume w Plan 02)
  - Dodana kolumna `metadata JSONB DEFAULT '{}'` (sluzy do sledzenia forceReanalyze miedzy requestami)
  - Pattern identyczny jak sync_jobs w email-analyzer

### callAI() Structured Output
- Rozszerzenie `callAI()` o opcjonalny 4. parametr `responseFormat`
- Warunkowo dodaje `response_format` do body requestu OpenAI API
- Backward compatible — istniejace wywolania bez responseFormat dzialaja bez zmian
- Umozliwia `type: "json_schema"` z `strict: true` — gwarantowany structured output

### fb-analysis-prompt.ts
- `FB_POST_ANALYSIS_SECTION_KEY = '_fb_post_analysis'` — klucz sekcji w prompt_templates
- `FB_POST_ANALYSIS_SYSTEM_PROMPT` — pelny system prompt po polsku:
  - Ekspert ds. zarzadzania nieruchomosciami analizujacy posty z grup FB osiedli
  - 8+ przykladow polskiego sarkazmu, kolokwializmow, pasywno-agresywnego tonu
  - Instrukcja odpowiedzi WYLACZNIE w JSON
- `FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE` — template z 8 placeholderami
  - Skala relevance_score 0-10 z opisem zakresow
  - 11 predefiniowanych kategorii
  - Instrukcja podwyzszenia score przy keyword matches
- `FB_POST_ANALYSIS_SCHEMA` — response_format z json_schema:
  - `is_relevant` (boolean), `sentiment` (enum 3), `relevance_score` (integer)
  - `categories` (array of enum 11), `ai_snippet` (string)
  - `additionalProperties: false`, `strict: true`
- `buildFbUserPrompt()` — helper wypelniajacy template danymi postu

### fb-keywords.ts
- `matchKeywords(content, keywords)` — case-insensitive `.includes()`, zwraca trafienia
- `loadKeywords(adminClient, groupId)` — laduje z fb_settings:
  - Per-group: `fb_keywords:{groupId}` (override)
  - Global: `fb_keywords` (fallback)
  - Graceful fallback: zwraca `[]` bez rzucania wyjatku

### default-prompts.ts
- Prompt FB zarejestrowany w `DEFAULT_PROMPTS` array
- `section_order: 100` — po wszystkich emailowych sekcjach (0-13)
- Admin widzi prompt FB na stronie Prompty (istniejacy /api/prompts endpoint go zwroci)

### fb-settings allowlist
- POST walidacja rozszerzona o `fb_keywords` i `fb_keywords:*`
- Keywords przechowywane jako `value_plain` (JSON array string, nie szyfrowane)

### Typy TypeScript
- `FbPostAnalysisResult` interface — odwzorowuje JSON schema
- `FbAnalysisStatus` rozszerzony o `'paused'`
- `FbSettingsKey` rozszerzony o `'fb_keywords'` i `fb_keywords:${string}`
- `FbAnalysisJob.metadata` dodane (JSONB)

## Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | f9ded10 | feat | SQL migration + callAI responseFormat + fb-analysis-prompt + typy |
| 2 | 748ecbb | feat | fb-keywords + rejestracja promptu FB + fb-settings allowlist |

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **callAI() backward compatible** — dodany opcjonalny 4. parametr, istniejace wywolania nie wymagaja zmian
2. **JSON schema strict mode** — min/max na integer moga byc ignorowane przez strict mode, walidacja w kodzie (notatka w schema)
3. **System prompt z 8+ przykladami PL sarkazmu** — pokrywa sarkazm, grzeczne skargi, kolokwializmy, wielkie litery, ironie, pasywno-agresywny ton, pytania retoryczne, emoji sarkazmowe
4. **fb_keywords nie szyfrowane** — przechowywane w value_plain jako JSON array (slowa kluczowe nie sa danymi wrazliwymi)
5. **section_order: 100** — zapobiega kolizji z emailowymi sekcjami (0-13)

## Next Phase Readiness

### Ready for Plan 10-02 (API Routes)
- callAI() z responseFormat gotowy do uzycia w POST /api/fb/analysis/process
- fb-analysis-prompt.ts eksportuje wszystko co potrzeba do budowania promptow
- fb-keywords.ts eksportuje matchKeywords() i loadKeywords() do pre-AI boostu
- SQL migration musi byc wklejona w Supabase SQL Editor przed testowaniem pause/resume
- Typy TS (FbPostAnalysisResult, FbAnalysisStatus, FbSettingsKey) gotowe do importu

### Blockers
- **SQL migration** — user musi wkleic w Supabase Dashboard > SQL Editor (Supabase CLI zepsuty)
