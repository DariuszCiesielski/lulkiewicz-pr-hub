# Design: FB Reports & Export (Phase 12)

**Date:** 2026-02-25
**Status:** Approved
**Requirements:** FBREP-01..06

## Overview

Admin generuje raport FB na żądanie — wybiera dewelopera, zakres dat, opcjonalnie wyłącza grupy. Raport zawiera sekcje per grupa (3 syntezy AI) + podsumowanie per deweloper (1 synteza). Eksport DOCX z klikalnymi linkami do postów FB.

## Decyzje architektoniczne

1. **Dedykowany fb-report-synthesizer.ts** — NIE reuse email report-synthesizer (domeny zbyt różne)
2. **3 syntezy AI per grupa** — kompromis jakość vs koszt (nie 1, nie 7)
3. **Filtracja: deweloper + zakres dat + opcja wyłączenia grup** — domyślnie wszystkie grupy dewelopera
4. **Reuse exportReportToDocx()** — linki FB w markdown → klikalne hyperlinki w DOCX (zero zmian w eksporterze)

## Model danych

### Nowa tabela: `fb_report_sections`

```sql
CREATE TABLE fb_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES fb_reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fb_report_sections_report ON fb_report_sections(report_id);
```

### Istniejąca tabela: `fb_reports` (bez zmian)

Kolumny: id, title, content_markdown, summary_data, group_ids, date_from, date_to, status, created_at, updated_at.

### Section keys

Per grupa (np. group_id = `abc-123`):
- `group:abc-123:analysis` — Analiza ogólna i sentyment
- `group:abc-123:risk` — Ryzyko PR i posty negatywne
- `group:abc-123:recommendations` — Rekomendacje

Per deweloper:
- `developer:Robyg:summary` — Podsumowanie cross-group

## Flow generowania

```
Admin: wybiera dewelopera + zakres dat + (opcjonalnie odznacza grupy)
  │
  ▼
POST /api/fb-reports ─── tworzy fb_reports (status: 'generating')
  │                       oblicza: totalSections = (N grup × 3) + 1
  │                       zwraca: { reportId, totalSections }
  ▼
Frontend polling loop (while hasMore):
  POST /api/fb-reports/process ─── przetwarza 1 sekcję per request
  │                                 kolejność: grupy (3 sekcje/grupa), potem developer summary
  │                                 maxDuration: 300s (Vercel Pro)
  │                                 zwraca: { processedSections, totalSections, hasMore }
  ▼
hasMore === false → redirect → /fb-analyzer/reports/[id]
```

## API Routes

### `POST /api/fb-reports` — tworzenie raportu

Input: `{ developer: string, dateFrom: string, dateTo: string, excludeGroupIds?: string[] }`
Output: `{ reportId, title, totalSections, status: 'generating' }`

Logika:
1. verifyScopedAdminAccess() + getAdminClient()
2. Pobierz grupy: `fb_groups WHERE developer = :developer AND status = 'active' AND id NOT IN (:excludeGroupIds)`
3. Sprawdź czy grupy mają przeanalizowane posty w zakresie dat
4. totalSections = (grupy.length × 3) + 1
5. Insert fb_reports z { title, group_ids, date_from, date_to, status: 'generating' }
6. Zwróć natychmiast

### `POST /api/fb-reports/process` — polling synthesis

Input: `{ reportId: string }`
Output: `{ status, processedSections, totalSections, hasMore }`

- 1 sekcja per request (pełny budżet AI per call)
- Sprawdza które sekcje już istnieją w fb_report_sections
- Kolejność: grupy (3 sekcje per grupa), developer summary na końcu
- Developer summary czyta content_markdown poprzednich sekcji jako input
- Po zakończeniu: fb_reports.status = 'draft'

### `GET/PATCH/DELETE /api/fb-reports/[id]`

- GET: raport + sekcje (posortowane po section_order)
- PATCH: edycja sekcji { sectionId, content_markdown }
- DELETE: kasuje raport (cascade do sekcji)

### `GET /api/fb-reports` — lista raportów

- ORDER BY created_at DESC, filtr per deweloper opcjonalny

## FB Report Synthesizer

Nowy plik: `src/lib/ai/fb-report-synthesizer.ts`

Reusuje: `callAI()`, `loadAIConfig()` z ai-provider.ts.

### System prompt (wspólny)

```
Jesteś ekspertem ds. monitoringu mediów społecznościowych i zarządzania
reputacją deweloperów mieszkaniowych. Analizujesz posty z grup mieszkańców
na Facebooku. Pisz po polsku, językiem formalnym i rzeczowym.
```

### 4 funkcje syntezy

| Funkcja | Input | Focus |
|---------|-------|-------|
| synthesizeGroupAnalysis() | posty grupy | Podsumowanie, rozkład sentymentu, kategorie, trendy |
| synthesizeGroupRisk() | posty negatywne grupy | Ryzyka PR, cytaty z postów, linki do FB |
| synthesizeGroupRecommendations() | posty + output 2 poprzednich | Rekomendacje per grupa |
| synthesizeDeveloperSummary() | content_markdown sekcji grup | Cross-group wzorce, top ryzyka, ocena |

### Dane źródłowe

```sql
SELECT content, sentiment, relevance_score, ai_snippet, ai_categories, post_url, posted_at, author_name
FROM fb_posts
WHERE group_id = :groupId
  AND posted_at BETWEEN :dateFrom AND :dateTo
  AND relevance_score >= 3
ORDER BY relevance_score DESC, posted_at DESC
LIMIT 200
```

## Frontend

### Lista raportów: `/fb-analyzer/reports/page.tsx` (rewrite)

- Przycisk "Generuj raport" → formularz
- Formularz: dropdown deweloper, zakres dat, checkboxy grup (domyślnie all)
- Progress: "AI syntetyzuje sekcje... 4/16"
- Lista raportów z tytułem, deweloperem, datą, przyciskiem Usuń

### Szczegóły raportu: `/fb-analyzer/reports/[id]/page.tsx` (nowy)

- Header: tytuł, deweloper, zakres dat, data utworzenia
- Spis treści (grupy + developer summary)
- Sekcje z ReactMarkdown + remarkGfm
- Edycja inline per sekcja
- Kopiuj raport (clipboard), Pobierz .docx

### Eksport DOCX

Reuse `exportReportToDocx()` — bez zmian. Linki do postów FB w content_markdown → klikalne hyperlinki w DOCX automatycznie.

## Nowe pliki

| Plik | Linie (szac.) |
|------|--------------|
| src/app/api/fb-reports/route.ts | ~150 |
| src/app/api/fb-reports/process/route.ts | ~200 |
| src/app/api/fb-reports/[id]/route.ts | ~120 |
| src/lib/ai/fb-report-synthesizer.ts | ~250 |
| src/app/(hub)/fb-analyzer/reports/page.tsx | ~300 (rewrite) |
| src/app/(hub)/fb-analyzer/reports/[id]/page.tsx | ~350 |
| supabase/migrations/20260225_fb_report_sections.sql | ~20 |

**Zero zmian** w istniejącym kodzie (report-synthesizer.ts, export-report-docx.ts, ai-provider.ts).
