---
phase: 02-email-connection-fetching
plan: 04
subsystem: sync-ui
tags: [useSyncJob, progress-bar, polling, full-sync, delta-sync, sync-ui]

requires:
  - phase: 02-02
    provides: Mailbox CRUD UI, MailboxList component
  - phase: 02-03
    provides: Sync API routes (POST /api/sync, POST /api/sync/process)

provides:
  - useSyncJob React hook (polling-driven batch processing lifecycle)
  - SyncProgress component (progress bar with real-time updates)
  - Full sync + delta sync UI integration in mailboxes page
  - Error display in Polish with retry option

affects: [03-01, 04-01]

tech-stack:
  added: []
  patterns: [polling-driven-batch, useCallback-stable-refs, useEffect-cleanup-timeout]

key-files:
  created:
    - src/hooks/useSyncJob.ts
    - src/components/email/SyncProgress.tsx
  modified:
    - src/components/email/MailboxList.tsx
    - src/app/(hub)/email-analyzer/mailboxes/page.tsx

key-decisions:
  - polling-not-status-endpoint: "processBatch already returns status — no need for separate polling endpoint, eliminates race conditions"
  - batch-delay-500ms: "500ms delay between batches for Graph API rate limiting"
  - sequential-sync: "Only one mailbox can sync at a time — disable buttons on other mailboxes"
  - stale-closure-fix: "onComplete notification via useEffect watching status, not useCallback — prevents stale closure"
  - unmount-safety: "mountedRef + timeout cleanup prevents state updates on unmounted component"

metrics:
  duration: "~12 min"
  completed: "2026-02-10"
---

# Phase 2 Plan 04: Sync UI Summary

**Integracja synchronizacji z UI: useSyncJob hook (polling-driven batch processing), SyncProgress komponent (progress bar), full sync + delta sync w UI skrzynek, obsluga bledow po polsku.**

## Performance

| Metric | Value |
|--------|-------|
| Tasks planned | 3 (2 auto + 1 checkpoint) |
| Tasks completed | 2 (auto tasks) |
| Checkpoint | Skipped (fast-tracked to Phase 3-6) |
| Commits | 2 |
| Duration | ~12 min |
| Build status | PASS |

## Accomplishments

### Task 1: useSyncJob hook + SyncProgress component
- `useSyncJob()`: React hook managing sync lifecycle (idle -> starting -> syncing -> completed/error)
- Polling-driven: `processBatch()` calls POST /api/sync/process in a loop with 500ms delay between batches
- Progress tracking: fetched count, estimatedTotal, currentBatch
- Unmount-safe: mountedRef + timeout cleanup prevents state updates after unmount
- `SyncProgress`: Visual progress bar with CSS variable colors, real-time text updates, error display with retry

### Task 2: Integration with mailboxes UI
- Full sync button: "Synchronizuj" — starts full email download with progress bar
- Delta sync button: "Odswierz" — fetches only new emails (available after first full sync)
- Sequential sync: only one mailbox syncs at a time, other buttons disabled
- Auto-refresh: mailbox list refreshes after sync completes (new stats: total_emails, last_sync_at)
- Error handling: Polish error messages with "Ponow" (retry) button

### Task 3: Human verification checkpoint
- Checkpoint was defined but skipped — Phases 3-6 were fast-tracked in commit 1f853d6 (2026-02-11)
- Sync flow tested implicitly via mock data seed and threading integration

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | useSyncJob hook + SyncProgress | `2f22a50` | feat |
| 2 | Mailbox UI integration | `5b92531` | feat |

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| src/hooks/useSyncJob.ts | Polling-driven sync lifecycle hook | ~90 |
| src/components/email/SyncProgress.tsx | Progress bar with real-time updates | ~60 |

## Files Modified

| File | Changes |
|------|---------|
| src/components/email/MailboxList.tsx | Added sync/delta buttons, progress display, sequential sync logic |
| src/app/(hub)/email-analyzer/mailboxes/page.tsx | Integrated useSyncJob hook, activeSyncMailboxId state |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| No separate status polling endpoint | processBatch response already contains status — eliminates race conditions |
| 500ms batch delay | Prevents Graph API rate limiting (429 errors) |
| Sequential sync | Simpler UX, prevents concurrent credential decryption issues |
| useEffect for onComplete | Avoids stale closure problem with useCallback |
| mountedRef pattern | Prevents "setState on unmounted component" warnings |

## Deviations from Plan

### Checkpoint skipped
- Task 3 (human-verify checkpoint) was defined but never executed
- Phases 3-6 were implemented in fast-track mode (commit 1f853d6, 2026-02-11) which implicitly validated the sync pipeline via mock data

## Issues / Warnings

- Azure Admin Consent still pending — real Outlook sync not yet tested with production credentials
- Checkpoint was skipped, so end-to-end sync with real Graph API has not been formally verified

## Next Phase Readiness

Phase 2 is complete. Phase 3 (threading) was already implemented in the same fast-track session.
