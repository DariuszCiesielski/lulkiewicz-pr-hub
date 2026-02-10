---
phase: 02-email-connection-fetching
plan: 03
subsystem: sync-engine
tags: [graph-api, email-fetcher, email-parser, html-to-text, delta-sync, pagination, sync-jobs]

requires:
  - phase: 02-01
    provides: TypeScript types, Graph auth, Graph client, encrypt/decrypt, DB tables

provides:
  - Email parser (HTML to plaintext via html-to-text, threading header extraction)
  - Email mapper (Graph API Message -> Email DB row)
  - Email fetcher (paginated full sync, delta sync, message count, upsert)
  - Sync API routes (POST /api/sync, POST /api/sync/process, GET /api/sync/status/[jobId])
  - Safety timeout (50s) for Vercel function limits
  - Throttling (429) error handling with retry info

affects: [02-04]

tech-stack:
  added: []
  patterns: [chunked-batch-sync, delta-sync, safety-timeout, upsert-dedup]

key-files:
  created:
    - src/lib/email/email-parser.ts
    - src/lib/email/email-fetcher.ts
    - src/app/api/sync/route.ts
    - src/app/api/sync/process/route.ts
    - src/app/api/sync/status/[jobId]/route.ts
  modified: []

key-decisions:
  - upsert-dedup: "ON CONFLICT (mailbox_id, internet_message_id) for email deduplication"
  - safety-timeout: "50s safety timeout to prevent Vercel 60s hard limit kills"
  - batch-size: "100 messages per batch via Graph API $top=100"
  - delta-link-persistence: "deltaLink saved to mailbox after full sync completes, used for subsequent delta syncs"
  - no-query-params-on-nextlink: "@odata.nextLink already contains all query params — never append $select/$top"
  - email-count-return: "upsertEmails returns validEmails.length (count of filtered emails with internet_message_id)"

metrics:
  duration: "~16 min"
  completed: "2026-02-10"
---

# Phase 2 Plan 03: Sync Engine Summary

**Silnik synchronizacji maili z Graph API: chunked batching (100/batch), delta sync, safety timeout (50s), 3 API routes (start/process/status) + email parser (html-to-text + threading headers).**

## Performance

| Metric | Value |
|--------|-------|
| Tasks planned | 2 |
| Tasks completed | 2 |
| Commits | 2 |
| Duration | ~16 min |
| Build status | PASS |

## Accomplishments

### Task 1: Email Parser
- `parseEmailBody()`: Converts HTML to plaintext using html-to-text library with options (skip img/style/script, link brackets, preserve newlines)
- `extractThreadingHeaders()`: Extracts Message-ID, In-Reply-To, References from Graph API internetMessageHeaders array
- `mapGraphMessageToEmail()`: Maps Graph API Message object to Email DB type (all fields: subject, from/to/cc, dates, body, attachments, threading, read status)

### Task 2: Email Fetcher + Sync API Routes
- `getMailboxMessageCount()`: Gets inbox totalItemCount for progress estimation
- `fetchMessagesPage()`: Full sync paginated fetch (100/batch, $select all needed fields, orderby receivedDateTime DESC)
- `fetchDeltaPage()`: Delta sync — fetches new/changed/removed messages, separates removed IDs
- `upsertEmails()`: Batch upsert with ON CONFLICT deduplication, filters emails without internet_message_id
- `POST /api/sync`: Creates sync job, validates mailbox exists, checks no active job, sets status to syncing
- `POST /api/sync/process`: Processes one batch — decrypt credentials, get token, fetch page, parse, upsert, handle timeouts
- `GET /api/sync/status/[jobId]`: Returns job status with progress info

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Email parser | `540fd72` | feat |
| 2 | Email fetcher + Sync API routes | `45e9adc` | feat |

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| src/lib/email/email-parser.ts | HTML->text, threading headers, Graph->Email mapper | 143 |
| src/lib/email/email-fetcher.ts | Paginated fetch, delta sync, upsert, message count | ~180 |
| src/app/api/sync/route.ts | POST — start sync job | ~120 |
| src/app/api/sync/process/route.ts | POST — process next batch | ~380 |
| src/app/api/sync/status/[jobId]/route.ts | GET — sync job status | ~55 |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Upsert with ON CONFLICT | Prevents duplicate emails on re-sync; uses (mailbox_id, internet_message_id) unique constraint |
| 50s safety timeout | Vercel functions have 60s max; 50s gives 10s buffer for cleanup and response |
| 100 messages per batch | Graph API recommended batch size; balances throughput vs. timeout risk |
| No $select on nextLink | @odata.nextLink already contains all query parameters |
| Filter emails without internet_message_id | Cannot deduplicate without unique identifier; skip them |
| Delta link stored on mailbox | Enables incremental sync without re-fetching all messages |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Supabase upsert .select() type error**

- **Found during:** Task 2 verification (npm run build)
- **Issue:** `.select('id', { count: 'exact', head: true })` after `.upsert()` passes 2 arguments to select() but Supabase PostgREST builder only accepts 1 argument after upsert
- **Fix:** Removed `.select()` call and returned `validEmails.length` instead of count
- **Files modified:** src/lib/email/email-fetcher.ts

## Issues / Warnings

- None. All code compiles and build passes.

## Next Phase Readiness

Plan 02-04 (useSyncJob hook, progress bar, sync UI) can now proceed:
- All sync API routes are in place
- Sync lifecycle: pending -> processing -> has_more (loop) -> completed
- Status endpoint returns emails_fetched + emails_total_estimate for progress bar
- Error states (failed + error_message) ready for UI display
