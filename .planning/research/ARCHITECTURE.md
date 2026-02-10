# Architecture Patterns

**Domain:** Email Communication Analysis Hub (internal tool)
**Project:** Lulkiewicz PR Hub
**Researched:** 2026-02-10

## Recommended Architecture

System sklada sie z 6 warstw przetwarzania danych, ktore dzialaja sekwencyjnie -- kazda warstwa konsumuje dane wyprodukowane przez poprzednia. Hub shell opakowuje calosc, dostarczajac auth, nawigacje i konfiguracje.

```
+------------------------------------------------------------------+
|                         HUB SHELL                                |
|  Auth (Supabase) | Sidebar | Tool Registry | Theme System       |
+------------------------------------------------------------------+
        |
+------------------------------------------------------------------+
|  LAYER 1: EMAIL INGESTION                                        |
|  Microsoft Graph API / IMAP --> Batch Fetcher --> Supabase DB    |
|  (paginated, queue-driven, progress via SSE)                     |
+------------------------------------------------------------------+
        |
+------------------------------------------------------------------+
|  LAYER 2: EMAIL PROCESSING                                       |
|  Parser --> Threading (JWZ) --> Metadata Enrichment              |
|  (runs after ingestion, populates threads + metadata tables)     |
+------------------------------------------------------------------+
        |
+------------------------------------------------------------------+
|  LAYER 3: AI ANALYSIS                                            |
|  Prompt Manager --> Chunked Analysis --> Result Cache             |
|  (section-based, editable prompts, batched OpenAI calls)         |
+------------------------------------------------------------------+
        |
+------------------------------------------------------------------+
|  LAYER 4: REPORT GENERATION                                      |
|  Template Engine --> Section Renderer --> Report Assembly         |
|  (2 templates: internal + client, prompt-per-section)            |
+------------------------------------------------------------------+
        |
+------------------------------------------------------------------+
|  LAYER 5: EXPORT                                                 |
|  Clipboard | .docx (docx lib) | .pdf (react-pdf / puppeteer)    |
+------------------------------------------------------------------+
```

---

## Component Boundaries

### C1: Hub Shell

| Aspekt | Szczegoly |
|--------|-----------|
| **Odpowiedzialnosc** | Auth, routing, sidebar, tool registry (grid 6 narzedzi), theme system, ustawienia |
| **Komunikuje sie z** | Wszystkimi komponentami (opakowuje je) |
| **Technologia** | Next.js App Router, Supabase Auth, Unified Design System (6 motywow) |
| **Dane** | `profiles`, `organizations`, `organization_members` |

Wzorzec Poltel: grid kart narzedzi, jedno aktywne (Email Analyzer), 5 "Coming Soon". Kazde narzedzie to odrebna sekcja w App Router (`(hub)/email-analyzer/...`).

Kluczowe elementy:
- **AuthProvider** z rola usera (admin/user)
- **ToolRegistry** -- konfiguracja dostepu do narzedzi per rola
- **Layout** z sidebar/header ujednoliconym dla calego huba
- **Settings** -- ogolne, AI config, profil organizacji

### C2: Email Ingestion Layer

| Aspekt | Szczegoly |
|--------|-----------|
| **Odpowiedzialnosc** | Polaczenie ze skrzynkami Outlook, pobranie maili, zapis do DB |
| **Komunikuje sie z** | Microsoft Graph API (zewn.), Supabase DB (zapis), Hub Shell (config) |
| **Technologia** | Microsoft Graph API SDK (`@microsoft/microsoft-graph-client`), ewentualnie IMAP (`imapflow`) |
| **Dane** | `mailboxes`, `sync_jobs`, `raw_emails` |

**Krytyczny problem: Vercel 60s timeout**

Pobranie tysiecy maili to operacja trwajaca minuty, nie sekundy. Na Vercel Pro limit to 300s, ale nawet to moze nie wystarczyc dla 5000+ maili.

**Rekomendowana architektura: Paginowany Job Queue**

```
UI: "Synchronizuj" button
  |
  v
API Route: POST /api/email/sync
  |-- Tworzy rekord w `sync_jobs` (status: 'pending')
  |-- Zwraca job_id natychmiast (< 1s)
  |
  v
API Route: POST /api/email/sync/process
  |-- Pobiera pending job
  |-- Ustawia status: 'processing'
  |-- Pobiera 1 strone maili (50-100 per page) z Graph API
  |-- Zapisuje do `raw_emails`
  |-- Aktualizuje `sync_jobs.progress` (np. "150/3000")
  |-- Jesli jest @odata.nextLink --> tworzy NOWY job dla nastepnej strony
  |-- Ustawia status: 'completed' (lub 'has_more')
  |
  v
Frontend: Polling / SSE na sync_jobs
  |-- Wyswietla progress bar
  |-- Po zakonczeniu: "Pobrano 3000 maili"
```

