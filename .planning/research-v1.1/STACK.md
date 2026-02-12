# Technology Stack — FB Analyzer (v1.1)

**Projekt:** Lulkiewicz PR Hub — Analizator Grup FB
**Data badania:** 2026-02-12
**Kontekst:** Kolejny milestone w istniejacym projekcie Next.js + Supabase

---

## Rekomendowany Stack (nowe elementy)

### Integracja z Apify

| Technologia | Wersja | Cel | Dlaczego |
|-------------|--------|-----|----------|
| Natywny `fetch()` (Apify REST API) | -- | Wywolywanie aktora, sprawdzanie statusu, pobieranie danych | Patrz "Dlaczego NIE apify-client" ponizej |

**Endpointy Apify REST API (3 operacje):**

```
1. Uruchomienie aktora:
   POST https://api.apify.com/v2/acts/{actorId}/runs
   Headers: Authorization: Bearer {APIFY_TOKEN}
   Body: { input parameters }

2. Sprawdzenie statusu runu:
   GET https://api.apify.com/v2/actor-runs/{runId}
   Headers: Authorization: Bearer {APIFY_TOKEN}

3. Pobranie wynikow z datasetu:
   GET https://api.apify.com/v2/datasets/{datasetId}/items
   Headers: Authorization: Bearer {APIFY_TOKEN}
   Query: ?format=json&limit=1000
```

**Pelny wzorzec integracji (apify-client.ts):**

```typescript
// src/lib/fb/apify-client.ts

const APIFY_BASE = 'https://api.apify.com/v2';

interface ApifyRunInput {
  groupUrls: string[];
  sortType: 'new_posts';
  scrapeUntil: string; // ISO date
  maxPosts?: number;
  proxy?: { useApifyProxy: boolean };
  sessionCookies?: ApifyCookie[];
}

interface ApifyCookie {
  name: string;   // 'datr' | 'fr' | 'xs' | 'c_user' | 'sb'
  value: string;
  domain: string; // '.facebook.com'
}

interface ApifyRunStatus {
  id: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTING' | 'ABORTED' | 'TIMED-OUT';
  defaultDatasetId: string;
  startedAt: string;
  finishedAt: string | null;
  stats: { inputBodyLen: number };
}

export async function startActorRun(
  apiToken: string,
  actorId: string,
  input: ApifyRunInput
): Promise<{ runId: string }> {
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}`);
  const data = await res.json();
  return { runId: data.data.id };
}

export async function getRunStatus(
  apiToken: string,
  runId: string
): Promise<ApifyRunStatus> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error(`Apify status failed: ${res.status}`);
  const data = await res.json();
  return data.data;
}

