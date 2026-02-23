---
phase: 10-ai-sentiment-analysis
plan: 02
subsystem: api
tags: [ai, sentiment, batch-processing, polling, structured-output, fb-analysis, pause-resume]
dependency-graph:
  requires:
    - phase: 10-01-ai-foundation
      provides: callAI responseFormat, fb-analysis-prompt, fb-keywords, SQL paused+metadata
    - phase: 07-fb-foundation
      provides: fb_analysis_jobs table, fb_posts table, FB types
    - phase: 08-group-management
      provides: fb_groups, fb_settings tables
  provides:
    - POST /api/fb/analysis — create analysis job with metadata { forceReanalyze }
    - GET /api/fb/analysis — list jobs enriched with group name
    - POST /api/fb/analysis/process — batch AI processing (5 posts parallel)
    - POST /api/fb/analysis/pause — pause/resume/cancel job control
  affects: [10-03-ui, 11-fb-reports, 12-fb-dashboard]
tech-stack:
  added: []
  patterns: [polling-driven-batch-processing, metadata-jsonb-for-options, pre-filter-short-content, keyword-boost-relevance]
key-files:
  created:
    - src/app/api/fb/analysis/route.ts
    - src/app/api/fb/analysis/process/route.ts
    - src/app/api/fb/analysis/pause/route.ts
  modified: []
key-decisions:
  - "forceReanalyze persisted in job.metadata JSONB — process route reads from DB, not request body"
  - "Pre-filter posts <20 chars as irrelevant without AI call — saves API costs"
  - "AI errors per post logged but do not fail entire job — failed posts marked neutral/0"
  - "Keyword boost +1-2 in process route code (not in prompt) for predictable scoring"
  - "Prompt override from prompt_templates DB, fallback to hardcoded defaults"
  - "offset-based pagination for forceReanalyze, sentiment IS NULL filter for normal mode"
patterns-established:
  - "FB analysis job lifecycle: pending -> running -> completed/failed (with paused)"
  - "metadata JSONB for per-job options (same as sync_jobs.metadata in email-analyzer)"
  - "Pre-filter + Promise.allSettled parallel processing pattern"
  - "Extra instructions: developer_instruction + group.ai_instruction concatenated"
metrics:
  duration: "4m"
  completed: "2026-02-23"
---

# Phase 10 Plan 02: AI Analysis API Routes Summary

**3 API routes for FB post AI analysis: polling-driven batch processing with structured JSON output, keyword boost, pre-filtering, and pause/resume via job metadata JSONB.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T13:42:14Z
- **Completed:** 2026-02-23T13:46:09Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Full backend AI analysis pipeline for FB posts (create job, batch process, pause/resume/cancel)
- Structured JSON output via `FB_POST_ANALYSIS_SCHEMA` guarantees valid AI responses
- Pre-filter eliminates short posts (<20 chars) without wasting AI API calls
- Keyword boost (+1-2 relevance points) applied in process route code for deterministic scoring
- forceReanalyze persisted in job.metadata JSONB — works across polling requests
- AI errors per post are logged but do not fail entire job (graceful degradation)

## Task Commits

Each task was committed atomically:

1. **Task 1: POST/GET /api/fb/analysis (create job + list jobs)** - `1ca8658` (feat)
2. **Task 2: POST /api/fb/analysis/process + POST /api/fb/analysis/pause** - `066bc3b` (feat)

## Files Created

- `src/app/api/fb/analysis/route.ts` — POST creates job (validates group/AI config/no active job, counts posts, persists forceReanalyze in metadata), GET lists last 10 jobs enriched with group name
- `src/app/api/fb/analysis/process/route.ts` — POST batch processes 5 posts parallel via Promise.allSettled, pre-filters short posts, reads forceReanalyze from job.metadata, keyword boost, structured JSON output via callAI with responseFormat, maxDuration=60
- `src/app/api/fb/analysis/pause/route.ts` — POST handles pause (running/pending->paused), resume (paused->running), cancel (any active->failed)

## Decisions Made

1. **forceReanalyze in job.metadata** — persisted in DB JSONB, process route reads from there (not request body). Ensures correct behavior across polling requests. Same pattern as sync_jobs.metadata in email-analyzer.
2. **Pre-filter threshold: 20 chars** — posts shorter than 20 chars marked neutral/0 without AI call. Prevents wasting API calls on "ok", "+1", emoji-only posts.
3. **AI errors: graceful per-post** — failed AI calls mark post as neutral/0 with error message in ai_snippet. Does not fail entire job. Allows partial results.
4. **Prompt override from DB** — checks prompt_templates for section_key `_fb_post_analysis`, falls back to hardcoded defaults. Admin can customize prompt via existing Prompts UI.
5. **Extra instructions concatenation** — developer_instruction (from fb_settings) + group.ai_instruction merged into single string. Gives AI full context per analysis call.
6. **Offset-based pagination for forceReanalyze** — uses `OFFSET job.analyzed_posts` when re-analyzing all posts. Normal mode uses `sentiment IS NULL` filter (no offset needed).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. SQL migration from Plan 10-01 must already be applied.

## Next Phase Readiness

### Ready for Plan 10-03 (Analysis UI)
- All 3 API routes ready: POST create, POST process, POST pause
- Response format consistent with email-analyzer pattern (status, analyzedPosts, totalPosts, hasMore)
- Frontend hook (useAnalysisJob equivalent) can poll POST /api/fb/analysis/process
- Pause/resume/cancel available for UI controls

### API Contract Summary
| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| /api/fb/analysis | POST | { groupId, forceReanalyze? } | { jobId, totalPosts, forceReanalyze } |
| /api/fb/analysis | GET | ?groupId=uuid | { jobs: [...] } |
| /api/fb/analysis/process | POST | { jobId } | { status, analyzedPosts, totalPosts, hasMore } |
| /api/fb/analysis/pause | POST | { jobId, action } | { status, analyzedPosts, totalPosts } |

### Blockers
- None for Plan 10-03

---
*Phase: 10-ai-sentiment-analysis*
*Completed: 2026-02-23*