**Dlaczego TEN wzorzec:**

1. **Self-chaining jobs** -- kazdy API call pobiera 1 strone (50-100 maili, ~5-10s) i tworzy nastepny job. Miesci sie w limicie 60s nawet na darmowym planie.
2. **Frontend-driven polling** -- klient co 2-3s wywoluje GET /api/email/sync/status/{jobId}. Prostsze niz SSE, nie wymaga utrzymywania polaczenia.
3. **Odpornosc na bledy** -- jesli jeden batch upadnie, job ma status 'failed' z informacja o ostatniej stronie. Retry mozliwy od tego miejsca.
4. **Alternatywa: Frontend-driven chaining** -- zamiast backend tworzy nastepny job, frontend po otrzymaniu "strona 3 pobrana" sam wywoluje "pobierz strone 4". Prostsze, ale uzytkownik musi miec otwarty tab.

**Confidence: HIGH** -- wzorzec potwierdzony przez [Supabase blog o processing large jobs](https://supabase.com/blog/processing-large-jobs-with-edge-functions) i [Vercel KB o timeoutach](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out).

### C3: Email Processing Pipeline

| Aspekt | Szczegoly |
|--------|-----------|
| **Odpowiedzialnosc** | Parsowanie naglowkow, threading (grupowanie w watki), ekstrakcja metadanych |
| **Komunikuje sie z** | Supabase DB (read raw_emails, write threads + processed_emails) |
| **Technologia** | Custom TypeScript, JWZ threading algorithm |
| **Dane** | `email_threads`, `processed_emails` (z extracted metadata) |

**Algorytm threadingu (JWZ -- uproszczony):**

Pelny algorytm JWZ ([jwz.org/doc/threading.html](https://www.jwz.org/doc/threading.html)) jest zlozony. Dla naszego przypadku uzycia (Outlook, 3 skrzynki, analiza historyczna) wystarczy uproszczony wariant:

```
Krok 1: Indeksowanie
  - Dla kazdego maila: wyodrebnij Message-ID, In-Reply-To, References
  - Stworz mape: Message-ID --> Email

Krok 2: Budowanie grafu odpowiedzi
  - Dla kazdego maila z In-Reply-To lub References:
    - Polacz z parentem (In-Reply-To ma priorytet)
    - Jesli parent nie istnieje w zbiorze, stworz placeholder

Krok 3: Fallback na Subject
  - Maile bez In-Reply-To/References: grupuj po znormalizowanym Subject
    (usun "Re:", "Fwd:", "Odp:", "PD:" itd., trim, lowercase)
  - Lacz z istniejacym watkiem jesli Subject pasuje I daty sa blisko (< 30 dni)

Krok 4: Budowanie drzew
  - Znajdz maile-korzenie (bez parenta)
  - Kazdy korzen = jeden thread
  - Sortuj maile w threadzie chronologicznie
```

**Dlaczego uproszczony JWZ zamiast pelnego:**
- Pelny JWZ obsluguje edge-case'y Usenetowe (broken references, duplicate IDs) -- nie nasz scenariusz
- Outlook dobrze ustawia In-Reply-To i References
- Subject-based fallback pokrywa przypadki gdy naglowki sa niekompletne
- Implementacja w TypeScript: ~200-300 linii vs ~800+ dla pelnego JWZ

**Ekstrakcja metadanych (per email):**
```typescript
interface ProcessedEmail {
  id: string;
  thread_id: string;
  message_id: string;       // RFC 822 Message-ID
  in_reply_to: string | null;
  references: string[];
  from_address: string;
  from_name: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  subject_normalized: string; // bez Re:/Fwd:/Odp:
  sent_at: Date;
  received_at: Date;
  body_text: string;         // stripped HTML
  body_html: string;         // oryginalne HTML
  has_attachments: boolean;
  attachment_names: string[];
  mailbox_id: string;        // z ktorej skrzynki
  is_incoming: boolean;      // czy od zewnetrznego nadawcy
  response_time_minutes: number | null; // czas od poprzedniego maila w watku
}
```

**Kiedy uruchamiac processing:**
- Automatycznie po zakonczeniu kazdego batch synca (trigger w sync_jobs)
- Processing tez jest podzielony na batche (po 100-200 maili) -- te same limity Vercel
- Musi byc idempotentny -- ponowne przetworzenie tego samego maila nie tworzy duplikatow

### C4: AI Analysis Layer

| Aspekt | Szczegoly |
|--------|-----------|
| **Odpowiedzialnosc** | Analiza AI: jakos komunikacji, kultura, czas reakcji, RODO, sugestie |
| **Komunikuje sie z** | OpenAI API, Supabase DB (read threads/emails, write analysis_results), Prompt Manager |
| **Technologia** | OpenAI GPT-4o (domyslnie), AI SDK lub direct API, custom prompt manager |
| **Dane** | `analysis_jobs`, `analysis_results`, `prompt_templates` |

**Kluczowy problem: Jak analizowac tysiace maili z limitem kontekstu?**

GPT-4o ma 128K tokenow kontekstu. Typowy email to 200-500 tokenow. Jeden watek (5-20 maili) to 1K-10K tokenow. Mozemy bezpiecznie wrzucic 10-50 watkow na jedno wywolanie, ale nie wszystkie na raz.

**Rekomendowana strategia: Hierarchiczna analiza (Map-Reduce)**

```
FAZA 1: Analiza per-watek (MAP)
  Dla kazdego watku (lub batchu 5-10 watkow):
  - Wrzuc caly watek do GPT-4o
  - Prompt: "Przeanalizuj ten watek pod katem [sekcja raportu]"
  - Wynik: strukturyzowana ocena (JSON) per watek
  - Zapisz do analysis_results

FAZA 2: Agregacja (REDUCE)
  Po przeanalizowaniu wszystkich watkow:
  - Zbierz wyniki z Fazy 1
  - Prompt: "Na podstawie tych N analiz, stworz podsumowanie [sekcja raportu]"
  - Wynik: sekcja raportu (tekst)

FAZA 3: Synteza (raportu)
  Po agregacji wszystkich sekcji:
  - Opcjonalnie: prompt finalny laczacy sekcje w spojny raport
  - Lub: mechanicznie zloz sekcje bez dodatkowego AI
```

**Dlaczego Map-Reduce:**
1. **Miesci sie w kontekscie** -- watek (nawet dlugi) to max 10K tokenow
2. **Rownoleglosc** -- watki mozna analizowac rownolegle (5-10 na raz, rate limit)
3. **Cache'owalnosc** -- zmiana promptu dla jednej sekcji wymaga tylko ponownej Fazy 2+3 dla tej sekcji, nie calej Fazy 1
4. **Transparentnosc** -- uzytkownik widzi "przeanalizowano 45/120 watkow"

**Prompt Manager -- architektura 3-tier (wzorzec z Marketing Hub):**

```
Poziom 1: Domyslny z kodu (hardcoded, wersjonowany w repo)
Poziom 2: Globalny (DB, edytowalny przez super admina)
Poziom 3: Per-raport (DB, edytowalny przez usera tworzacego raport)

Efektywny prompt = Poziom 3 ?? Poziom 2 ?? Poziom 1
```

Kazda sekcja raportu ma swoj prompt. Przykladowe sekcje:
1. Podsumowanie ogolne
2. Jakosc komunikacji (kultura, uprzejamosc)
3. Czas reakcji (SLA)
4. Status spraw (otwarte/zamkniete)
5. Dane kontaktowe i osoby odpowiedzialne
6. Zgodnosc z RODO
7. Rekomendacje naprawcze

**Tabela `prompt_templates`:**
```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL,        -- np. 'quality', 'response_time', 'gdpr'
  scope TEXT NOT NULL,              -- 'default' | 'global' | 'report'
  scope_id UUID,                    -- NULL dla default/global, report_id dla report
  template_name TEXT NOT NULL,      -- np. 'Jakosc komunikacji'
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL, -- z placeholderami {threads}, {emails_count} itd.
  model TEXT DEFAULT 'gpt-4o',
  temperature FLOAT DEFAULT 0.3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**AI Job Queue (ten sam wzorzec co email sync):**

```
UI: "Generuj raport" button
  |
  v
API Route: POST /api/analysis/start
  |-- Tworzy analysis_job (status: 'pending')
  |-- Zwraca job_id
  |
  v
API Route: POST /api/analysis/process-batch
  |-- Pobiera nastepny batch watkow do analizy (np. 10)
  |-- Wywoluje OpenAI API per watek per sekcja
  |-- Zapisuje wyniki do analysis_results
  |-- Aktualizuje progress
  |-- Jesli sa jeszcze watki --> tworzy nastepny batch job
  |
  v
Po zakonczeniu wszystkich batch'y:
  |-- API Route: POST /api/analysis/aggregate
  |-- Zbiera wyniki, uruchamia Faze 2 (agregacja per sekcja)
  |-- Zapisuje zagregowane wyniki
  |-- Status: 'completed'
```

**Confidence: HIGH** -- Map-Reduce to standardowy wzorzec dla analizy LLM duzych zbiorow danych, potwierdzony przez [OpenAI Cookbook - Summarizing Long Documents](https://cookbook.openai.com/examples/summarizing_long_documents).

### C5: Report Generation Layer

| Aspekt | Szczegoly |
|--------|-----------|
| **Odpowiedzialnosc** | Skladanie sekcji raportu, dwa szablony, rendering |
| **Komunikuje sie z** | AI Analysis (read results), Prompt Manager, Export Layer |
| **Technologia** | React components (preview), template engine (data binding) |
| **Dane** | `reports`, `report_sections` |

**Dwa szablony raportow:**

```
INTERNAL (pelny):
  - Wszystkie 7 sekcji
  - Surowe dane (cytaty z maili, nazwy pracownikow)
  - Oceny liczbowe per watek
  - Pelen log analizy

CLIENT (filtrowany):
  - Sekcje 1, 2, 3, 7 (podsumowanie, jakosc, czas reakcji, rekomendacje)
  - Bez cytatow z maili (ochrona danych)
  - Zagregowane oceny (nie per-watek)
  - Profesjonalny jezyk (prompt zawieral instrukcje filtrowania)
```

**Struktura danych raportu:**

```typescript
interface Report {
  id: string;
  mailbox_id: string;
  template_type: 'internal' | 'client';
  date_range_start: Date;
  date_range_end: Date;
  status: 'draft' | 'generating' | 'completed' | 'error';
  created_by: string;
  created_at: Date;
  sections: ReportSection[];
}

interface ReportSection {
  id: string;
  report_id: string;
  section_key: string;
  order: number;
  title: string;
  content_markdown: string;  // wynik AI, edytowalny
  content_html: string;      // renderowany
  prompt_used: string;       // snapshot promptu uzywanego przy generowaniu
  is_included: boolean;      // czy widoczna w tym szablonie
  is_edited: boolean;        // czy user edytowal po generowaniu
}
```

**Kluczowa decyzja: Markdown jako format posredni**

Sekcje raportu sa generowane przez AI jako Markdown. To umozliwia:
- Podglad w przegladarce (renderowany React component)
- Edycje przez usera (textarea/rich editor)
- Konwersje do .docx i .pdf z jednego zrodla
- Wersjonowanie (diff miedzy wersjami)

### C6: Export Layer

| Aspekt | Szczegoly |
|--------|-----------|
| **Odpowiedzialnosc** | Eksport raportu do .docx, .pdf, schowka |
| **Komunikuje sie z** | Report Generation (read sections), Hub Shell (UI) |
| **Technologia** | `docx` (npm) dla DOCX, Puppeteer lub `@react-pdf/renderer` dla PDF |
| **Dane** | Brak wlasnych tabel -- operuje na `reports` + `report_sections` |

**Rekomendacja technologiczna:**

| Format | Biblioteka | Dlaczego |
|--------|-----------|----------|
| .docx | `docx` (npm, v9.x) | Deklaratywne API w TypeScript, budowanie dokumentu programowo, 379 projektow w npm, aktywnie utrzymywana. Lepsza od docxtemplater dla naszego przypadku -- nie potrzebujemy templatek .docx, budujemy od zera z danych. |
| .pdf | `@react-pdf/renderer` | Lzejsze niz Puppeteer, nie wymaga headless Chrome. Dla prostych raportow tabelarycznych wystarczajace. Jesli potrzebna wieksza wiernosc z HTML -- fallback na Puppeteer. |
| Clipboard | Native `navigator.clipboard.writeText()` + HTML via `ClipboardItem` | Kopiowanie Markdown lub sformatowanego HTML do schowka. |

**Uwaga o Puppeteer na Vercel:**
Puppeteer wymaga headless Chrome, ktory jest duzy (~130MB). Na Vercel Serverless Functions jest to problematyczne (limit 50MB na bundle). Alternatywy:
- `@sparticuz/chromium` -- zoptymalizowana wersja Chromium dla Lambdy/Vercel (~50MB)
- Zewnetrzny serwis (np. Browserless) -- API do generowania PDF
- `@react-pdf/renderer` -- nie wymaga przegladarki, ale ograniczony w CSS

**Rekomendacja: Zacznij od `@react-pdf/renderer`, przejdz na Puppeteer jesli potrzebna wieksza wiernosc.**

**Confidence: MEDIUM** -- `docx` i `@react-pdf/renderer` to sprawdzone biblioteki, ale integracja z Vercel wymaga testowania (rozmiar bundle).

---

## Data Flow

### Flow 1: Sync maili (jednorazowy + manual refresh)

```
User klika "Synchronizuj" w UI
  |
  v
POST /api/email/sync
  |-- Walidacja: czy mailbox skonfigurowany?
  |-- Tworzy sync_job { mailbox_id, status: 'pending', page_token: null }
  |-- Return { job_id }
  |
  v
POST /api/email/sync/process (wywolywany przez frontend polling)
  |-- Czyta sync_job
  |-- GET Graph API: /users/{mailbox}/messages?$top=100&$select=...
  |     (uzywa page_token jesli kontynuacja)
  |-- Przetwarza odpowiedz:
  |     - Mapuje kazdy message do raw_emails (upsert by internet_message_id)
  |     - Zapisuje @odata.nextLink jako page_token w sync_job
  |-- Aktualizuje sync_job:
  |     - progress: "300/~3000" (estimated total z Graph API)
  |     - status: 'has_more' jesli nextLink istnieje, 'completed' jesli nie
  |-- Return { status, progress }
  |
  v
Frontend polling (co 2-3s):
  GET /api/email/sync/status/{jobId}
  |-- Jesli 'has_more' --> wywolaj POST /process ponownie
  |-- Jesli 'completed' --> pokaz "Sync zakonczony", uruchom processing
  |-- Jesli 'failed' --> pokaz blad, opcja retry
```

### Flow 2: Processing maili (po sync)

```
Sync completed trigger
  |
  v
POST /api/email/process
  |-- Pobiera raw_emails bez thread_id (jeszcze nieprzetworzone)
  |-- Batch po 500:
  |     1. Parsuj naglowki (Message-ID, In-Reply-To, References)
  |     2. Buduj graf odpowiedzi (indeks Message-ID --> email)
  |     3. Lacz w watki (In-Reply-To > References > Subject fallback)
  |     4. Tworzysz/aktualizuj email_threads
  |     5. Aktualizuj processed_emails z thread_id + metadata
  |-- Return { threads_created, threads_updated, emails_processed }
```

### Flow 3: Generowanie raportu

```
User wybiera: skrzynke, zakres dat, szablon (internal/client)
  |
  v
POST /api/reports/generate
  |-- Tworzy report { mailbox_id, date_range, template_type, status: 'generating' }
  |-- Pobiera watki z zakresu dat
  |-- Tworzy analysis_job { report_id, total_threads, status: 'pending' }
  |-- Return { report_id, job_id }
  |
  v
POST /api/analysis/process-batch (polling-driven)
  |-- Pobiera nastepny batch watkow (10)
  |-- Dla kazdego watku, dla kazdej sekcji raportu:
  |     - Pobierz efektywny prompt (3-tier: default > global > report)
  |     - Wywolaj OpenAI API
  |     - Zapisz wynik do analysis_results
  |-- Aktualizuj progress
  |-- Return { processed, remaining }
  |
  v  (po przetworzeniu wszystkich watkow)
POST /api/analysis/aggregate
  |-- Dla kazdej sekcji:
  |     - Zbierz analysis_results per-watek
  |     - Wywolaj OpenAI z promptem agregujacym
  |     - Zapisz do report_sections (Markdown)
  |-- Aktualizuj report.status = 'completed'
  |-- Return { report_id }
  |
  v
Frontend: podglad raportu
  |-- Renderuj sekcje jako Markdown/HTML
  |-- User moze edytowac sekcje
  |-- User moze eksportowac (.docx, .pdf, clipboard)
```

---

## Schemat bazy danych (kluczowe tabele)

```sql
-- Skrzynki pocztowe
CREATE TABLE mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- np. "Administracja Osiedle X"
  email_address TEXT NOT NULL,
  connection_type TEXT NOT NULL,   -- 'graph_api' | 'imap'
  credentials_encrypted TEXT,      -- AES-256-GCM encrypted JSON
  last_sync_at TIMESTAMPTZ,
  total_emails INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Joby synchronizacji
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | has_more | completed | failed
  page_token TEXT,                -- @odata.nextLink lub IMAP UID
  emails_fetched INTEGER DEFAULT 0,
  emails_total_estimate INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surowe maile
CREATE TABLE raw_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id),
  internet_message_id TEXT NOT NULL, -- RFC 822 Message-ID (unique per mailbox)
  message_id_graph TEXT,            -- Graph API id (moze sie zmieniac!)
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses JSONB,               -- [{address, name}]
  cc_addresses JSONB,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_names JSONB,
  -- Naglowki do threadingu
  header_message_id TEXT,           -- Message-ID header
  header_in_reply_to TEXT,          -- In-Reply-To header
  header_references TEXT[],         -- References header (tablica)
  -- Processing
  is_processed BOOLEAN DEFAULT FALSE,
  thread_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mailbox_id, internet_message_id)
);

