---
phase: 09-scraping-engine
plan: 03
subsystem: ui
tags: [react, hooks, polling, scraping, facebook, progress-bar, rate-limiting]

# Dependency graph
requires:
  - phase: 09-scraping-engine/02
    provides: POST /api/fb/scrape (start job), POST /api/fb/scrape/process (3-mode pipeline), response format with status/hasMore/postsFound/postsNew/postsUpdated
  - phase: 08-group-management
    provides: GroupTable.tsx, groups/page.tsx, FbGroupEnriched type
provides:
  - useScrapeJob hook with single/bulk scraping, polling, rate limiting
  - ScrapeProgress component with all scraping states
  - ScrapeButton per-group trigger component
  - Groups page integrated with scrape lifecycle
affects: [10-ai-analysis (will need similar useAnalysisJob pattern for FB)]

# Tech tracking
tech-stack:
  added: [] # Zero new npm packages
  patterns:
    - "useScrapeJob polling hook: 5s interval for Apify runs, 2s for downloads"
    - "Bulk scrape with 180-360s random delay between groups (client-side rate limiting)"
    - "ScrapeProgress sticky bar with waiting countdown between groups"
    - "Cookie warning: yellow alert when scraping returns 0 posts"

key-files:
  created:
    - src/hooks/useScrapeJob.ts
    - src/components/fb/ScrapeProgress.tsx
    - src/components/fb/ScrapeButton.tsx
  modified:
    - src/types/fb.ts
    - src/components/fb/GroupTable.tsx
    - src/app/(hub)/fb-analyzer/groups/page.tsx

key-decisions:
  - "ScrapeProgress extended with isWaitingBetweenGroups + waitSecondsRemaining (not new ScrapeUIStatus value) — minimal type change"
  - "Bulk scrape uses inline fetch logic (not startScrape) to preserve groupsTotal/groupsCompleted across groups"
  - "Polling intervals: 5s for running (Apify runs take minutes), 2s for downloading (faster feedback during upsert)"
  - "scrapingGroupId tracked in page state (not derived from progress.currentGroup) for reliable GroupTable prop"

patterns-established:
  - "useScrapeJob hook pattern: Promise-based bulk with countdown timer between groups"
  - "ScrapeProgress sticky bar: reusable pattern for long-running operations with visual feedback"
  - "ScrapeButton per-row action with disabled state during active scrape"

# Metrics
duration: 7min
completed: 2026-02-23
---

# Phase 9 Plan 03: Scrape UI Summary

**useScrapeJob polling hook with multi-group queue (180-360s rate limiting), ScrapeProgress sticky bar, ScrapeButton per-group trigger, and full groups page integration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-23T09:18:49Z
- **Completed:** 2026-02-23T09:25:53Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 3

## Accomplishments
- useScrapeJob hook manages full scrape lifecycle: idle->starting->running->downloading->completed/error with 5s polling
- Bulk scrape with sequential group processing and 180-360s random delay between groups (client-side rate limiting)
- ScrapeProgress sticky bar shows real-time status including countdown timer between groups and cookie warning on 0 posts
- ScrapeButton per group in GroupTable actions column with disabled state during active scrape
- Groups page fully integrated: single scrape per row, bulk scrape for selected groups, progress bar, auto-refresh on complete

## Task Commits

Each task was committed atomically:

1. **Task 1: useScrapeJob hook with multi-group queue** - `5ef5572` (feat)
2. **Task 2: UI components + groups page integration** - `2ebc558` (feat)

## Files Created/Modified
- `src/hooks/useScrapeJob.ts` - Polling hook: startScrape (single), startBulkScrape (multi with 180-360s delay), status/progress/error state, cleanup on unmount
- `src/components/fb/ScrapeProgress.tsx` - Sticky progress bar: starting, running (with apifyStatus), downloading (with post counts), completed (with stats), error (with suggestion), waiting between groups (countdown timer), cookie warning (0 posts alert)
- `src/components/fb/ScrapeButton.tsx` - Per-group scrape trigger: disabled for paused groups, spinner during active scrape, disabled for other groups during scrape
- `src/types/fb.ts` - Added isWaitingBetweenGroups and waitSecondsRemaining to ScrapeProgress interface
- `src/components/fb/GroupTable.tsx` - Added onScrape, isScrapingAny, currentScrapingGroupId props; ScrapeButton rendered first in actions column
- `src/app/(hub)/fb-analyzer/groups/page.tsx` - Integrated useScrapeJob hook, ScrapeProgress bar, bulk scrape button, scrapingGroupId state

## Decisions Made
- ScrapeProgress extended with `isWaitingBetweenGroups: boolean` + `waitSecondsRemaining: number` instead of adding new ScrapeUIStatus value — keeps type changes minimal, existing status values unchanged
- Bulk scrape uses inline fetch logic rather than calling `startScrape()` directly — needed to preserve groupsTotal and groupsCompleted across multiple group iterations
- Polling intervals differentiated: 5s for `running` (Apify runs take minutes), 2s for `downloading` (faster feedback during upsert phase)
- `scrapingGroupId` tracked as separate state in page.tsx rather than deriving from `progress.currentGroup` name — reliable ID matching for GroupTable prop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed handleBulkScrape referencing filteredGroups before declaration**
- **Found during:** Task 2 (groups/page.tsx integration)
- **Issue:** handleBulkScrape used `filteredGroups` which was defined after the hook section — TypeScript error TS2448
- **Fix:** Moved handleBulkScrape after filteredGroups declaration in a dedicated section
- **Files modified:** src/app/(hub)/fb-analyzer/groups/page.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 2ebc558 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial ordering fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. (Apify token and FB cookies configured via Settings UI from Phase 8.)

## Next Phase Readiness
- Phase 9 (Scraping Engine) COMPLETE: all 3 plans delivered
  - Plan 01: Apify client + post mapper + scraping types
  - Plan 02: 3 API routes (scrape/route.ts, scrape/process/route.ts, scrape/status/[jobId]/route.ts)
  - Plan 03: useScrapeJob hook + ScrapeProgress + ScrapeButton + groups page integration
- Full scraping pipeline ready: admin clicks "Scrapuj" -> Apify Actor runs -> posts upserted -> UI refreshes
- Bulk scrape with rate limiting prevents FB account detection
- Ready for Phase 10: AI Analysis of scraped posts

---
*Phase: 09-scraping-engine*
*Completed: 2026-02-23*
