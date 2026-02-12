# Phase 8: Group Management - Research

**Researched:** 2026-02-12
**Domain:** CRUD grup FB, settings management, encryption, bulk operations
**Confidence:** HIGH

## Summary

Phase 8 implementuje zarzadzanie grupami FB (CRUD + bulk ops + soft delete) oraz konfiguracje credentiali Apify (token + cookies). Calosc bazuje na istniejacych wzorcach z email-analyzer: API routes z `verifyAdmin()` + `getAdminClient()`, modal/formularz dodawania, szyfrowanie via `encrypt.ts`.

Kluczowe odkrycia z analizy kodu:
- Tabela `fb_groups` juz istnieje (Phase 7) ale brakuje kolumn: `ai_instruction`, `deleted_at`, `cookies_encrypted`, potrzebny ALTER TABLE
- Brak tabeli na globalne ustawienia FB Analyzer -- potrzebna nowa tabela `fb_settings` (wzorzec z `ai_config`)
- Istniejacy shell page `groups/page.tsx` uzywa mock data -- do zastapienia prawdziwym API
- Shell page `settings/page.tsx` ma juz layout UI ale bez funkcjonalnosci

**Primary recommendation:** Replikuj wzorzec mailboxes CRUD (API + komponenty) z rozszerzeniami: tabela zamiast kart, sekcje per deweloper, bulk operations z checkboxami, soft delete zamiast hard delete.

## Standard Stack

### Core (juz w projekcie -- ZERO nowych npm deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 | 15.x | App Router, API routes | Istniejacy stack |
| React 19 | 19.x | UI components | Istniejacy stack |
| Supabase JS | latest | Database client | Istniejacy stack |
| lucide-react | latest | Icons | Istniejacy stack |
| crypto (Node) | built-in | AES-256-GCM | Istniejacy `encrypt.ts` |

### Supporting (juz w projekcie)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | latest | Styling + CSS variables | Wszystkie komponenty |

### Alternatives Considered
Nie dotyczy -- wszystko reuse z istniejacego stacku. ZERO nowych zaleznosci.

**Installation:**
```bash
# Nic nie trzeba instalowac
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (hub)/fb-analyzer/
      groups/page.tsx              # REPLACE shell (mock -> real API)
      settings/page.tsx            # REPLACE shell (mock -> real API)
    api/
      fb-groups/
        route.ts                   # GET (list) + POST (create single/bulk)
        [id]/
          route.ts                 # GET + PATCH + DELETE (soft delete)
        bulk/
          route.ts                 # PATCH (bulk status/developer/delete)
        developers/
          route.ts                 # GET (distinct developers for autosuggest)
      fb-settings/
        route.ts                   # GET + POST (Apify token, cookies, actor)
  components/
    fb/
      GroupTable.tsx               # Tabela z sekcjami per deweloper + checkboxy
      GroupFormModal.tsx            # Modal: dodaj/edytuj grupe (single)
      GroupBulkUpload.tsx           # Upload pliku z URL-ami
      BulkActionToolbar.tsx         # Toolbar nad tabela (zmien status, usun, developer)
      SettingsForm.tsx              # Formularz ustawien (token, cookies, actor)
  types/
    fb.ts                          # UPDATE: nowe pola w FbGroup + FbSettings interface
```

### Pattern 1: Admin CRUD API Route (istniejacy wzorzec)
**What:** Kazda route: `verifyAdmin()` -> `getAdminClient()` -> operacja Supabase
**When to use:** Wszystkie API routes w tej fazie
**Example:**
```typescript
// Source: src/app/api/mailboxes/route.ts (istniejacy wzorzec)
import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }
  const adminClient = getAdminClient();
  const { data, error } = await adminClient
    .from('fb_groups')
    .select('*')
    .is('deleted_at', null)  // WAZNE: filtruj soft-deleted
    .order('developer', { ascending: true });
  // ...
}
```

### Pattern 2: Szyfrowanie credentiali (istniejacy wzorzec)
**What:** `encrypt()` przy zapisie, `decrypt()` przy odczycie, nigdy nie zwracaj plain text do klienta
**When to use:** Apify token, FB cookies (globalne i per grupa)
**Example:**
```typescript
// Source: src/lib/crypto/encrypt.ts + src/app/api/mailboxes/route.ts
import { encrypt, decrypt } from '@/lib/crypto/encrypt';

// Zapis:
const encryptedToken = encrypt(apifyToken);
// -> zapisz encryptedToken do DB

// Odczyt (server-side only, np. Phase 9 scraping):
const plainToken = decrypt(encryptedToken);
// -> uzyj do API call

// NIGDY nie zwracaj decrypted do klienta!
// GET response: { has_apify_token: true } (boolean flag, nie wartosc)
```

