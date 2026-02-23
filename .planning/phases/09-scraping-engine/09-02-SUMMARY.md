---
phase: 09-scraping-engine
plan: 02
subsystem: api
tags: [apify, scraping, facebook, rest-api, polling, upsert, serverless]

# Dependency graph
requires:
  - phase: 09-scraping-engine/01
    provides: apify-client.ts (startActorRun, getRunStatus, getDatasetItems), post-mapper.ts (mapApifyPostToFbPost), scraping types
  - phase: 08-group-management
    provides: fb_groups, fb_settings, fb_scrape_jobs, fb_posts tables
provides:
  - POST /api/fb/scrape — creates scrape job with pre-flight validation
  - POST /api/fb/scrape/process — 3-mode processing pipeline (start, poll, fetch+upsert)
  - GET /api/fb/scrape/status/[jobId] — job status read for recovery/reconnect
affects: [09-03 (scrape UI hook + components)]

# Tech tracking
tech-stack:
  added: [] # Zero new npm packages
  patterns:
    - "3-mode process route: pending->start, running->poll, downloading->fetch+upsert"
    - "loadScrapeConfig: decrypt token+cookies with per-group cookie override"
    - "loadToken: lightweight token-only loader for MODE 2/3 (avoids redundant decrypt)"
    - "failJob helper: centralized error handling with job status update"
    - "Dataset pagination via posts_found as offset"

key-files:
  created:
    - src/app/api/fb/scrape/route.ts
    - src/app/api/fb/scrape/process/route.ts
    - src/app/api/fb/scrape/status/[jobId]/route.ts

key-decisions:
  - "datasetId from getRunStatus() response instead of storing in job — cleaner than encoding in apify_run_id"
  - "loadToken separate from loadScrapeConfig — MODE 2/3 only need token, not full config with cookies"
  - "Upsert errors logged but don't fail entire job — partial progress preserved"
  - "Pre-flight config check in start route prevents orphan jobs (token/cookies validated before job creation)"

patterns-established:
  - "FB scraping 3-mode pattern: start(pending) -> poll(running) -> fetch(downloading) -> complete"
  - "Per-group cookie override: group.cookies_encrypted > fb_settings.fb_cookies"
  - "Safety timeout 50s in process route (Vercel 60s limit - 10s buffer)"
  - "Pre-flight validation pattern: check config availability before creating job"

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 9 Plan 02: Scrape API Routes Summary

**3 API routes for FB scraping pipeline: job creation with pre-flight validation, 3-mode process (start Apify run / poll status / fetch+upsert posts), and status recovery endpoint**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T09:09:54Z
- **Completed:** 2026-02-23T09:15:00Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- POST /api/fb/scrape creates job with full pre-flight validation (group active, no duplicate, token+cookies configured)
- POST /api/fb/scrape/process implements 3-mode pipeline: MODE 1 starts Apify Actor, MODE 2 polls status with action mapping, MODE 3 fetches dataset paginacyjnie and upserts posts with ON CONFLICT deduplication
- GET /api/fb/scrape/status/[jobId] enables recovery after connection loss
- Safety timeout 50s prevents Vercel function timeout
- loadScrapeConfig helper handles per-group cookie override and token decryption
- Error handling with failJob helper — marks job as failed with Polish error messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Scrape start route + status route** - `7d568d4` (feat)
2. **Task 2: Scrape process route (3-mode pipeline)** - `2c1efac` (feat)

## Files Created/Modified
- `src/app/api/fb/scrape/route.ts` - POST endpoint: creates scrape job with pre-flight validation (group check, duplicate check, config check)
- `src/app/api/fb/scrape/process/route.ts` - POST endpoint: 3-mode processing pipeline (start Apify run, poll status, fetch dataset + upsert posts)
- `src/app/api/fb/scrape/status/[jobId]/route.ts` - GET endpoint: job status read for recovery/reconnect

## Decisions Made
- datasetId retrieved from getRunStatus() response (defaultDatasetId field) instead of storing separately — avoids schema changes and encoding hacks
- loadToken helper separate from loadScrapeConfig — MODE 2/3 only need decrypted token, not full config with cookies; reduces unnecessary decryption
- Upsert errors are logged but don't fail the entire job — partial progress is preserved for recovery
- Pre-flight config check validates token and cookies exist BEFORE creating the job — prevents orphan jobs with missing config
- SCRAPE_ERROR_MESSAGES imported directly (not via require()) — clean ESM import pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SCRAPE_ERROR_MESSAGES import pattern**
- **Found during:** Task 2 (process route implementation)
- **Issue:** Initial implementation used require() for SCRAPE_ERROR_MESSAGES (CommonJS in ESM module)
- **Fix:** Changed to direct ESM import from @/types/fb, removed getErrorMessages() helper
- **Files modified:** src/app/api/fb/scrape/process/route.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 2c1efac (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial import fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. (Apify token and FB cookies are configured via Settings UI from Phase 8.)

## Next Phase Readiness
- All 3 API routes ready for client-side hook integration in Plan 09-03
- useScrapeJob hook can call POST /api/fb/scrape then poll POST /api/fb/scrape/process
- GET /api/fb/scrape/status/[jobId] available for recovery on page reload
- Response format includes hasMore, status, postsFound, postsNew, postsUpdated for UI progress display

---
*Phase: 09-scraping-engine*
*Completed: 2026-02-23*
