# Phase 2: Email Connection & Fetching - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Podłączenie skrzynek Outlook (Microsoft 365) i pobranie tysięcy maili do bazy danych Supabase z widocznym progressem. Admin zarządza skrzynkami (dodawanie, usuwanie, test połączenia, sync). Obejmuje bulk sync (pierwsze pobranie), delta sync (nowe maile) oraz parsowanie nagłówków i treści.

Nie obejmuje: grupowanie w wątki (Phase 3), analiza AI (Phase 4), raporty (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Typ skrzynki i protokół
- Skrzynki: **Microsoft 365** (potwierdzone — outlook.office365.com działa)
- Protokół: **Microsoft Graph API** — najlepszy wybór dla M365
- Skala: **4–10 skrzynek**, każda z **1k–10k maili**
- Claude's Discretion: wybór konkretnej biblioteki Graph API, paginacja, rate limiting

### Credentials i bezpieczeństwo
- Część skrzynek ma dostęp do Azure Portal, część nie — niepewne
- Podejście: **login + hasło z szyfrowaniem AES-256** jako primary (działa zawsze)
- Opcjonalnie: OAuth2 jako upgrade path (jeśli Azure App Registration dostępne)
- Claude's Discretion: czy implementować oba warianty od razu, czy zacząć od login+hasło i dodać OAuth później
- Hasła szyfrowane AES-256-GCM w bazie, deszyfrowane server-side (wzorzec z Marketing Hub)

### Sync i progress
- **Pierwszy sync: pobierz wszystkie maile** z całej skrzynki (bez filtrowania czasowego)
- **Kolejne synce: delta sync** — tylko nowe maile od ostatniego pobrania
- **Sync w tle** z progress barem — admin uruchamia, może robić inne rzeczy, powiadomienie po zakończeniu
- **Odświeżanie: oba warianty** — ręczne (przycisk "Odśwież") + opcjonalny harmonogram (np. codziennie)
- Claude's Discretion: implementacja background jobs (polling vs SSE vs websocket), batching strategy, harmonogram (cron vs Supabase scheduled functions)

### UI zarządzania skrzynkami
- **Tylko admin** może dodawać/zarządzać skrzynkami
- Lokalizacja w nawigacji: Claude's Discretion (Analizator Email lub Ustawienia)
- Lista skrzynek pokazuje:
  - Email skrzynki (adres)
  - Status połączenia (zielony/czerwony wskaźnik)
  - Statystyki sync (liczba pobranych maili, data ostatniego sync, progress bieżącego sync)
- Akcje: dodaj skrzynkę, usuń, test połączenia, uruchom sync, odśwież (delta sync)
- Claude's Discretion: dokładny layout, formularz dodawania, potwierdzenia usunięcia

### Claude's Discretion (ogólne)
- Architektura background jobs (Next.js API routes + polling, czy potrzebny queue system)
- Struktura tabel Supabase (mailboxes, sync_jobs, emails)
- Parsowanie maili (charset detection, HTML→plaintext, polskie znaki)
- Error handling i retry strategy
- Rate limiting Microsoft Graph API

</decisions>

<specifics>
## Specific Ideas

- Istniejące tabele Supabase z poprzedniej wersji: mailboxes, mailbox_credentials, emails — mogą być bazą lub wymagać migracji
- Wzorzec szyfrowania credentials z Marketing Hub (AES-256-GCM, ENCRYPTION_KEY env var)
- Admin panel już istnieje (Phase 1) — UI skrzynek powinno być spójne stylistycznie
- Język: TYLKO PL (etykiety, komunikaty, statusy)

</specifics>

<deferred>
## Deferred Ideas

None — dyskusja pozostała w zakresie Phase 2.

</deferred>

---

*Phase: 02-email-connection-fetching*
*Context gathered: 2026-02-10*