export async function getDatasetItems<T>(
  apiToken: string,
  datasetId: string,
  offset = 0,
  limit = 1000
): Promise<T[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?format=json&offset=${offset}&limit=${limit}`,
    { headers: { 'Authorization': `Bearer ${apiToken}` } }
  );
  if (!res.ok) throw new Error(`Apify dataset failed: ${res.status}`);
  return res.json();
}
```

**Pewnosc: MEDIUM** — Endpointy Apify REST API oparte na publicznie udokumentowanym API (docs.apify.com/api/v2). Struktura response (`data.data.id`) pochodzi z wiedzy treningowej; nalezy zweryfikowac z pierwszym wywolaniem.

### Dlaczego NIE apify-client (npm)

| Kryterium | apify-client (npm) | Natywny fetch() |
|-----------|-------------------|-----------------|
| Wersja | 2.22.0 (aktualizacja 2026-02-11) | -- |
| Rozmiar unpacked | ~2.8 MB | 0 KB (wbudowany) |
| Zaleznosci bezposrednie | **12** (axios, proxy-agent, crawlee, ow, itp.) | **0** |
| Potrzebne operacje | 3 z ~50+ dostepnych | 3 z 3 |
| Zgodnosc z istniejacym wzorcem | Nowy pattern (klasy, metody) | Identyczny wzorzec jak Graph API w sync/process |

**Rekomendacja: Natywny `fetch()`** — Projekt juz uzywa `fetch()` do Microsoft Graph API (patrz `src/app/api/sync/process/route.ts`). Dodanie apify-client wciagnelo by 12 zaleznosci (wlacznie z axios, ktory jest redundantny z natywnym fetch) dla zaledwie 3 wywolan API. Wlasny wrapper `apify-client.ts` bedzie ~60 linii kodu, w pelni typowany, i spajny z reszta codebase.

### Analiza sentymentu

| Technologia | Wersja | Cel | Dlaczego |
|-------------|--------|-----|----------|
| callAI() (istniejacy ai-provider.ts) | -- | Analiza sentymentu postow FB w jezyku polskim | Jedyna opcja zapewniajaca jakosc analizy tekstu polskiego |

**Dlaczego NIE biblioteki NLP:**

| Biblioteka | Problem |
|------------|---------|
| `sentiment` (npm, v5.0.2) | Oparty na AFINN-165 — slownik angielski. Brak wsparcia polskiego. Mozliwosc dodania wlasnego, ale wymaga recznego tworzenia slownika sentimentu PL (tysiac+ slow). Ostatnia aktualizacja: 2019. |
| `natural` (npm, v8.1.0) | NLP ogolny (tokenizacja, stemming, POS tagging). Brak stemmera polskiego. Sentiment tez oparty na AFINN (EN only). |
| Niestandardowe pakiety PL | Nie znaleziono dojrzalych pakietow npm do analizy sentymentu w jezyku polskim. |

**Rekomendacja: Czysty LLM (callAI)** — Posty sa po polsku, czesto z kolokwializmami, sarkazmem i kontekstem lokalnym (administracja osiedli). Zadna biblioteka AFINN/bag-of-words nie poradzi sobie z:
- "Super, znow nie dziala winda" (sarkazm = negatywny, ale slowa pozytywne)
- "Pan z ochrony bardzo pomocny" (kontekst: pozytywny o pracowniku)
- "Kiedy w koncu naprawia te drzwi???" (skarga ukryta w pytaniu)

LLM (GPT-5.2 / Claude) rozumie kontekst, ton, sarkazm i jezyk potoczny. Istniejacy `callAI()` jest juz przetestowany i dziala na produkcji.

### Przechowywanie sesji FB (cookies)

| Technologia | Wersja | Cel | Dlaczego |
|-------------|--------|-----|----------|
| encrypt.ts (istniejacy) | -- | Szyfrowanie cookies FB i tokenu Apify | AES-256-GCM, sprawdzony pattern |
| Supabase tabela `fb_groups` | -- | Pole `cookies_encrypted` per grupa | Kazda grupa moze wymagac innej sesji |

**Strategia przechowywania cookies FB:**

```
Cookies potrzebne (5 sztuk):
- datr     — identyfikator przegladarki
- fr       — cookie reklamowe
- xs       — token sesji (najwazniejszy)
- c_user   — user ID
- sb       — cookie bezpieczenstwa

Przechowywanie:
- Apify token: szyfrowany w tabeli konfiguracyjnej (jak ai_config.api_key_encrypted)
- FB cookies: szyfrowane w fb_groups.cookies_encrypted (JSON z 5 cookies)
- Rotacja: reczna przez admina w UI Settings — cookies FB wygasaja co ~3-6 miesiecy
```

**Pewnosc: HIGH** — Wzorzec identyczny z istniejacym `mailbox_credentials.credentials_encrypted`.

---

## Co NIE dodawac (i dlaczego)

| Nie dodawaj | Dlaczego |
|-------------|----------|
| `apify-client` (npm) | 12 zaleznosci, 2.8 MB dla 3 wywolan API. Fetch wystarczy. |
| `sentiment` (npm) | Tylko angielski. Brak polskiego. Nieaktualizowany od 2019. |
| `natural` (npm) | Brak wsparcia PL. Ogromna biblioteka (~8 MB) na cos, czego nie uzyje. |
| `puppeteer` / `playwright` | Scrapowanie to zadanie Apify Actora (w chmurze). PR Hub nie scrapuje samodzielnie. |
| `cheerio` / `jsdom` | Nie parsujemy HTML — Apify zwraca structured JSON. |
| `cron` / `node-schedule` | Rate limiting 3-6 min miedzy grupami realizowany przez polling hook (useScrapeJob), a nie cron. Przyszle automatyczne harmonogramy = Vercel Cron / Supabase Edge Functions (nie teraz). |
| `chart.js` / `recharts` | Na razie KPI w postaci cards/badges. Wykresy to enhancement na pozniej (Phase N+1). |
| Airtable SDK | Decyzja: storage tylko Supabase. |
| n8n webhook | Decyzja: integracja Apify bezposrednio z PR Hub. |

---

## Integracja z istniejacym stackiem

### Wzorce do ponownego uzycia (bez zmian)

| Istniejacy modul | Reuse w FB Analyzer | Zmiana |
|------------------|---------------------|--------|
| `src/lib/ai/ai-provider.ts` (callAI) | Analiza sentymentu + generowanie raportow | Bez zmian — nowe prompty w `fb-sentiment-prompts.ts` |
| `src/lib/crypto/encrypt.ts` | Szyfrowanie Apify token + FB cookies | Bez zmian |
| `src/hooks/useSyncJob.ts` (wzorzec) | Nowy `useScrapeJob.ts` (polling Apify) | Kopia + adaptacja (groupId zamiast mailboxId) |
| `src/hooks/useAnalysisJob.ts` (wzorzec) | Nowy `useFbAnalysisJob.ts` | Kopia + adaptacja (postId zamiast threadId) |
| `src/lib/export/` | Eksport raportow FB do DOCX | Reuse bez zmian |
| `verifyAdmin()` + `getAdminClient()` | Kazdy API route FB | Kopia wzorca (taki sam pattern) |

### Nowe pliki (zero nowych npm dependencies)

```
src/lib/fb/apify-client.ts      — 3 funkcje: startActorRun, getRunStatus, getDatasetItems
src/lib/fb/fb-sentiment-prompts.ts — prompty AI do analizy sentymentu PL
src/lib/fb/fb-report-generator.ts  — logika generowania raportow FB
src/types/fb.ts                    — typy domenowe FB
```

### Zmienne srodowiskowe (nowe)

```bash
# Wymagane:
APIFY_TOKEN=apify_api_xxxxx           # Token API Apify (lub szyfrowane w DB)

# Opcjonalne (domyslne w kodzie):
FB_APIFY_ACTOR_ID=curious_coder/facebook-post-scraper   # moze byc w kodzie jako const
FB_SCRAPE_DELAY_MS=240000             # opoznienie miedzy grupami (4 min default)
FB_MAX_POSTS_PER_SCRAPE=100           # limit postow per scrape
```

---

## Architektura przeplywu Apify (polling-based)

Wzorzec identyczny z email sync, ale z dodatkowym krokiem: Apify run jest asynchroniczny (trwa minuty, nie sekundy).

```
Uzytkownik klika "Scrapuj"
    |
    v
POST /api/fb/scrape
    |-- Tworzy fb_scrape_job (status: pending)
    |-- Wywoluje startActorRun() na Apify
    |-- Zapisuje apify_run_id w fb_scrape_jobs
    |-- Return { jobId, status: 'running' }
    |
    v
useScrapeJob.ts (polling co 5-10s)
    |
    v
POST /api/fb/scrape/process
    |-- Sprawdza getRunStatus() na Apify
    |-- Jesli RUNNING → return { status: 'running', hasMore: true }
    |-- Jesli SUCCEEDED → getDatasetItems() → upsert do fb_posts
    |-- Jesli FAILED → return { status: 'failed', error }
    |-- Return { status: 'completed', postsFound, postsNew }
```

**Roznica vs email sync:**
- Email sync: kazdy batch = 1 strona Graph API (100 maili), wiele batchow
- FB scrape: 1 run Apify = caly scrape jednej grupy, polling statusu az SUCCEEDED, potem 1 pobranie datasetu

**Implikacja dla polling:**
- `useScrapeJob` musi pollowac status (nie procesowac batche)
- Opoznienie miedzy pollingami: 5-10s (Apify run trwa 1-5 min)
- Po SUCCEEDED: jednorazowe pobranie datasetu + upsert

---

## Apify Actor: curious_coder/facebook-post-scraper

**Actor ID:** `curious_coder/facebook-post-scraper` (Apify store)

### Parametry wejsciowe (z N8N workflow)

```json
{
  "groupUrls": ["https://www.facebook.com/groups/123456"],
  "sortType": "new_posts",
  "scrapeUntil": "2026-02-01",
  "maxPosts": 100,
  "proxy": {
    "useApifyProxy": true
  },
  "sessionCookies": [
    { "name": "datr", "value": "xxx", "domain": ".facebook.com" },
    { "name": "fr", "value": "xxx", "domain": ".facebook.com" },
    { "name": "xs", "value": "xxx", "domain": ".facebook.com" },
    { "name": "c_user", "value": "xxx", "domain": ".facebook.com" },
    { "name": "sb", "value": "xxx", "domain": ".facebook.com" }
  ]
}
```

**Pewnosc: MEDIUM** — Struktura parametrow oparta na istniejacym N8N workflow opisanym w kontekscie projektu. Dokladna struktura `sessionCookies` moze sie roznic (niektorzy aktorzy uzywaja `cookies` zamiast `sessionCookies`). Nalezy zweryfikowac ze strona aktora na Apify.

### Schemat wyjsciowy (oczekiwany)

```typescript
interface ApifyFbPost {
  postId: string;           // Facebook post ID
  postUrl: string;          // URL do posta
  authorName: string;       // Imie autora
  authorId?: string;        // FB user ID
  text: string;             // Tresc posta
  timestamp: string;        // Data publikacji
  likes: number;
  comments: number;
  shares: number;
  images?: string[];        // URL-e obrazkow
  commentsList?: Array<{
    authorName: string;
    text: string;
    timestamp: string;
    likes: number;
  }>;
}
```

**Pewnosc: LOW** — Schemat wyjsciowy oparty na wiedzy treningowej o typowych aktorach FB scraperach. Dokladne nazwy pol moga sie roznic. KRYTYCZNE: trzeba zweryfikowac schema pierwszym runem testowym lub dokumentacja aktora.

### Kosztorys Apify

**Pewnosc: LOW** — ponizsze szacunki sa orientacyjne.

| Parametr | Szacunek |
|----------|----------|
| Koszt per run | ~$0.01-0.05 (zalezy od ilosci postow i czasu scrapowania) |
| Czas per grupa | 1-5 minut |
| Rate limiting | 3-6 min opoznienia miedzy grupami (z N8N workflow) |
| Darmowy tier Apify | $5/mies kredytow (wystarczy na ~100-500 runow) |

---

## Alternatywni aktorzy Apify (do rozpatrzenia)

**Pewnosc: LOW** — Nie mialem mozliwosci przeszukania Apify Store (WebSearch niedostepny). Ponizej na podstawie wiedzy treningowej.

| Aktor | Notatka |
|-------|---------|
| `apify/facebook-posts-scraper` (oficjalny) | Moze nie istniec — Apify nie ma oficjalnego FB scrapera (FB blokuje). Weryfikacja wymagana. |
| `curious_coder/facebook-post-scraper` | Wybrany w planie. Walidacja: uzywany w istniejacym N8N workflow — dziala. |
| `danek/facebook-group-scraper` | Potencjalna alternatywa. Nie zweryfikowano. |

**Rekomendacja:** Zostac przy `curious_coder/facebook-post-scraper` — juz zwalidowany w N8N workflow. Przesiadka na innego aktora to ryzyko bez jasnej korzysci.

---

## Instalacja

```bash
# ZERO nowych npm packages!
# Wszystko opiera sie na istniejacych zalenosciach:
# - fetch() (natywny Node.js 22)
# - crypto (natywny Node.js)
# - docx + file-saver (juz zainstalowane)
# - callAI() z ai-provider.ts (juz zaimplementowane)
```

**To jest KLUCZOWA zaleta tego podejscia.** Zero nowych npm dependencies = zero nowych ryzyk:
- Brak problemow z kompatybilnoscia
- Brak nowych bundli do deploymentu
- Brak nowych surface area dla vulnerabilities
- Szybszy `npm install` / `npm ci` na CI

---

## Podsumowanie decyzji

| Kategoria | Decyzja | Pewnosc |
|-----------|---------|---------|
| Apify integration | Natywny `fetch()` (NIE apify-client npm) | HIGH |
| Sentiment analysis | callAI() z LLM (NIE biblioteki NLP) | HIGH |
| FB cookies storage | encrypt.ts + pole w fb_groups | HIGH |
| Apify token storage | encrypt.ts + tabela konfiguracyjna | HIGH |
| Nowe npm packages | **ZERO** | HIGH |
| Scraping pattern | Polling-based (useScrapeJob) | HIGH |
| Apify Actor | curious_coder/facebook-post-scraper | MEDIUM |
| Actor input schema | Z N8N workflow — weryfikacja wymagana | MEDIUM |
| Actor output schema | Szacunkowy — weryfikacja wymagana | LOW |
| Apify pricing | Szacunkowy | LOW |

---

## Otwarte pytania (do zbadania w fazie implementacji)

1. **Dokladny schemat wyjsciowy aktora** — odpalic raz testowo z 1 grupa i zbadac response
2. **Nazwa pola cookies** — `sessionCookies` vs `cookies` vs `loginCookies` w inputach aktora
3. **Limit datasetu** — czy Apify paginuje dataset items (offset/limit) czy zwraca wszystko
4. **Wygasanie cookies FB** — jak czesto trzeba je odswiezac (doswiadczenie z N8N workflow)
5. **Apify Proxy** — czy darmowy tier Apify Proxy wystarcza dla FB, czy potrzebny residential proxy

---

## Zrodla

| Zrodlo | Co zweryfikowano | Pewnosc |
|--------|------------------|---------|
| npm registry (`npm view apify-client`) | Wersja 2.22.0, 12 deps, 2.8 MB, aktualizacja 2026-02-11 | HIGH |
| npm registry (`npm view sentiment`) | Wersja 5.0.2, AFINN-165, tylko EN, ostatnia aktualizacja 2019 | HIGH |
| npm registry (`npm view natural`) | Wersja 8.1.0, brak stemmera PL | HIGH |
| Istniejacy codebase (package.json) | Node.js 22.14.0, Next.js 16.1.6, zero nadmiarowych deps | HIGH |
| Istniejacy codebase (api/sync/) | Wzorzec fetch() + polling + batch processing | HIGH |
| Istniejacy codebase (ai-provider.ts) | callAI() z max_completion_tokens, testowany na GPT-5.2 | HIGH |
| Istniejacy codebase (encrypt.ts) | AES-256-GCM, wzorzec szyfrowania credentiali | HIGH |
| Plan milestone (lexical-marinating-blossom.md) | Architektura, tabele, pliki, fazy | HIGH |
| Kontekst projektu (MEMORY.md) | N8N workflow — parametry aktora, cookies, rate limiting | MEDIUM |
| Wiedza treningowa | Apify REST API endpointy, schemat wyjsciowy aktora | LOW-MEDIUM |