### Pattern 3: Super Admin Check (nowy wzorzec)
**What:** Server-side sprawdzenie hardcoded email na routach zmiany Actor ID
**When to use:** PATCH fb-settings gdy zmieniane jest pole `apify_actor_id`
**Example:**
```typescript
// Nowy wzorzec — rozszerzenie istniejacego verifyAdmin()
import { createClient as createServerClient } from '@/lib/supabase/server';

const SUPER_ADMIN_EMAIL = 'dariusz.ciesielski.71@gmail.com';

async function verifySuperAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === SUPER_ADMIN_EMAIL;
}

// W route:
if (body.apify_actor_id && !(await verifySuperAdmin())) {
  return NextResponse.json({ error: 'Tylko super admin moze zmieniac Actor ID' }, { status: 403 });
}
```

### Pattern 4: Soft Delete
**What:** Kolumna `deleted_at TIMESTAMPTZ NULL`, filtrowanie `.is('deleted_at', null)` w zapytaniach
**When to use:** Usuwanie grup (zamiast hard delete z CASCADE)
**Example:**
```typescript
// Soft delete:
await adminClient
  .from('fb_groups')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', groupId);

// List (exclude deleted):
await adminClient
  .from('fb_groups')
  .select('*')
  .is('deleted_at', null);
```

### Pattern 5: Modal (istniejacy wzorzec z MailboxForm)
**What:** Fixed overlay z formularzem, `onSubmit` + `onClose` props
**When to use:** Dodawanie i edycja grupy
**Example:**
```typescript
// Source: src/components/email/MailboxForm.tsx
// Wzorzec: fixed inset-0 z-50, bg-black/50, max-w-lg
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="w-full max-w-lg rounded-lg p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto"
       style={{ backgroundColor: 'var(--bg-secondary)' }}>
    {/* form content */}
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Hard delete grup:** Uzywaj soft delete (`deleted_at`). CASCADE usunelby posty i komentarze.
- **Dekodowanie credentiali w GET:** Nigdy nie zwracaj decrypted tokenu/cookies do frontendu. Uzywaj flag boolean: `has_apify_token`, `has_cookies`.
- **Osobna tabela developers:** CONTEXT decyzja = free text z autosuggest. SELECT DISTINCT developer FROM fb_groups.
- **Hardcoded kolory w bg-white:** Uzywaj CSS variables (`--bg-secondary`, `--text-primary`). MailboxForm uzywa bg-white — to bug, nie wzorzec.
- **Nowa tabela na dewelopera:** Developer to free text pole w fb_groups, NIE osobna tabela.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Szyfrowanie AES-256 | Wlasna implementacja crypto | `src/lib/crypto/encrypt.ts` (encrypt/decrypt) | Juz przetestowane, AES-256-GCM z auth tag |
| Admin authorization | Wlasne middleware auth | `verifyAdmin()` z `src/lib/api/admin.ts` | 21+ routes juz go uzywa |
| Admin DB client | createClient z service key | `getAdminClient()` z `src/lib/api/admin.ts` | Pomija RLS, lazy init |
| Facebook URL parsing | Wlasny regex parser | Prosty regex `/facebook\.com\/groups\//` | Wystarczajacy do walidacji |
| Modal overlay | Wlasny system modalow | Wzorzec z MailboxForm (fixed inset-0 z-50) | Juz dziala w projekcie |
| Tabela UI | Zewnetrzna biblioteka tabel | Recznie z `<table>` + CSS variables | Wzorzec projektu, zero nowych deps |

**Key insight:** Cala faza bazuje na replikacji istniejacych wzorcow z email-analyzer. Nie ma potrzeby nowych bibliotek ani nowych wzorcow architektonicznych.

## Common Pitfalls

### Pitfall 1: Brak filtrowania soft-deleted w GET
**What goes wrong:** Usuniete grupy pojawiaja sie na liscie
**Why it happens:** Zapomniano o `.is('deleted_at', null)` w zapytaniu
**How to avoid:** Kazde SELECT z fb_groups MUSI miec `.is('deleted_at', null)` (chyba ze wyswietlamy "kosz")
**Warning signs:** Grupy ze statusem "deleted" na liscie