-- Watki emailowe
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id),
  subject_normalized TEXT NOT NULL,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  participant_addresses JSONB,     -- unikalne adresy w watku
  status TEXT DEFAULT 'unknown',   -- unknown | open | closed (AI moze ocenic)
  avg_response_time_minutes FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wyniki analizy AI (per watek per sekcja)
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL,
  thread_id UUID REFERENCES email_threads(id),
  section_key TEXT NOT NULL,       -- np. 'quality', 'response_time'
  result_json JSONB NOT NULL,      -- strukturyzowany wynik AI
  tokens_used INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(analysis_job_id, thread_id, section_key)
);

-- Joby analizy
CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  mailbox_id UUID NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_threads INTEGER,
  processed_threads INTEGER DEFAULT 0,
  current_phase TEXT,              -- 'mapping' | 'aggregating' | 'completed'
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raporty
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id),
  template_type TEXT NOT NULL,     -- 'internal' | 'client'
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sekcje raportu
CREATE TABLE report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  section_key TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_markdown TEXT,
  prompt_snapshot TEXT,            -- prompt uzyty do wygenerowania
  is_included BOOLEAN DEFAULT TRUE,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Szablony promptow (3-tier)
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'default', -- 'default' | 'global' | 'report'
  scope_id UUID,                  -- NULL dla default/global, report_id dla report
  template_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o',
  temperature FLOAT DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 4096,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Patterns to Follow

