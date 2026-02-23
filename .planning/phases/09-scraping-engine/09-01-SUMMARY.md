---
phase: 09-scraping-engine
plan: 01
subsystem: api
tags: [apify, scraping, facebook, rest-api, typescript]

# Dependency graph
requires:
  - phase: 08-group-management
    provides: fb_settings key-value store, fb_groups schema, FbPost/FbComment types
provides:
  - Apify REST API v2 wrapper (3 functions + 2 helpers)
  - Post mapper with graceful fallbacks for MEDIUM-confidence actor output
  - 10+ scraping types in fb.ts (ApifyCookieObject, ApifyActorInput, ScrapeConfig, etc.)
  - SCRAPE_ERROR_MESSAGES const with Polish UI messages
affects: [09-02 (scrape API routes), 09-03 (scrape UI/hook)]

# Tech tracking
tech-stack:
  added: [] # Zero new npm packages — native fetch() only
  patterns:
    - "Apify API wrapper: 3 typed functions (startActorRun, getRunStatus, getDatasetItems) with Bearer auth"
    - "Graceful field mapping: every actor output field has fallback chain for MEDIUM confidence data"
    - "Server-only module: apify-client.ts nie importowac w komponentach klienckich"

key-files:
  created:
    - src/lib/fb/apify-client.ts
    - src/lib/fb/post-mapper.ts
  modified:
    - src/types/fb.ts

key-decisions:
  - "Native fetch() zamiast apify-client npm (3 endpointy nie uzasadniaja 12 deps / 2.8 MB)"
  - "ApifyActorInput z dot-notation key scrapeGroupPosts.groupUrl (zweryfikowane z N8N workflow)"
  - "formatApifyDate bez leading zero (yyyy-M-dd) — format wymagany przez aktora"
  - "MappedFbPost/MappedFbComment jako osobne interfejsy (nie FbPost/FbComment z DB) — mapper tworzy rows do upsert"
  - "extractFacebookPostId: 3 patterny URL + fallback na caly URL (nigdy pusty string)"
  - "logRawPostSample debug helper — do weryfikacji schematu przy pierwszym scrapowaniu"

patterns-established:
  - "Apify API wrapper pattern: APIFY_BASE const, Bearer auth header, error with response body"
  - "Dataset response: direct JSON array (NOT wrapped in data), total from X-Apify-Pagination-Total header"
  - "Status mapping: mapApifyStatusToAction covers all 8 Apify states -> 3 internal actions"
  - "Graceful mapper: every field has || fallback chain, dates in try/catch"

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 9 Plan 01: Apify Client & Post Mapper Summary

**Apify REST API v2 wrapper (startActorRun, getRunStatus, getDatasetItems) + post mapper z graceful fallbacks na wszystkie pola aktora**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T09:01:58Z
- **Completed:** 2026-02-23T09:05:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Apify API wrapper z 3 funkcjami API + 2 helperami, Bearer auth, proper error handling
- Post mapper obslugujacy brak pol gracefully (3 potwierdzone pola + fallbacki na reszte)
- 10+ nowych typow scraping w fb.ts + SCRAPE_ERROR_MESSAGES z komunikatami PL
- Zero nowych npm deps — native fetch() konsystentne z istniejacym wzorcem Graph API

## Task Commits

Each task was committed atomically:

1. **Task 1: Typy TS scrape + Apify API wrapper** - `b1c3606` (feat)
2. **Task 2: Post mapper z graceful fallbacks** - `30780e8` (feat)

## Files Created/Modified
- `src/types/fb.ts` - Rozszerzony o 10+ typow Phase 9 (ApifyCookieObject, ApifyActorInput, ApifyRunStatusResponse, ScrapeConfig, ScrapeProgress, ScrapeErrorInfo, SCRAPE_ERROR_MESSAGES)
- `src/lib/fb/apify-client.ts` - Apify REST API v2 wrapper: startActorRun, getRunStatus, getDatasetItems + mapApifyStatusToAction, formatApifyDate
- `src/lib/fb/post-mapper.ts` - Mapowanie surowych danych Apify na typy DB: extractFacebookPostId, mapApifyPostToFbPost, mapApifyCommentToFbComment, logRawPostSample

## Decisions Made
- Native fetch() zamiast apify-client npm — 3 endpointy nie uzasadniaja dodatkowej zaleznosci
- MappedFbPost/MappedFbComment jako osobne interfejsy od FbPost/FbComment (mapper tworzy rows do DB upsert, nie pelne obiekty z id/timestamps)
- extractFacebookPostId fallback na caly URL zamiast throw — graceful degradation
- logRawPostSample helper do weryfikacji faktycznego schematu aktora przy pierwszym uruchomieniu

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- apify-client.ts i post-mapper.ts gotowe do importu przez API routes w Planie 02
- Typy ScrapeConfig, ApifyActorInput gotowe dla loadScrapeConfig helper
- Nastepny krok: Plan 09-02 (API routes: /api/fb/scrape, /api/fb/scrape/process, /api/fb/scrape/status)

---
*Phase: 09-scraping-engine*
*Completed: 2026-02-23*