### Pitfall 2: Zwracanie decrypted credentiali w API response
**What goes wrong:** Token/cookies wyciekaja do frontendu
**Why it happens:** Kopiowanie wzorca GET bez filtrowania kolumn
**How to avoid:** Uzywaj explicite SELECT columns (nie `*`), nigdy nie uwzgledniaj `*_encrypted` kolumn
**Warning signs:** Pole `apify_token_encrypted` w JSON response

### Pitfall 3: Brak walidacji FB URL przy bulk upload
**What goes wrong:** Smieci w bazie, scraping failuje
**Why it happens:** Upload pliku bez walidacji kazdej linii
**How to avoid:** Waliduj kazdy URL regexem, zwracaj raport z bledami per linia
**Warning signs:** Wpisy z pustym/niewlasciwym facebook_url

### Pitfall 4: Race condition w bulk operations
**What goes wrong:** Czesciowa aktualizacja (np. 3 z 5 grup zaktualizowane)
**Why it happens:** Promise.all z osobnymi UPDATE per grupa
**How to avoid:** Uzywaj jednego `.in('id', ids)` zamiast petli — Supabase obsluguje to atomowo
**Warning signs:** Niespojne statusy po bulk operacji

### Pitfall 5: Developer autosuggest bez debounce
**What goes wrong:** Za duzo requestow do API, lag w UI
**Why it happens:** Fetch na kazdy keystroke
**How to avoid:** Debounce 300ms na polu developer, ALBO zaladuj distinct developers raz przy renderze strony (mala ilosc danych)
**Warning signs:** Opuzniony UI przy wpisywaniu nazwy dewelopera

### Pitfall 6: Cookies override per group bez fallback
**What goes wrong:** Scraping failuje bo nie ustawiono cookies per grupa ani globalnie
**Why it happens:** Logika sprawdza TYLKO per-group cookies, pomija globalne
**How to avoid:** Kolejnosc: per-group cookies -> globalne cookies -> error "brak cookies"
**Warning signs:** Blad "missing cookies" mimo skonfigurowanych globalnych

## Code Examples

### Istniejacy schemat fb_groups (Phase 7)
```sql
-- Source: supabase/migrations/20260212_07_01_fb_analyzer.sql
CREATE TABLE IF NOT EXISTS fb_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  facebook_url TEXT NOT NULL,
  developer TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  last_scraped_at TIMESTAMPTZ,
  total_posts INTEGER NOT NULL DEFAULT 0,
  apify_actor_id TEXT DEFAULT 'curious_coder/facebook-post-scraper',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Wymagana migracja ALTER TABLE fb_groups
```sql
-- Phase 8: nowe kolumny
ALTER TABLE fb_groups
  ADD COLUMN IF NOT EXISTS ai_instruction TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cookies_encrypted TEXT;
  -- ai_instruction: instrukcja AI (free text) co szukac w postach tej grupy
  -- deleted_at: soft delete (NULL = aktywna, timestamp = usunieta)
  -- cookies_encrypted: override cookies per grupa (AES-256-GCM encrypted, NULL = uzyj globalnych)

CREATE INDEX IF NOT EXISTS idx_fb_groups_deleted_at ON fb_groups(deleted_at);
```

### Nowa tabela fb_settings (globalne ustawienia FB Analyzer)
```sql
-- Phase 8: globalne ustawienia
CREATE TABLE IF NOT EXISTS fb_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_encrypted TEXT,          -- zaszyfrowana wartosc (dla tokenow/cookies)
  value_plain TEXT,              -- niezaszyfrowana wartosc (dla non-sensitive)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER fb_settings_updated_at
  BEFORE UPDATE ON fb_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE fb_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on fb_settings" ON fb_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

-- Klucze ustawien:
-- 'apify_token'           -> value_encrypted (globalny token API Apify)
-- 'fb_cookies'            -> value_encrypted (globalne cookies FB, JSON string)
-- 'apify_actor_id'        -> value_plain (globalny actor, domyslnie juz w fb_groups.apify_actor_id)
-- 'default_ai_instruction_<developer>' -> value_plain (domyslna instrukcja per deweloper)
```

### API Route: GET /api/fb-groups (lista z agregatami)
```typescript
// Wzorzec z /api/mailboxes/route.ts
import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

const GROUP_SELECT_COLUMNS = `
  id, name, facebook_url, developer, status,
  last_scraped_at, total_posts, ai_instruction,
  apify_actor_id, created_at, updated_at
`;