### Pattern 1: Polling-driven Job Queue

**Co:** Zamiast jednego dlugiego API call, podziel prace na male batche. Frontend drivuje postep przez polling.

**Kiedy:** Kazda operacja > 10s (sync maili, analiza AI, generowanie raportu).

**Przyklad:**

```typescript
// API Route: POST /api/email/sync/process
export async function POST(request: Request) {
  const { jobId } = await request.json();

  const job = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (job.status === 'completed') {
    return Response.json({ status: 'completed' });
  }

  // Pobierz 1 strone maili
  const graphResponse = await graphClient
    .api(job.page_token || `/users/${mailbox.email}/messages`)
    .top(100)
    .select('id,subject,from,toRecipients,sentDateTime,body,internetMessageHeaders')
    .get();

  // Zapisz maile
  await supabase.from('raw_emails').upsert(
    graphResponse.value.map(mapGraphEmailToRow)
  );

  // Aktualizuj job
  const hasMore = !!graphResponse['@odata.nextLink'];
  await supabase.from('sync_jobs').update({
    status: hasMore ? 'has_more' : 'completed',
    page_token: graphResponse['@odata.nextLink'] || null,
    emails_fetched: job.emails_fetched + graphResponse.value.length,
  }).eq('id', jobId);

  return Response.json({
    status: hasMore ? 'has_more' : 'completed',
    fetched: graphResponse.value.length,
    total: job.emails_fetched + graphResponse.value.length,
  });
}
```

