---
phase: 10-ai-sentiment-analysis
plan: 03
subsystem: ui
tags: [ui, hooks, polling, progress-bar, keywords, settings, analysis-panel]
dependency-graph:
  requires:
    - phase: 10-02-api-routes
      provides: POST/GET /api/fb/analysis, POST /api/fb/analysis/process, POST /api/fb/analysis/pause
    - phase: 10-01-ai-foundation
      provides: fb-analysis-prompt, fb-keywords, default-prompts registration
    - phase: 08-group-management
      provides: fb_groups CRUD, fb_settings, SettingsForm
  provides:
    - useFbAnalysisJob hook (polling-driven batch analysis)
    - FbAnalysisPanel component (launch, progress, pause/resume, history)
    - Analyze page with real data (no mock)
    - Keywords config in SettingsForm
    - fb_keywords in GET /api/fb-settings response
  affects: [11-fb-reports, 12-fb-dashboard]
tech-stack:
  added: []
  patterns: [polling-driven-batch-processing, css-variables-design-system, lucide-react-icons]
key-files:
  created:
    - src/hooks/useFbAnalysisJob.ts
    - src/components/fb/FbAnalysisPanel.tsx
  modified:
    - src/app/(hub)/fb-analyzer/analyze/page.tsx
    - src/components/fb/SettingsForm.tsx
    - src/app/api/fb-settings/route.ts
key-decisions:
  - "useFbAnalysisJob uproszczony vs useAnalysisJob — bez ETA, bez processedAtStart, bez jobStartedAt (FB analysis jest szybsza)"
  - "FbAnalysisPanel jako osobny komponent — reusable, nie inline w page.tsx"
  - "Keywords parse: split by comma + newline, trim, lowercase, unique — robust input handling"
  - "Prompt preview via /api/prompts (existing) + link do /email-analyzer/prompts (existing page)"
  - "fb_keywords w GET response — JSON.parse z try/catch (graceful na corrupted data)"
metrics:
  duration: "6m"
  completed: "2026-02-23"
---

# Phase 10 Plan 03: Analysis UI — Hook, Panel, Keywords Summary

**Kompletny frontend do analizy AI postow FB: polling hook, panel z progress barem i pause/resume, zastapienie mock data rzeczywistymi grupami, i konfiguracja slow kluczowych w ustawieniach.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-23T13:51:03Z
- **Completed:** 2026-02-23T13:57:11Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- Full analysis UI with real data from API (zero mock data remaining on analyze page)
- Polling hook (`useFbAnalysisJob`) with start/pause/resume/reset, 800ms batch delay
- `FbAnalysisPanel` component: group selector, force-reanalyze checkbox, progress bar with percentage, pause/resume controls, completed/error states, recent jobs history with resume capability
- Keywords configuration card in SettingsForm (Card 5): textarea input, parse by comma/newline, preview tags, save to fb_settings
- GET /api/fb-settings extended with `fb_keywords` array in response
- Prompt preview section with readonly textarea and link to edit on Prompts page

## Task Commits

Each task was committed atomically:

1. **Task 1: useFbAnalysisJob hook + FbAnalysisPanel component** - `c835b15` (feat)
2. **Task 2: Analyze page real data + keywords settings + fb-settings GET extended** - `53d2ea0` (feat)

## Files Created

- `src/hooks/useFbAnalysisJob.ts` — Polling hook for FB analysis jobs. Exports `useFbAnalysisJob`, `FbAnalysisUIStatus`, `FbAnalysisProgress`, `UseFbAnalysisJobReturn`. Calls 3 API routes: `/api/fb/analysis` (start), `/api/fb/analysis/process` (poll), `/api/fb/analysis/pause` (pause/resume). Pattern identical to `useAnalysisJob` but simplified (no ETA calculation, no job timing).
- `src/components/fb/FbAnalysisPanel.tsx` — Two-column panel component. Left: group select, forceReanalyze checkbox, start button, progress bar with pause/resume, completed/error states. Right: recent jobs list with status badges, progress bars, resume buttons for paused jobs. Uses CSS variables and lucide-react icons.

## Files Modified

- `src/app/(hub)/fb-analyzer/analyze/page.tsx` — Complete rewrite: removed all mock data imports, fetches real groups from `/api/fb-groups`, renders `FbAnalysisPanel` with real data, fetches prompt from `/api/prompts` for preview, loading/error/empty states.
- `src/components/fb/SettingsForm.tsx` — Added Card 5 "Slowa kluczowe do monitorowania": textarea input, parse by comma/newline, trim/lowercase/unique, preview as purple tags, save as JSON to `fb_keywords` key. Added `Tag` icon import, `keywords`/`keywordsInput` state, load/save integration with fb-settings API.
- `src/app/api/fb-settings/route.ts` — Extended GET response with `fb_keywords` field: finds `fb_keywords` record, JSON.parse with try/catch fallback to empty array.

## Decisions Made

1. **Simplified hook vs email analyzer** — `useFbAnalysisJob` omits ETA calculation, processedAtStart, jobStartedAt, startedAt. FB analysis is batch-oriented and faster than email analysis, making ETA less useful. Can be added later if needed.
2. **FbAnalysisPanel as separate component** — Extracted into its own file for reusability. Receives groups as props, manages its own analysis state via hook and recent jobs via direct fetch.
3. **Keywords input parsing** — Split by both comma and newline (`/[,\n]+/`), trim, lowercase, filter empty, deduplicate. Handles copy-paste from various sources.
4. **Prompt preview readonly** — Links to existing `/email-analyzer/prompts` page (opens in new tab). The FB prompt appears there thanks to registration in `DEFAULT_PROMPTS` from Plan 10-01.
5. **fb_keywords in GET response** — JSON.parse wrapped in try/catch for graceful handling of corrupted data. Returns empty array on parse failure.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

### Phase 10 COMPLETE

All 3 plans of Phase 10 (AI Sentiment Analysis) are now complete:
- Plan 01: AI Foundation (prompt, keywords, schema, migration)
- Plan 02: API Routes (create job, process batch, pause/resume/cancel)
- Plan 03: UI (hook, panel, analyze page, keywords settings)

### Ready for Phase 11 (FB Reports)
- End-to-end analysis pipeline works: admin selects group, starts analysis, monitors progress, can pause/resume
- Analyzed posts have sentiment, relevance_score, ai_snippet, ai_categories stored in fb_posts
- Keywords configurable via SettingsForm, used by analysis process route for relevance boosting
- Next phase can build on analyzed data to generate FB reports

### Blockers
- None for Phase 11

---
*Phase: 10-ai-sentiment-analysis*
*Completed: 2026-02-23*