export async function GET(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const developer = searchParams.get('developer');
  const status = searchParams.get('status');

  const adminClient = getAdminClient();
  let query = adminClient
    .from('fb_groups')
    .select(GROUP_SELECT_COLUMNS)
    .is('deleted_at', null);

  if (developer) query = query.eq('developer', developer);
  if (status) query = query.eq('status', status);

  query = query.order('developer', { ascending: true, nullsFirst: false })
               .order('name', { ascending: true });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pobierz relevant_posts count per grupa
  const groupIds = (data || []).map(g => g.id);
  const { data: relevantCounts } = await adminClient
    .from('fb_posts')
    .select('group_id')
    .in('group_id', groupIds)
    .gte('relevance_score', 0.5);

  const relevantMap: Record<string, number> = {};
  (relevantCounts || []).forEach(row => {
    relevantMap[row.group_id] = (relevantMap[row.group_id] || 0) + 1;
  });

  const enriched = (data || []).map(g => ({
    ...g,
    relevant_posts: relevantMap[g.id] || 0,
    has_custom_cookies: false, // nie zwracamy wartosci, tylko flag
  }));

  return NextResponse.json(enriched);
}
```

### Walidacja Facebook URL
```typescript
// Prosta walidacja URL grupy FB
function isValidFbGroupUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.facebook.com' || parsed.hostname === 'facebook.com') &&
      parsed.pathname.startsWith('/groups/')
    );
  } catch {
    return false;
  }
}

