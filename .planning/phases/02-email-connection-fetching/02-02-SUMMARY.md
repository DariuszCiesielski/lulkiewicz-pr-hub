---
phase: 02-email-connection-fetching
plan: 02
subsystem: api, ui
tags: [graph-api, aes-256-gcm, crud, next.js, supabase, mailbox]

requires:
  - phase: 02-01
    provides: DB schema (mailboxes, emails, sync_jobs), typy TS, encrypt/decrypt, Graph API auth + client
provides:
  - API routes CRUD skrzynek (GET/POST/DELETE) z szyfrowaniem credentials
  - API route test connection (Graph API inbox query)
  - UI zarządzania skrzynkami (formularz, lista, statusy)
  - Redirect /email-analyzer → /email-analyzer/mailboxes
  - Sidebar link "Skrzynki" (admin only)
affects: [02-04-sync-ui, phase-3-threading]

tech-stack:
  added: []
  patterns:
    - "verifyAdmin() pattern for admin-only API routes"
    - "jasna wyspa modal pattern (bg-white on dark overlay)"
    - "comingSoon sidebar items (disabled with label)"

key-files:
  created:
    - src/app/api/mailboxes/route.ts
    - src/app/api/mailboxes/[id]/route.ts
    - src/app/api/mailboxes/[id]/test-connection/route.ts
    - src/app/(hub)/email-analyzer/page.tsx
    - src/app/(hub)/email-analyzer/mailboxes/page.tsx
    - src/components/email/MailboxList.tsx
    - src/components/email/MailboxForm.tsx
    - src/components/email/ConnectionStatus.tsx
  modified:
    - src/components/layout/Sidebar.tsx

key-decisions:
  - "Redirect /email-analyzer → /mailboxes (brak dedykowanej strony głównej modułu)"
  - "comingSoon pattern w sidebarze dla niezaimplementowanych stron"

duration: ~15min (tasks pre-committed, checkpoint + fixes)
completed: 2026-02-10
---

# Phase 2 Plan 02: Mailbox CRUD + Test Connection + UI Summary

**API CRUD skrzynek z AES-256-GCM szyfrowanie credentials, test połączenia Graph API, UI zarządzania z formularzem i listą statusów**

## Performance

- **Duration:** ~15 min (taski pre-committed, czas na checkpoint + naprawy)
- **Tasks:** 2 auto + 1 checkpoint (human-verify)
- **Files created:** 8
- **Files modified:** 1

## Accomplishments
- 3 API routes: GET/POST mailboxes, GET/DELETE mailboxes/[id], POST test-connection
- Credentials szyfrowane AES-256-GCM przed zapisem, nigdy nie zwracane w response
- Test connection: decrypt → getAccessToken → Graph API inbox query → wynik po polsku
- UI: strona zarządzania skrzynkami, formularz "jasna wyspa", lista ze statusami, ConnectionStatus
- Sidebar link "Skrzynki" (admin only) + "Ustawienia" jako comingSoon

## Task Commits

1. **Task 1: API routes CRUD + test connection** - `c7560f5` (feat)
2. **Task 2: UI zarządzania skrzynkami** - `95f07ae` (feat)
3. **Fix: routing 404 + usunięcie wyciekłego tokenu** - `41dc226` (fix)
4. **Fix: sidebar ustawienia coming soon** - `d1930f2` (fix)

## Files Created/Modified
- `src/app/api/mailboxes/route.ts` — GET lista z email_count, POST z encrypt
- `src/app/api/mailboxes/[id]/route.ts` — GET/DELETE pojedynczej skrzynki
- `src/app/api/mailboxes/[id]/test-connection/route.ts` — POST test Graph API
- `src/app/(hub)/email-analyzer/page.tsx` — redirect do /mailboxes
- `src/app/(hub)/email-analyzer/mailboxes/page.tsx` — strona zarządzania (admin)
- `src/components/email/MailboxList.tsx` — lista ze statusami i akcjami
- `src/components/email/MailboxForm.tsx` — formularz "jasna wyspa"
- `src/components/email/ConnectionStatus.tsx` — kolorowe wskaźniki sync
- `src/components/layout/Sidebar.tsx` — link Skrzynki + comingSoon pattern

## Decisions Made
- Redirect /email-analyzer → /mailboxes zamiast osobnej strony głównej modułu
- comingSoon pattern w sidebarze (wyszarzone + etykieta "Wkrótce")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Brakujący /email-analyzer/page.tsx powodował 404**
- **Found during:** Checkpoint verification
- **Issue:** Karta "Analizator Email" na dashboard linkowała do /email-analyzer, ale strona nie istniała
- **Fix:** Utworzono page.tsx z redirect do /email-analyzer/mailboxes
- **Committed in:** 41dc226

**2. [Rule 1 - Bug] Link "Ustawienia" w sidebarze powodował 404**
- **Found during:** Checkpoint verification
- **Issue:** Sidebar zawierał link do /settings, strona nie istnieje
- **Fix:** Dodano comingSoon pattern — link wyszarzone z etykietą "Wkrótce"
- **Committed in:** d1930f2

**3. [Rule 2 - Missing Critical] Wyciek tokenu Supabase w plikach .planning/**
- **Found during:** Checkpoint verification (GitHub alert)
- **Issue:** sbp_ token commitowany w STATE.md i 02-01-PLAN.md
- **Fix:** Usunięto tokeny, user zrotował na nowy
- **Committed in:** 41dc226

---

**Total deviations:** 3 (2 bugs, 1 security)
**Impact on plan:** Wszystkie naprawy konieczne dla poprawnego działania i bezpieczeństwa.

## Issues Encountered
- Fantomowa skrzynka dariusz.ciesielski@o2.pl w bazie — prawdopodobnie dane testowe z wcześniejszej sesji. User poinformowany o opcji usunięcia.

## User Setup Required
None — Azure App Registration wymaga konfiguracji (AZURE_TENANT_ID, AZURE_CLIENT_ID), ale to blocker z Phase 2 research, nie z tego planu.

## Next Phase Readiness
- Mailbox CRUD + UI gotowe dla planu 02-04 (Sync UI)
- Plan 02-03 (Sync Engine) już ukończony
- Gotowe do Wave 3: integracja sync z UI

---
*Phase: 02-email-connection-fetching*
*Completed: 2026-02-10*