```typescript
// Frontend hook
function useSyncJob(jobId: string) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [progress, setProgress] = useState({ fetched: 0, total: 0 });

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      // Wywolaj process (pobiera nastepna strone)
      const res = await fetch('/api/email/sync/process', {
        method: 'POST',
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();

      setProgress({ fetched: data.total, total: data.estimatedTotal });
      setStatus(data.status);

      if (data.status === 'has_more') {
        // Kontynuuj po krotkim opoznieniu
        setTimeout(poll, 500);
      }
    };

    poll();
  }, [jobId]);

  return { status, progress };
}
```

### Pattern 2: 3-Tier Prompt Resolution

**Co:** Prompty maja 3 poziomy: default z kodu, global edytowalny, per-raport edytowalny. Najnizszy poziom wygrywa.

**Kiedy:** Kazda sekcja raportu.

**Przyklad:**

```typescript
async function getEffectivePrompt(
  sectionKey: string,
  reportId?: string
): Promise<PromptTemplate> {
  // Poziom 3: per-raport
  if (reportId) {
    const reportPrompt = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('section_key', sectionKey)
      .eq('scope', 'report')
      .eq('scope_id', reportId)
      .maybeSingle();
    if (reportPrompt.data) return reportPrompt.data;
  }

  // Poziom 2: global
  const globalPrompt = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('section_key', sectionKey)
    .eq('scope', 'global')
    .maybeSingle();
  if (globalPrompt.data) return globalPrompt.data;

  // Poziom 1: default z kodu
  return DEFAULT_PROMPTS[sectionKey];
}
```

