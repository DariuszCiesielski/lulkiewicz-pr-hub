---
phase: 09-scraping-engine
plan: 04
subsystem: fb-scraping
tags: [apify, cookies, health-check, pre-scrape, gap-closure]
dependency_graph:
  requires: [09-01, 09-02, 09-03]
  provides: [pre-scrape-cookie-validation, cookie-check-endpoint]
  affects: [10-ai-analysis]
tech_stack:
  added: []
  patterns: [pre-flight-validation, polling-with-timeout, proceed-after-warning]
key_files:
  created:
    - src/app/api/fb/scrape/check-cookies/route.ts
  modified:
    - src/hooks/useScrapeJob.ts
    - src/components/fb/ScrapeProgress.tsx
    - src/app/(hub)/fb-analyzer/groups/page.tsx
decisions:
  - id: cookie-check-single-only
    choice: "Cookie check only on single scrape, not bulk"
    reason: "Bulk scrape pausing per-group for check would be disruptive to UX and rate limiting"
  - id: scrape-until-today
    choice: "Minimal Apify run uses scrapeUntil=today instead of maxPosts"
    reason: "ApifyActorInput has no maxPosts param; today-only window is lightest possible run"
  - id: 45s-poll-timeout
    choice: "45s max wait for health check (15s Vercel buffer)"
    reason: "Vercel function limit is 60s; 15s buffer for request overhead and dataset fetch"
  - id: proceed-after-warning
    choice: "User can click 'Kontynuuj mimo to' to skip failed check"
    reason: "False positives possible if group has no posts today; user should have override"
metrics:
  duration: ~4min
  completed: 2026-02-23
---

# Phase 9 Plan 04: Cookie Health Check (Gap Closure) Summary

Pre-scrape cookie health check: minimal Apify Actor run validates FB cookies before actual scraping, with yellow warning + proceed/cancel on failure.

## What Was Built

### Task 1: Cookie Health Check API Route
**Commit:** aa9aaf3

New endpoint `POST /api/fb/scrape/check-cookies` that performs lightweight Apify validation:
- Loads group config (token, cookies, actorId) using same pattern as process/route.ts
- Starts minimal Apify Actor run with `scrapeUntil: today` and `minDelay: 1, maxDelay: 2`
- Polls run status every 3s with 45s hard timeout
- Returns `{ success: true, postsFound: N }` on success
- Returns `{ success: false, postsFound: 0, error: '...' }` on failure/timeout
- Returns 400 with SCRAPE_ERROR_MESSAGES for missing token/cookies

### Task 2: Hook + ScrapeProgress Integration
**Commit:** fe9f981

**useScrapeJob.ts changes:**
- New `cookie_check` status set before actual scrape starts
- Calls `/api/fb/scrape/check-cookies` pre-flight
- On failure: sets `cookieCheckWarning` with COOKIES_EXPIRED suggestion, returns to idle
- On success (postsFound > 0): continues to actual scrape transparently
- `proceedAfterWarning()` callback: sets skip flag, restarts scrape
- Reset clears all cookie check state
- Bulk scrape NOT affected (cookie check only on single scrape)

**ScrapeProgress.tsx changes:**
- Renders yellow spinner with "Sprawdzanie cookies Facebook..." for `cookie_check` status
- Renders yellow warning panel when `cookieCheckWarning` is set and status is idle
- Warning includes "Kontynuuj mimo to" (proceed) and "Anuluj" (cancel) buttons

**groups/page.tsx changes:**
- Destructures `cookieCheckWarning` and `proceedAfterWarning` from hook
- Passes as props to ScrapeProgress
- Show condition includes `cookieCheckWarning` to display warning in idle state

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Cookie check on single scrape only (not bulk) | Bulk scrape has rate limiting delays; pausing each group for check would be disruptive |
| 2 | scrapeUntil=today for minimal run | No maxPosts param in ApifyActorInput; today-only is lightest possible |
| 3 | 45s poll timeout with 15s Vercel buffer | Ensures response before Vercel 60s hard limit |
| 4 | Proceed-after-warning override | False positives possible for groups with no posts today |

## Phase 9 Gap Closure Status

This plan closes the last remaining gap in Phase 9 verification:
- **Truth #5** (pre-scrape cookie health check): NOW COMPLETE
- Phase 9 verification should now pass 5/5 must-haves

## Next Phase Readiness

Phase 9 (Scraping Engine) is fully complete with all gaps closed.
Ready for Phase 10 (AI Analysis of FB posts).
