# Design: Filtrowanie watkow CC w analizie

**Data:** 2026-02-24
**Status:** Zaakceptowany

## Problem

Skrzynki typu "rzecznik" otrzymuja duzo emaili "do wiadomosci" (CC/BCC), gdzie korespondencja toczy sie miedzy innymi stronami. Wszystkie te watki trafiaja do analizy AI, zasmiecajac wyniki i generujac niepotrzebne koszty.

## Rozwiazanie: Podejscie hybrydowe

Thread-builder oznacza watki flaga `cc_filter_status` (obliczona raz, przy budowie watkow). Analiza filtruje na podstawie tej flagi + ustawienia `cc_filter_mode` per skrzynka.

## Model danych

### Nowa kolumna: `email_threads.cc_filter_status`

```sql
cc_filter_status TEXT NOT NULL DEFAULT 'unknown'
-- Wartosci: 'direct' | 'cc_first_only' | 'cc_always' | 'unknown'
```

| Wartosc | Znaczenie |
|---|---|
| `direct` | Adres skrzynki pojawia sie w `To` w co najmniej jednym mailu watku |
| `cc_first_only` | W pierwszym mailu watku skrzynka jest w CC/BCC, ale w pozniejszych jest w `To` |
| `cc_always` | Skrzynka nigdy nie jest w `To` — we wszystkich mailach jest w CC/BCC |
| `unknown` | Jeszcze nie obliczono (stare watki, migracja) |

### Nowa kolumna: `mailboxes.cc_filter_mode`

```sql
cc_filter_mode TEXT NOT NULL DEFAULT 'off'
-- Wartosci: 'off' | 'never_in_to' | 'first_email_cc'
```

| Wartosc | Filtruje z analizy |
|---|---|
| `off` | Nic — obecne zachowanie |
| `never_in_to` | Watki z `cc_filter_status = 'cc_always'` |
| `first_email_cc` | Watki z `cc_filter_status IN ('cc_always', 'cc_first_only')` |

### Typy TypeScript

```ts
export type CcFilterMode = 'off' | 'never_in_to' | 'first_email_cc';
export type CcFilterStatus = 'direct' | 'cc_first_only' | 'cc_always' | 'unknown';
```

## Logika obliczania cc_filter_status

W `thread-builder.ts`, po zgrupowaniu maili w watki, przed insertem do DB:

```ts
function computeCcFilterStatus(emails, mailboxEmail): CcFilterStatus {
  const mailboxAddr = mailboxEmail.toLowerCase();
  const firstEmailHasTo = emails[0].to_addresses
    ?.some(r => r.address.toLowerCase() === mailboxAddr);
  const anyEmailHasTo = emails
    .some(e => e.to_addresses?.some(r => r.address.toLowerCase() === mailboxAddr));

  if (anyEmailHasTo && firstEmailHasTo) return 'direct';
  if (anyEmailHasTo && !firstEmailHasTo) return 'cc_first_only';
  return 'cc_always';
}
```

Wymaga dociagniecia `to_addresses` do zapytania SELECT w thread-builder (linia 253).

## Logika filtrowania w analizie

Filtrowanie w DWOCH miejscach:

1. **POST /api/analysis (tworzenie joba)** — zliczanie `total_threads` z uwzglednieniem filtra CC
2. **POST /api/analysis/process (przetwarzanie)** — pomijanie watkow CC

```ts
if (ccFilterMode === 'never_in_to') {
  threadQuery = threadQuery.neq('cc_filter_status', 'cc_always');
} else if (ccFilterMode === 'first_email_cc') {
  threadQuery = threadQuery.eq('cc_filter_status', 'direct');
}
```

Watki z `cc_filter_status = 'unknown'` (sprzed migracji) NIE sa filtrowane.

## UI

### Pole w MailboxForm

Select z 3 opcjami pod wyborem profilu analizy:

| Wartosc | Label |
|---|---|
| `off` | Wylaczone |
| `never_in_to` | Pomin — nigdy w polu "Do" |
| `first_email_cc` | Pomin — pierwszy mail jako DW |

Opis pomocniczy: "Pomijaj watki, w ktorych skrzynka jest tylko w polu DW/UDW."

### Auto-default przy zmianie profilu

- `case_analytics` -> automatycznie `never_in_to`
- `communication_audit` -> automatycznie `off`

Uzytkownik widzi zmiane i moze ja nadpisac.

## Zakres zmian

1. **Migracja SQL** — 2 nowe kolumny + update istniejacych skrzynek
2. **Typy** (`src/types/email.ts`) — nowe typy + rozszerzenie interfejsow
3. **Thread builder** (`src/lib/threading/thread-builder.ts`) — obliczanie `cc_filter_status`
4. **Analysis routes** (`src/app/api/analysis/route.ts`, `process/route.ts`) — filtrowanie CC
5. **Mailbox API** (`src/app/api/mailboxes/`) — obsluga nowego pola w CRUD
6. **UI** (`src/components/email/MailboxForm.tsx`) — pole select + auto-default

## Wazne edge case'y

- **BCC**: Jesli skrzynka jest w UDW, jej adres NIE pojawi sie w `to_addresses` ani `cc_addresses` (Graph API nie eksponuje BCC na odebranych mailach). Takie watki beda traktowane jak `cc_always` — zgodnie z celem filtrowania.
- **Stare watki**: `cc_filter_status = 'unknown'` przechodzi przez kazdy filtr — wymaga przebudowy watkow.
- **Jezyk skrzynki**: Nie ma problemu — Graph API zawsze zwraca ustandaryzowane pola (`toRecipients`, `ccRecipients`) niezaleznie od jezyka Outlooka.
