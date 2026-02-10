---
phase: 02-email-connection-fetching
plan: 01
subsystem: email-infrastructure
tags: [msal, graph-api, aes-256-gcm, supabase-migration, typescript-types]

requires:
  - phase: 01
    provides: Next.js app, Supabase auth, admin system, design system

provides:
  - Email domain TypeScript types (Mailbox, SyncJob, Email, Credentials)
  - AES-256-GCM encryption/decryption module
  - Microsoft Graph API authentication (ROPC + client_credentials)
  - Microsoft Graph client factory
  - Supabase tables (mailboxes extended, sync_jobs new, emails extended) with RLS
  - Database indexes for query performance

affects: [02-02, 02-03, 02-04]

tech-stack:
  added:
    - "@azure/msal-node (MSAL authentication)"
    - "@microsoft/microsoft-graph-client (Graph API client)"
    - "@microsoft/microsoft-graph-types (Graph API types)"
    - "html-to-text (email body parsing)"
    - "@types/html-to-text (dev)"
  patterns:
    - "AES-256-GCM encryption with iv:authTag:ciphertext format"
    - "MSAL PublicClientApplication for ROPC flow"
    - "MSAL ConfidentialClientApplication for client_credentials flow"
    - "Graph client factory pattern with token injection"
    - "SQL migration files in supabase/migrations/ (applied via Management API)"

key-files:
  created:
    - src/types/email.ts
    - src/lib/crypto/encrypt.ts
    - src/lib/email/graph-auth.ts
    - src/lib/email/graph-client.ts
    - supabase/migrations/20260210_02_01_email_foundation.sql
  modified:
    - package.json
    - package-lock.json
    - .env.local (gitignored)

key-decisions:
  - "sync_status zmieniony z PostgreSQL enum na TEXT — pozwala na elastyczne dodawanie nowych statusow bez migracji enum"
  - "organization_id, name, provider w mailboxes zmienione na nullable — nowe mailboxy Phase 2 nie wymagaja organizacji"
  - "Stare org-based RLS policies zastapione admin-based (app_allowed_users) — spojne z Phase 1 admin system"
  - "Istniejace kolumny emails zachowane (external_id, thread_id, organization_id) — kompatybilnosc wsteczna"
  - "Plik migracji SQL dodany do repo jako dokumentacja (Supabase CLI broken, migracja via Management API)"

duration: 9min
completed: 2026-02-10
---

# Phase 2 Plan 01: Fundament Emailowy Summary

**Zainstalowano npm dependencies (MSAL, Graph client, html-to-text), utworzono typy email domain, modul AES-256-GCM, Graph API auth z ROPC/client_credentials i polskimi komunikatami bledow, rozszerzono schemat Supabase (mailboxes + emails ALTER, sync_jobs CREATE) z indeksami i admin RLS.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~9 min |
| Started | 2026-02-10T19:23:10Z |
| Completed | 2026-02-10T19:32:35Z |
| Tasks | 3/3 |
| Files created | 5 |
| Files modified | 3 |

## Accomplishments

1. **npm dependencies** -- Zainstalowano 5 pakietow: @azure/msal-node, @microsoft/microsoft-graph-client, @microsoft/microsoft-graph-types, html-to-text, @types/html-to-text
2. **Typy email domain** -- 12 typow/interfejsow w src/types/email.ts: ConnectionType, SyncStatus, SyncJobStatus, SyncJobType, Mailbox, SyncJob, Email, EmailRecipient, ROPCCredentials, ClientCredentialsConfig, MailboxCredentials, MailboxFormData
3. **Modul szyfrowania AES-256-GCM** -- encrypt/decrypt z formatem iv:authTag:ciphertext, klucz z ENCRYPTION_KEY env var
4. **Migracja Supabase** -- mailboxes rozszerzony o 8 kolumn, emails rozszerzony o 13 kolumn, sync_jobs utworzony, 5 indeksow, 3 admin RLS policies
5. **Graph API auth** -- getAccessToken() z MSAL (ROPC + client_credentials), parseGraphAuthError() z 8 polskimi komunikatami bledow AADSTS
6. **Graph client factory** -- createGraphClient() z token injection pattern

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | npm deps + typy + szyfrowanie | b12e7b1 | package.json, src/types/email.ts, src/lib/crypto/encrypt.ts |
| 2 | Migracja Supabase + RLS | 1e5e4fe | supabase/migrations/20260210_02_01_email_foundation.sql |
| 3 | Graph API auth + client factory | 6602942 | src/lib/email/graph-auth.ts, src/lib/email/graph-client.ts |

## Files Created/Modified