// Parsowanie pliku z URL-ami (bulk upload)
function parseUrlFile(content: string): { valid: string[]; invalid: { line: number; url: string }[] } {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const valid: string[] = [];
  const invalid: { line: number; url: string }[] = [];

  lines.forEach((url, index) => {
    if (isValidFbGroupUrl(url)) {
      valid.push(url);
    } else {
      invalid.push({ line: index + 1, url });
    }
  });

  return { valid, invalid };
}
```

### Bulk Operations (PATCH /api/fb-groups/bulk)
```typescript
export async function PATCH(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const body = await request.json();
  const { ids, action, value } = body as {
    ids: string[];
    action: 'set_status' | 'set_developer' | 'soft_delete';
    value?: string;
  };

  if (!ids?.length) {
    return NextResponse.json({ error: 'Brak wybranych grup' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  switch (action) {
    case 'set_status':
      await adminClient
        .from('fb_groups')
        .update({ status: value }) // 'active' | 'paused'
        .in('id', ids);
      break;
    case 'set_developer':
      await adminClient
        .from('fb_groups')
        .update({ developer: value })
        .in('id', ids);
      break;
    case 'soft_delete':
      await adminClient
        .from('fb_groups')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids);
      break;
  }

  return NextResponse.json({ success: true, updated: ids.length });
}
```

### Developer Autosuggest (GET /api/fb-groups/developers)
```typescript
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { data } = await getAdminClient()
    .from('fb_groups')
    .select('developer')
    .not('developer', 'is', null)
    .is('deleted_at', null);

  const unique = [...new Set((data || []).map(r => r.developer).filter(Boolean))];
  return NextResponse.json(unique.sort());
}
```

## Existing Code Analysis

### 1. fb_groups tabela — co istnieje vs co brakuje

| Kolumna | Istnieje? | Potrzebna? | Uwagi |
|---------|-----------|------------|-------|
| id | TAK | TAK | UUID PK |
| name | TAK | TAK | |
| facebook_url | TAK | TAK | |
| developer | TAK | TAK | Free text |
| status | TAK | TAK | CHECK: active/paused |
| last_scraped_at | TAK | TAK | |
| total_posts | TAK | TAK | |
| apify_actor_id | TAK | TAK | Default w DB |
| created_at | TAK | TAK | |
| updated_at | TAK | TAK | Trigger istnieje |
| **ai_instruction** | **NIE** | **TAK** | TEXT, instrukcja co AI ma szukac |
| **deleted_at** | **NIE** | **TAK** | TIMESTAMPTZ, soft delete |
| **cookies_encrypted** | **NIE** | **TAK** | TEXT, override cookies per grupa |

### 2. Globalne ustawienia — nowa tabela fb_settings

Wzorzec z `ai_config`: single-row per klucz, `is_active` flag. Ale `ai_config` to specyficzny schemat (provider + model + temperature). Dla FB settings lepszy key-value store bo ustawienia sa roznorodne:
- Apify token (encrypted)
- FB cookies (encrypted JSON)
- Default AI instructions per developer (plain text)

Rekomendacja: **Nowa tabela `fb_settings`** z kolumnami `key`, `value_encrypted`, `value_plain`.

### 3. Shell pages do zamiany

| Plik | Stan obecny | Co zrobic |
|------|-------------|-----------|
| `(hub)/fb-analyzer/groups/page.tsx` | Mock data (karty) | Zamienic na tabele z real API, sekcje per deweloper, checkboxy, bulk |
| `(hub)/fb-analyzer/settings/page.tsx` | Mock data (static) | Zamienic na formularz z real API, szyfrowanie |

### 4. Super admin check — wzorzec

Na backendzie: odczytaj email z Supabase auth session, porownaj z hardcoded `SUPER_ADMIN_EMAIL`.
Na frontendzie: `user?.email === SUPER_ADMIN_EMAIL` z AuthContext — pokaz/ukryj sekcje Actor ID.

**UWAGA:** AuthContext eksponuje `user: User | null` (Supabase User object ktory ma `.email`). Mozna uzyc bezposrednio.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard delete (mailboxes) | Soft delete (fb_groups) | Phase 8 | Dane zachowane, mozliwosc przywrocenia |
| Karty per item (shell) | Tabela z sekcjami per developer | Phase 8 | Lepszy overview duzej ilosci grup |
| Brak bulk ops (mailboxes) | Checkboxy + toolbar bulk | Phase 8 | Efektywne zarzadzanie wieloma grupami |

**Note:** MailboxForm.tsx uzywa hardcoded `bg-white` i `text-slate-*` zamiast CSS variables. To legacy — nowe komponenty MUSZA uzywac CSS variables pattern (`--bg-secondary`, `--text-primary` etc.).

## Open Questions

1. **Czy potrzebny jest "kosz" (lista soft-deleted grup)?**
   - Co wiemy: CONTEXT mowi "soft delete, dane zachowane, mozliwosc przywrocenia"
   - Co jest niejasne: Czy budowac UI do przegladania/przywracania usunietych grup?
   - Rekomendacja: W MVP nie -- przywracanie przez zmiane deleted_at na NULL w SQL. UI kosza jako future feature.

2. **Jak przechowywac "domyslna instrukcja per deweloper"?**
   - Co wiemy: Developer to free text, nie ma tabeli developers
   - Co jest niejasne: Gdzie zapisac domyslna instrukcje AI skoro nie ma tabeli developers?
   - Rekomendacja: `fb_settings` z key = `developer_instruction:{developer_name}`. Przy tworzeniu grupy -- lookup istniejacych instrukcji po developer name.

3. **Limit bulk upload -- ile URL naraz?**
   - Co wiemy: User uploaduje plik z URL-ami
   - Co jest niejasne: Jaki limit? 10? 100? 1000?
   - Rekomendacja: Max 100 URL per upload. Walidacja client-side + server-side. Parsuj linia po linii, zwroc raport bledow.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260212_07_01_fb_analyzer.sql` -- schemat fb_groups
- `src/lib/crypto/encrypt.ts` -- API szyfrowania
- `src/lib/api/admin.ts` -- wzorzec auth admin
- `src/app/api/mailboxes/route.ts` -- wzorzec CRUD API
- `src/app/api/mailboxes/[id]/route.ts` -- wzorzec GET/DELETE per ID
- `src/app/api/ai-config/route.ts` -- wzorzec settings storage
- `src/components/email/MailboxForm.tsx` -- wzorzec modal formularza
- `src/components/email/MailboxList.tsx` -- wzorzec listy z akcjami
- `src/app/(hub)/fb-analyzer/groups/page.tsx` -- shell page do zastapienia
- `src/app/(hub)/fb-analyzer/settings/page.tsx` -- shell page do zastapienia
- `src/types/fb.ts` -- istniejace typy FB
- `src/lib/mock/fb-mock-data.ts` -- mock data do usuniecia

### Secondary (MEDIUM confidence)
- Brak -- calosc oparta na analizie istniejacego kodu

### Tertiary (LOW confidence)
- Brak

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero nowych deps, calosc w istniejacym stacku
- Architecture: HIGH -- replikacja istniejacych wzorcow z email-analyzer
- DB migration: HIGH -- bezposrednia analiza istniejacego schematu
- Pitfalls: HIGH -- wynikaja z analizy kodu i wzorcow

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stabilny stack, brak planowanych zmian)