### Pattern 3: Idempotent Upsert

**Co:** Wszystkie operacje zapisu uzywaja upsert z naturalnym kluczem. Ponowne uruchomienie nie tworzy duplikatow.

**Kiedy:** Sync maili, processing, analiza.

**Przyklad:**

```typescript
// Upsert maili -- internet_message_id jest naturalnym kluczem
await supabase.from('raw_emails').upsert(
  emails.map(e => ({
    mailbox_id: mailboxId,
    internet_message_id: e.internetMessageId,
    // ... reszta pol
  })),
  { onConflict: 'mailbox_id,internet_message_id' }
);
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Single Long-Running API Call

**Co:** Jeden endpoint ktory pobiera wszystkie maile, przetwarza i zwraca raport.

**Dlaczego zle:** Vercel timeout (60s Pro, 300s Enterprise). Brak visibility do progresu. Brak mozliwosci retry czesciwego. User nie wie co sie dzieje.

**Zamiast tego:** Polling-driven job queue (Pattern 1 powyzej).

### Anti-Pattern 2: Storing All Emails in Memory

**Co:** Zaladowanie calej skrzynki (5000+ maili) do pamieci w jednym API route.

**Dlaczego zle:** Vercel Functions maja limit pamieci (1024MB domyslnie). 5000 maili z body HTML to latwo 500MB+.

**Zamiast tego:** Przetwarzaj batchami (50-100 maili), zapisuj natychmiast do DB, nie trzymaj w pamieci.

### Anti-Pattern 3: Analyzing All Threads in One AI Call

**Co:** Wrzucenie wszystkich 3000 maili do jednego promptu GPT-4o.

**Dlaczego zle:** 128K tokenow to ~96K slow. 3000 maili to ~150K-300K slow. Nie zmiesci sie. Nawet z GPT-4.1 (1M tokenow) -- jakosc drastycznie spada przy dlugim kontekscie.

**Zamiast tego:** Map-Reduce (Pattern w C4 powyzej). Analizuj per-watek, potem agreguj.

### Anti-Pattern 4: Graph API ID as Primary Key

**Co:** Uzywanie `id` z Microsoft Graph API jako klucza glownego maila.

**Dlaczego zle:** Microsoft Graph API wyraznie ostrzega: "Don't assume message/folder IDs remain constant." ID moze sie zmienic po migracji skrzynki.

**Zamiast tego:** Uzywaj `internetMessageId` (RFC 822 Message-ID) jako naturalnego klucza. Graph API `id` przechowuj jako pole pomocnicze.

### Anti-Pattern 5: Template Branching in AI Prompts

**Co:** Jeden prompt ktory mowi "jesli raport wewnetrzny to pokaz X, jesli kliencki to ukryj Y".

**Dlaczego zle:** Modele LLM slabo radza sobie z warunkowymi instrukcjami. Wyciek danych wrażliwych do raportu klienckiego.

**Zamiast tego:** Osobne prompty per szablon. Raport kliencki po prostu nie generuje sekcji 4-6. Filtrowanie na poziomie kodu (is_included), nie na poziomie AI.

---

## Suggested Build Order (Dependencies)

```
Phase 1: Hub Shell
  |-- Auth, login, sidebar, tool registry, theme
  |-- Brak zaleznosci -- mozna budowac niezaleznie
  |-- MUSI byc gotowe zanim zaczniemy email features
  |