### Created
- `src/types/email.ts` -- 97 linii, 12 typow/interfejsow email domain
- `src/lib/crypto/encrypt.ts` -- 83 linie, AES-256-GCM encrypt/decrypt
- `src/lib/email/graph-auth.ts` -- 96 linii, MSAL auth + error parser
- `src/lib/email/graph-client.ts` -- 16 linii, Graph client factory
- `supabase/migrations/20260210_02_01_email_foundation.sql` -- 100 linii, dokumentacja migracji

### Modified
- `package.json` -- dodano 4 dependencies + 1 devDependency
- `package-lock.json` -- zaktualizowany lockfile
- `.env.local` -- dodano zakomentowane ENCRYPTION_KEY, AZURE_TENANT_ID, AZURE_CLIENT_ID (gitignored)

## Decisions Made

1. **sync_status: enum -> TEXT** -- PostgreSQL enum wymagalby migracji przy kazdym nowym statusie. TEXT z walidacja w aplikacji jest bardziej elastyczny.
2. **organization_id nullable** -- Phase 2 mailboxy nie wymagaja organizacji (admin-only). Zachowano FK dla kompatybilnosci wstecznej.
3. **RLS: org-based -> admin-based** -- Stare policies bazowane na organization_members zastapione policies bazowanymi na app_allowed_users (Phase 1 admin system). Service role bypasses RLS automatycznie.
4. **Zachowanie istniejacych kolumn** -- external_id, thread_id, organization_id, sender_email, sender_name, recipients w emails nie zostaly usuniete — dodano nowe kolumny obok nich.
5. **Migracja via Management API** -- Supabase CLI broken, migracje wykonywane przez REST API. Plik SQL w repo jako dokumentacja.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sync_status enum -> TEXT conversion**
- **Found during:** Task 2
- **Issue:** Istniejaca kolumna sync_status uzywa PostgreSQL enum (idle, syncing, error, success) zamiast TEXT. Plan wymaga wartosci 'never_synced', 'synced' ktorych nie ma w enum.
- **Fix:** ALTER COLUMN TYPE TEXT USING sync_status::TEXT, SET DEFAULT 'never_synced'
- **Commit:** 1e5e4fe

**2. [Rule 3 - Blocking] NOT NULL constraints na legacy kolumnach**
- **Found during:** Task 2
- **Issue:** organization_id, name, provider sa NOT NULL — nowe mailboxy Phase 2 nie maja tych wartosci.
- **Fix:** ALTER COLUMN DROP NOT NULL na organization_id, name, provider (w mailboxes) i organization_id, external_id (w emails)
- **Commit:** 1e5e4fe

**3. [Rule 2 - Missing Critical] Stare RLS policies z polskimi znakami**
- **Found during:** Task 2
- **Issue:** Stare policies z polskimi nazwami (UTF-8) nie usuwaly sie przy pierwszej probie (encoding issue w curl). Drugie podejscie z unicode escaping zadziałało.
- **Fix:** Uzyto JSON unicode escaping (\u0142, \u0105) w curl do poprawnego usunięcia policies.
- **Commit:** 1e5e4fe

## Issues Encountered

Brak istotnych problemow. Build przechodzi, wszystkie tabele i kolumny potwierdzone.

## User Setup Required

Przed uruchomieniem Phase 2 planow 02-04 uzytkownik musi:

1. **Utworzyc Azure App Registration:**
   - Azure Portal -> Microsoft Entra ID -> App registrations -> New registration
   - Wlaczyc "Allow public client flows" = YES (Authentication tab)
   - Dodac API permission: Microsoft Graph -> Delegated -> Mail.Read
   - Zapisac: Tenant ID i Client ID

2. **Ustawic zmienne srodowiskowe w .env.local:**
   ```
   ENCRYPTION_KEY=<64 hex chars>
   AZURE_TENANT_ID=<tenant-id>
   AZURE_CLIENT_ID=<client-id>
   ```
   Wygeneruj ENCRYPTION_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. **Ustawic te same zmienne w Vercel Dashboard** (Settings -> Environment Variables)

## Next Phase Readiness

Plan 02-01 dostarcza wszystkie fundamenty dla pozostalych planow Phase 2:

| Plan | Zalezy od | Status |
|------|-----------|--------|
| 02-02 (Mailbox CRUD + UI) | Typy, encrypt, tabela mailboxes | READY |
| 02-03 (Sync engine) | Typy, Graph auth, Graph client, tabele sync_jobs + emails | READY |
| 02-04 (Sync UI) | Wszystko z 02-01 | READY (po 02-02 i 02-03) |

**Blockers:** Azure App Registration musi byc skonfigurowany przed testowaniem polaczenia email (02-02, Task checkpoint).