Phase 2: Email Ingestion
  |-- Wymaga: Phase 1 (auth, routing)
  |-- Konfiguracja skrzynek, Graph API OAuth, sync z job queue
  |-- Krytyczna: testowanie z prawdziwa skrzynka Outlook
  |-- Wymaga WCZESNEGO ustalenia: Graph API vs IMAP
  |
Phase 3: Email Processing
  |-- Wymaga: Phase 2 (raw_emails w DB)
  |-- Threading, parsowanie, metadane
  |-- Mozna rozwijac rownolegle z Phase 2 (na mockowanych danych)
  |
Phase 4: AI Analysis + Prompt Management
  |-- Wymaga: Phase 3 (przetworzone watki)
  |-- Prompt manager, map-reduce pipeline, job queue
  |-- Mozna zaczac prompt UI rownolegle z Phase 3
  |
Phase 5: Report Generation
  |-- Wymaga: Phase 4 (wyniki analizy)
  |-- 2 szablony, rendering sekcji, edycja
  |
Phase 6: Export
  |-- Wymaga: Phase 5 (gotowe raporty)
  |-- .docx, .pdf, clipboard
  |-- Mozna dodac na samym koncu (najmniejszy priorytet)
```

**Dependency chain:** Shell --> Ingestion --> Processing --> AI Analysis --> Report --> Export

**Parallel opportunities:**
- Phase 3 (Processing) mozna zaczac na mock data zanim Phase 2 jest kompletna
- Prompt Management UI mozna budowac rownolegle z Phase 3
- Export to niezalezna warstwa -- mozna dodac po MVP (kopiowanie do schowka jako pierwsza wersja eksportu)

---

## Scalability Considerations

| Aspekt | 3 skrzynki (MVP) | 10 skrzynek | 50+ skrzynek |
|--------|-------------------|-------------|--------------|
| Email sync | Polling-driven batches, 5-10 min per sync | To samo, rownolegly sync per skrzynka | Potrzebny background worker (Inngest/Supabase Edge Functions + cron) |
| Threading | In-memory per skrzynka (~5K maili = OK) | OK, ale per-mailbox isolation | DB-level threading, incremental |
| AI Analysis | Sequential per raport, ~30 min dla 100 watkow | OK, ale rate limiting | OpenAI Batch API (asynchroniczny, 50% tanszy) |
| Storage | Supabase free tier wystarczajacy (~500MB) | Pro plan, ~2-5GB | Archiwizacja starszych maili |
| Koszt AI | ~$5-15 per pelna analize (GPT-4o) | ~$50-150/msc | GPT-4o-mini dla Fazy 1, GPT-4o dla Fazy 2 |

---

## Key Architecture Decisions Summary

| Decyzja | Wybor | Uzasadnienie |
|---------|-------|-------------|
| Email API | Microsoft Graph API (preferowane) | Standardowe API O365, REST, OAuth2, delta queries. IMAP jako fallback dla on-premise. |
| Timeout strategy | Polling-driven job queue | Najlepsza kompatybilnosc z Vercel (dziala nawet na Free tier). Frontend drivuje postep. |
| Threading | Uproszczony JWZ (In-Reply-To > References > Subject) | Wystarczajacy dla Outlook. 200-300 linii TypeScript vs 800+ pelny JWZ. |
| AI strategy | Map-Reduce (per-watek -> agregacja) | Miesci sie w kontekscie LLM. Cache'owalne. Transparentny progress. |
| Prompt management | 3-tier (default/global/per-raport) | Sprawdzony wzorzec z Marketing Hub. Elastycznosc bez zmian w kodzie. |
| Report format | Markdown jako format posredni | Latwa edycja, renderowanie w przegladarce, konwersja do .docx/.pdf. |
| DOCX export | `docx` (npm) | Deklaratywne API, TypeScript, budowanie od zera (nie template). |
| PDF export | `@react-pdf/renderer` (start), Puppeteer (fallback) | Lekki, bez headless Chrome. Puppeteer jako opcja jesli potrzebna wieksza wiernosc. |
| Progress UI | Frontend polling (GET /status) | Prostsze niz SSE. Dziala z Vercel serverless. Nie wymaga utrzymywania polaczenia. |

---

## Sources

### HIGH confidence (official docs, established patterns)
- [Microsoft Graph Mail API Overview](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview) -- oficjalna dokumentacja
- [Microsoft Graph Delta Queries](https://learn.microsoft.com/en-us/graph/delta-query-messages) -- inkrementalna synchronizacja
- [Next.js after() function](https://nextjs.org/docs/app/api-reference/functions/after) -- oficjalna dokumentacja
- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) -- oficjalna dokumentacja
- [OpenAI Cookbook: Summarizing Long Documents](https://cookbook.openai.com/examples/summarizing_long_documents) -- map-reduce pattern
- [Supabase Queues](https://supabase.com/docs/guides/queues) -- oficjalna dokumentacja

### MEDIUM confidence (verified blog posts, multiple sources)
- [Supabase: Processing Large Jobs](https://supabase.com/blog/processing-large-jobs-with-edge-functions) -- wzorzec job queue
- [Vercel KB: Function Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) -- strategie timeout
- [Inngest: Next.js Timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts) -- przeglad rozwiazan
- [JWZ Threading Algorithm](https://www.jwz.org/doc/threading.html) -- oryginalny opis algorytmu
- [conversationThreading-js](https://github.com/max-mapper/conversationThreading-js) -- JS port JWZ
- [docx npm package](https://github.com/dolanmiu/docx) -- generowanie DOCX
- [SSE in Next.js](https://medium.com/@ruslanfg/long-running-nextjs-requests-eff158e75c1d) -- streaming progress

### LOW confidence (community, single source)
- Puppeteer bundle size na Vercel (50MB limit) -- wymaga weryfikacji z aktualnym stanem @sparticuz/chromium
- GPT-4o-mini wydajnosc dla analizy per-watek -- wymaga testow z prawdziwymi danymi
