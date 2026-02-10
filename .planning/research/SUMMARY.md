# Project Research Summary

**Project:** Lulkiewicz PR Hub — Email Communication Analyzer
**Domain:** Internal PR tooling — communication quality audit
**Researched:** 2026-02-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

Lulkiewicz PR Hub to niszowe narzędzie wewnętrzne łączące email fetching (Outlook), AI content analysis (GPT-4o) i generowanie raportów (.docx/.pdf) dla audytu jakości komunikacji administracji osiedli z mieszkańcami. To NIE jest email marketing analytics ani standard QA tool — to custom solution dla specyficznego case PR agency. Najbliższe analogie: MaestroQA scorecards + EmailAnalytics + niestandardowy AI report generator.

Kluczowa decyzja architektoniczna: **dual-protocol email access** (Microsoft Graph API dla Office 365 jako priorytet, IMAP via imapflow jako fallback dla on-premise Exchange). Typ skrzynki jest nieznany — to największe ryzyko projektu, wymaga natychmiastowego ustalenia z klientem przed Phase 1. Wszystkie operacje long-running (sync emaili, analiza AI, generowanie raportu) muszą być podzielone na chunki ze względu na limity Vercel (300s default, 800s max na Pro). **Map-Reduce pattern** jest obowiązkowy dla analizy AI — pojedyncze wywołanie GPT-4o nie pomieści 5000 emaili (128K token limit).

Największe ryzyka: (1) GDPR compliance — dane osobowe mieszkańców w emailach wymagają DPA z OpenAI, RLS w Supabase, politykę retencji; (2) Microsoft Graph OAuth misconfiguration — application permissions (nie delegated) + admin consent wymagane; (3) context window overflow przy analizie AI — wymaga hierarchicznej analizy per-watek + agregacja. Koszty AI: ~$11 per pełna analiza 1000 wątków przy GPT-4o — bardzo zarządzalne.

## Key Findings

### Recommended Stack

**Core decision:** Graph API vs IMAP jest niewiadome — wymaga discovery call z klientem PRZED rozpoczęciem Phase 1. Jeśli Office 365 (najbardziej prawdopodobne dla biznesowych skrzynek) → Microsoft Graph API (rest, OAuth2, natywne conversationId, delta queries). Jeśli on-premise Exchange → IMAP via imapflow (nowoczesna biblioteka, promise-based, streaming, OAuth2 support). Architektura powinna wspierać oba przez unified adapter pattern.

**Core technologies:**
- **Microsoft Graph API + imapflow (dual strategy)** — email access z adaptorem na poziomie abstrakcji. Graph: superiorne metadane, conversationId, delta sync. IMAP: fallback dla on-premise.
- **GPT-4o with Structured Outputs** — AI analysis z gwarancją schema adherence (response_format: json_schema). Dobre wsparcie polskiego, cost-effective ($2.50/1M input tokens), wystarczające dla domain.
- **Polling-driven job queue** — wszystkie operacje >10s dzielone na batche, frontend drivuje postęp przez polling GET /status. Działa w Vercel 300s limit (Fluid Compute default).
- **docx (npm)** + **@react-pdf/renderer** — export raportów. docx: deklaratywne TypeScript API, budowa dokumentu programowo (nie template files). react-pdf: JSX PDF generation, bez Chromium (Puppeteer jako fallback gdyby wierność była krytyczna).
- **3-tier prompt management** — default z kodu / global editable / per-report editable (wzorzec z Marketing Hub). Każda sekcja raportu ma swój prompt.

**Krytyczne wersje:**
- `@microsoft/microsoft-graph-client` 3.0.7 (nie preview SDK 1.0.0)
- `imapflow` 1.2.x (nie node-imap — unmaintained)
- `mailparser` 3.x (streaming, dla IMAP path)
- `openai` 5.x + `zod` (structured outputs)

### Expected Features

**Must have (table stakes):**
- Konfiguracja połączenia ze skrzynką (OAuth2 / credentials) — bez tego zero danych
- Jednorazowe pobranie emaili (bulk fetch) z paginacją + progress bar — core flow, tysiące emaili
- Parsowanie nagłówków + body (tekst/HTML) — podstawa analizy
- Threading po nagłówkach (In-Reply-To, References) + fallback subject matching — emails bez kontekstu wątku są bezużyteczne
- Widok wątków (lista spraw) + podgląd wątku (timeline) — UX dla browsing danych
- AI analiza per watek: ton, czas reakcji, RODO, dane kontaktowe, status sprawy — core value proposition
- Edytowalne prompty per sekcja raportu (side-by-side: domyślny vs custom) — każdy audyt może wymagać innego nacisku
- Szablon raportu wewnętrznego (full data) + kliencki (filtrowany) — deliverable dla zespołu PR i dewelopera
- Eksport: kopiowanie do schowka (rich text), .docx — minimum do dostarczenia raportu

**Should have (competitive):**
- Scoring per watek (1-10 w wymiarach: ton, reakcja, kompletność, RODO) + radar charts — quantyfikacja jakości
- Automatyczna kategoryzacja tematów wątków (awarie, opłaty, reklamacje) — AI clustering
- Porównanie między skrzynkami — która administracja komunikuje się lepiej?
- Trend analysis (okres vs okres) — czy jakość poprawia się po interwencji PR?
- Dashboard z KPI tiles (avg response time, # wątków, RODO violations, overall score) — szybki przegląd metryki
- Przykłady: cytowanie top 3 best + top 3 worst odpowiedzi — konkretne przykłady dla klienta

**Defer (v2+):**
- Eksport .pdf (HTML/clipboard/docx wystarczy na MVP)
- Automatyczny sync (cron) — manualne "Pobierz maile" wystarczy dla kilku audytów miesięcznie
- Historia raportów z diff view — tracking improvement over time
- Bulk analysis wielu skrzynek na raz — manual per skrzynka na MVP
- Predefiniowane szablony promptów per typ osiedla — single default template na start
- Annotations/komentarze do sekcji raportu — proste edycje markdown wystarczą
- OCR/attachment analysis — body text only na MVP

**Anti-features (świadomie NIE budujemy):**
- Odpowiadanie na maile z poziomu app — read-only tool, compose = ogromna złożoność
- Multi-tenant — jedna instancja jednej agencji, nie wiele organizacji (RLS per user role, nie per org)
- Real-time collaboration na raporcie — zespół 5 osób, jedna generuje raport i eksportuje
- Integracja z Gmail/Yahoo — tylko Outlook (MS Graph / IMAP)
- Zaawansowany ML pipeline / fine-tuning — prompt engineering + GPT-4o API wystarczy

### Architecture Approach

System to **6-warstwowy pipeline sekwencyjnego przetwarzania** owinięty Hub Shell (auth, routing, tools grid). Każda warstwa konsumuje dane z poprzedniej. Krytyczna jest architektura timeoutów — wszystkie operacje >10s dzielone na job queue + polling.

**Major components:**

1. **Hub Shell** — auth (Supabase), routing (Next.js App Router), tool registry (grid 6 kart: 1 aktywne Email Analyzer, 5 "Coming Soon"), settings (general, AI config, org profile). Wzorzec Poltel.

2. **Email Ingestion Layer** — Graph API / IMAP → paginowany fetch → Supabase DB. **Kluczowy problem: Vercel 300s timeout.** Rozwiązanie: self-chaining jobs (każdy batch 50-100 emaili, ~5-10s, tworzy następny job) + frontend polling. Tabele: `mailboxes`, `sync_jobs`, `raw_emails`.

3. **Email Processing Pipeline** — parsowanie nagłówków → threading (uproszczony JWZ: In-Reply-To > References > Subject fallback) → metadata enrichment. Graph API dostarcza `conversationId` natywnie (zero custom code). IMAP wymaga custom threading (200-300 linii TypeScript). Tabele: `email_threads`, `processed_emails`.

4. **AI Analysis Layer** — hierarchiczna analiza (Map-Reduce). **Map:** per-watek (lub batch 5-10 wątków) → GPT-4o z promptem per sekcja → JSON wynik (Structured Outputs). **Reduce:** agregacja wyników wszystkich wątków → prompt zbiorczy → sekcja raportu (Markdown). 3-tier prompt management (default/global/per-report). Tabele: `analysis_jobs`, `analysis_results`, `prompt_templates`.

5. **Report Generation Layer** — 2 szablony (internal: wszystkie 7 sekcji, surowe dane; client: sekcje 1,2,3,7, bez cytatów z maili, zagregowane oceny). Markdown jako format pośredni (łatwa edycja, rendering w przeglądarce, konwersja do .docx/.pdf). Tabele: `reports`, `report_sections`.

6. **Export Layer** — clipboard (rich HTML), .docx (docx lib: programmatic, TypeScript API), .pdf (react-pdf jako start, Puppeteer jako fallback gdyby wierność CSS była krytyczna, ale ~50MB bundle limit na Vercel).

**Data flow:** User "Synchronizuj" → POST /sync (create job) → frontend polling → POST /sync/process (batch 100 emails) → save to DB → trigger processing → threading → save threads → User "Generuj raport" → POST /analysis/start → polling → batch analyze per thread per section → aggregate → render sections → User podgląd (HTML) → User eksport (.docx/clipboard).

**Krytyczne wzorce:**
- **Polling-driven job queue** — zamiast jednego długiego call, małe batche + frontend polling GET /status co 2-3s
- **3-tier prompt resolution** — najpierw szukaj per-report override, potem global, potem default z kodu
- **Idempotent upsert** — wszystkie zapisy używają upsert z naturalnym kluczem (internet_message_id, nie Graph API id który się zmienia)
- **Map-Reduce AI** — per-watek analysis → aggregation (mieści się w kontekście LLM, cache'owalne, transparentny progress)

### Critical Pitfalls

1. **Microsoft Graph OAuth2 misconfiguration** — developerzy używają delegated permissions (wymaga zalogowanego usera) zamiast application permissions (daemon app). Background sync wymaga application permissions (Mail.Read) + admin consent + application access policy do ograniczenia do 3 skrzynek. Wykrywanie: działa w dev z tokenem Postman, pada na deploy. **Phase 1 blocker.**

2. **Vercel timeout przy sync tysięcy emaili** — bez Fluid Compute to 60s max (Hobby), z Fluid Compute 300s default (800s max na Pro). Sync 5000 emaili x 100 stron paginacji = 20-50s samo fetch. Rozwiązanie: chunked sync (50-100 per batch) + frontend-driven polling + zapisz stan w `sync_jobs.page_token`. **Phase 1-2 kritisch.**

3. **GDPR compliance violation** — emaile zawierają dane osobowe mieszkańców (imiona, adresy, skargi). Transfer do OpenAI = zewnętrzny procesor. Wymagane: Supabase EU region (Frankfurt), RLS na wszystkich tabelach, DPA z OpenAI, API flag `"store": false`, polityka retencji (auto-delete po 90 dni), audit log, rozważyć anonimizację przed AI (zamień imiona/adresy na tokeny). **Phase 0 — przed kodem.**

4. **Context window overflow przy AI** — 5000 emaili x 500 tokenów = 2.5M tokenów, GPT-4o ma 128K limit. Wyslanie "wszystkiego" = error lub niekompletna analiza. Rozwiązanie: Map-Reduce (per-watek/batch → agregacja), pre-processing (strip HTML, usun sygnatury/cytaty), token budgeting (tiktoken pre-check, limit $5 per analiza), użyj GPT-4o-mini na Map, GPT-4o na Reduce. **Phase 2-3 kritisch.**

5. **Polskie znaki w emailach (Windows-1250 vs ISO-8859-2)** — Outlook PL często używa Windows-1250 ale deklaruje ISO-8859-2 w Content-Type. Polskie ą ć ę ł ń ó ś ź ż zamieniają się w "krzaczki". Rozwiązanie: mailparser (ma wbudowany iconv-lite) + fallback charset detection (jeśli zdekodowany zawiera U+FFFD, spróbuj alternatywny encoding). Testuj z prawdziwymi emailami od początku, nie syntetyczne. **Phase 1-2.**

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Hub Shell + Email Ingestion
**Rationale:** Fundament — bez emaili w bazie wszystko inne jest niemożliwe. Krytyczna decyzja: Graph API vs IMAP wymaga discovery z klientem PRZED rozpoczęciem tej fazy. Hub shell (auth, routing) musi być gotowy zanim zaczniemy email features.

**Delivers:**
- Działające logowanie (Supabase Auth)
- Tools grid (1 aktywne Email Analyzer, 5 placeholders)
- Konfiguracja skrzynki (credentials encrypted, AES-256-GCM)
- Bulk sync emaili z Microsoft Graph API (lub IMAP fallback)
- Paginowany job queue + progress bar UI
- Surowe emaile zapisane w `raw_emails` (deduplikacja po internet_message_id)

**Addresses:**
- FEATURES.md: Konfiguracja połączenia, bulk fetch, przechowywanie w DB
- STACK.md: Graph API SDK, imapflow (wybór na podstawie discovery), Supabase client

**Avoids:**
- PITFALLS C1 (OAuth misconfiguration) — application permissions + admin consent doc
- PITFALLS C2 (Vercel timeout) — chunked sync, Fluid Compute, job queue z polling
- PITFALLS C3 (GDPR) — Supabase EU region, credentials encryption, RLS schema

**Research flag:** Wymaga discovery call z klientem: typ skrzynki (O365 vs on-premise), Azure AD access, existing credentials format. Jeśli on-premise, wymaga dodatkowego researchu auth method (NTLM? Basic Auth?).

---

### Phase 2: Email Processing + Threading
**Rationale:** Emaile bez threadingu są bezużyteczne do analizy — potrzebujemy pełnych wątków konwersacji. Threading jest prerequsite dla AI analysis. Processing może się zacząć na mock data równolegle z końcówką Phase 1.

**Delivers:**
- Parsowanie nagłówków (Message-ID, In-Reply-To, References) + body (HTML → plain text cleanup)
- Threading algorithm (uproszczony JWZ: In-Reply-To > References > Subject fallback, LUB Graph conversationId jeśli Graph API)
- Tabela `email_threads` z metadatami (subject_normalized, first/last message, participant_addresses, avg_response_time)
- Tabela `processed_emails` z extracted metadata + thread_id
- UI: widok wątków (lista spraw z filtrami: data range, status, nadawca)
- UI: podgląd wątku (timeline chronologiczny, nadawca/data/snippet)

**Addresses:**
- FEATURES.md: Threading po nagłówkach, widok wątków, podgląd wątku, statystyki wątku
- ARCHITECTURE.md: Email Processing Pipeline (C3), threading pattern

**Uses:**
- STACK.md: mailparser (dla IMAP path), custom TypeScript threading, date-fns

**Avoids:**
- PITFALLS M1 (polskie znaki) — mailparser + fallback charset detection, testy z prawdziwymi emailami
- PITFALLS M2 (błędne threading) — priorytet: Graph conversationId (jeśli Graph), fallback na References/In-Reply-To, nie polegaj tylko na subject
- PITFALLS M4 (HTML cleanup) — html-to-text lib, usuń Outlook-specific markup, sygnatury, disclaimery

**Research flag:** Standard patterns — email threading i HTML cleanup są dobrze udokumentowane. Skip `/gsd:research-phase`.

---

### Phase 3: AI Analysis + Prompt Management
**Rationale:** Core value proposition — analiza jakości komunikacji przez AI. Wymaga ukończonego Phase 2 (przetworzone wątki). Prompt management UI można budować równolegle z Phase 2.

**Delivers:**
- Prompt Manager: 3-tier system (default z kodu, global editable, per-report editable)
- UI: Edycja promptów per sekcja raportu (side-by-side: domyślny vs custom, wzorzec Marketing Hub)
- AI Analysis Engine: Map-Reduce pipeline (per-watek analysis → agregacja per sekcja)
- 7 sekcji analizy: (1) Podsumowanie ogólne, (2) Jakość komunikacji (ton, uprzejmość), (3) Czas reakcji, (4) Status spraw, (5) Dane kontaktowe, (6) RODO compliance, (7) Rekomendacje naprawcze
- Polling-driven analysis job queue (batch 10 wątków, progress bar)
- Tabele: `analysis_jobs`, `analysis_results`, `prompt_templates`
- Structured Outputs (GPT-4o z json_schema) — gwarancja schema adherence

**Addresses:**
- FEATURES.md: AI analiza jakości, czasu reakcji, statusu spraw, RODO, dane kontaktowe, edytowalne prompty
- ARCHITECTURE.md: AI Analysis Layer (C4), Map-Reduce pattern, 3-tier prompt resolution

**Uses:**
- STACK.md: OpenAI GPT-4o + Structured Outputs, Zod (schema validation), custom prompt manager

**Avoids:**
- PITFALLS C4 (context overflow) — Map-Reduce (per-watek max 10K tokenów), token budgeting (tiktoken pre-check, $5 limit per analiza), GPT-4o-mini na Map, GPT-4o na Reduce
- PITFALLS m3 (jakość AI dla polskiego) — polski system prompt, kontekst domenowy (terminologia administracji), few-shot examples, walidacja ludzka pierwszych 50 analiz

**Research flag:** Średnia złożoność — OpenAI Structured Outputs są nowe (2024), może wymagać `/gsd:research-phase` jeśli Zod schema design będzie nietypowy. Map-Reduce pattern jest well-documented (OpenAI Cookbook), skip research.

---

### Phase 4: Report Generation + Export
**Rationale:** Deliverable dla klienta. Wymaga ukończonego Phase 3 (wyniki analizy AI). Export może się budować równolegle z rendering UI.

**Delivers:**
- 2 szablony raportów: internal (full, 7 sekcji, surowe dane) + client (filtrowany, sekcje 1,2,3,7, bez cytatów)
- Sekcje jako Markdown (wynik AI, edytowalne przez usera)
- UI: Podgląd raportu w przeglądarce (Markdown → HTML rendering)
- UI: Edycja sekcji raportu (textarea/rich editor)
- Eksport: Kopiowanie do schowka (rich HTML via ClipboardItem API)
- Eksport: .docx (docx lib, programmatic generation z Markdown source)
- Tabele: `reports`, `report_sections`

**Addresses:**
- FEATURES.md: Szablon wewnętrzny/kliencki, podgląd raportu, edycja, kopiowanie do schowka, eksport .docx
- ARCHITECTURE.md: Report Generation Layer (C5), Export Layer (C6), Markdown jako format pośredni

**Uses:**
- STACK.md: docx (npm, v9.x), Markdown parser, Clipboard API

**Avoids:**
- PITFALLS m1 (polskie znaki w .docx) — docx lib z UTF-8 encoding (w:rFonts), test z dużym volumem polskiego tekstu (ą ć ę ł ń ó ś ź ż)

**Research flag:** Standard patterns — .docx generation i Clipboard API są well-documented. Skip `/gsd:research-phase`.

---

### Phase 5: Dashboard & Differentiators (post-MVP)
**Rationale:** Po walidacji MVP z pierwszym raportem. Nice-to-have features które wyróżniają narzędzie.

**Delivers:**
- Dashboard: KPI tiles (avg response time, # wątków, RODO violations, overall score)
- Wykresy trendów (response time over time, wymaga >= 2 raportów)
- Scoring per watek (radar charts: ton, reakcja, kompletność, RODO)
- Kategoryzacja tematów (AI clustering: awarie, opłaty, reklamacje)
- Porównanie między skrzynkami (aggregate scores)
- Detekcja czerwonych flag (eskalacje, groźby prawne, wulgaryzmy)

**Addresses:**
- FEATURES.md: Dashboard KPI, scoring per watek, kategoryzacja, porównanie skrzynek, trend analysis

**Research flag:** Skip research — dashboard patterns i charting libs (Recharts) są standard.

---

### Phase 6: Polish & V2 Features (deferred)
**Rationale:** Tylko jeśli MVP potwierdzi product-market fit i będzie request od zespołu PR.

**Defer to v2+:**
- Eksport .pdf (@react-pdf/renderer lub Puppeteer)
- Automatyczny sync (Vercel Cron + chunked sync)
- Historia raportów z diff view
- Bulk analysis wielu skrzynek
- Predefiniowane szablony promptów per typ osiedla
- Annotations do sekcji raportu
- Heatmap aktywności (dni x godziny)
- OCR/attachment analysis

**Research flag:** .pdf generation z Puppeteer na Vercel wymaga `/gsd:research-phase` (bundle size 50MB, @sparticuz/chromium compatibility).

---

### Phase Ordering Rationale

**Sekwencyjne zależności (muszą być w tej kolejności):**
- Phase 1 (ingestion) → Phase 2 (processing) → Phase 3 (AI) → Phase 4 (report) — każda faza konsumuje dane z poprzedniej
- Phase 1 MUSI być zakończona discovery call (Graph vs IMAP) zanim zacznie się kod

**Możliwe równoległości:**
- Phase 2 processing można zacząć na mock data zanim Phase 1 jest kompletna (przydatne dla testowania threading logic)
- Phase 3 Prompt Management UI można budować równolegle z końcówką Phase 2
- Phase 4 Export (.docx, clipboard) można budować równolegle z UI podglądu raportu

**Dlaczego AI analiza przed dashboard:**
- Dashboard wymaga >= 1 ukończonej analizy (dane wejściowe)
- Trend analysis wymaga >= 2 analiz
- Dashboard to "nice-to-have", raport to "must-have deliverable"

**Dlaczego ten podział unika pitfalls:**
- Chunked phases z job queue od początku (Phase 1) — unikamy Vercel timeout
- GDPR decisions przed Phase 1 — Supabase EU region, RLS schema, DPA z OpenAI
- Map-Reduce w Phase 3 od początku — unikamy context overflow
- Threading pattern w Phase 2 priorytetyzuje Graph conversationId — unikamy błędnego grupowania
- 3-tier prompts w Phase 3 — elastyczność bez zmian w kodzie (Marketing Hub pattern)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1:** Discovery call WYMAGANY przed rozpoczęciem — typ skrzynki (O365 vs on-premise), Azure AD access, credentials format. Jeśli on-premise Exchange → research IMAP auth method (NTLM/Basic/OAuth2).
- **Phase 3:** OpenAI Structured Outputs + Zod schema design — może wymagać `/gsd:research-phase` jeśli schema będzie nietypowy (nested arrays, discriminated unions).
- **Phase 6 (v2):** Puppeteer na Vercel — research bundle size optimization (@sparticuz/chromium), alternatywy (Browserless API, html2pdf services).

**Phases with standard patterns (skip research-phase):**
- **Phase 2:** Email threading (JWZ algorithm), HTML cleanup (html-to-text) — well-documented, standard patterns.
- **Phase 3 (Map-Reduce):** OpenAI Cookbook ma przykłady summarizing long documents — established pattern.
- **Phase 4:** .docx generation (docx lib docs), Clipboard API (MDN) — standard web APIs.
- **Phase 5:** Dashboard + charting (Recharts/Chart.js) — commodity UI patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Graph API vs IMAP decision jest blockerem — wymaga discovery. Po ustaleniu typu skrzynki: HIGH (obie biblioteki są battle-tested). |
| Features | HIGH | Feature landscape bazuje na analogicznych narzędziach (EmailAnalytics, MaestroQA), ale to custom domain — sukcesy zależą od empirycznej walidacji z zespołem PR. |
| Architecture | HIGH | Polling-driven job queue, Map-Reduce AI, 3-tier prompts — wszystkie są proven patterns (Vercel docs, OpenAI Cookbook, Marketing Hub precedent). |
| Pitfalls | HIGH | OAuth2 misconfiguration, Vercel timeouts, GDPR, context overflow — wszystkie są well-documented risks z clear mitigation strategies. |

**Overall confidence:** MEDIUM-HIGH

**Confidence limiters:**
1. **Typ skrzynki nieznany** — bez tego nie możemy wybrać między Graph API a IMAP. Discovery call z klientem jest CRITICAL PATH przed Phase 1.
2. **Jakość AI dla polskiego języka + domain jargon** — GPT-4o ma dobre wsparcie polskiego (general knowledge), ale specyficzna terminologia administracji nieruchomości (wspólnota mieszkaniowa, fundusz remontowy, uchwała, zarządca) wymaga empirycznego testowania. Walidacja ludzka pierwszych 50 analiz jest wymagana.
3. **Threading accuracy w polskiej komunikacji administracyjnej** — generyczne tematy ("Pytanie", "Reklamacja", "Problem") + brakujące nagłówki In-Reply-To w niektórych emailach mogą powodować błędne grupowanie. Graph API conversationId rozwiązuje to problem na poziomie Microsoft, ale tylko dla O365.

### Gaps to Address

**Gap 1: Mailbox type unknown (O365 vs on-premise Exchange)**
- **Impact:** Blocker dla Phase 1 — nie możemy wybrać protokołu email access.
- **Mitigation:** Discovery call z klientem przed rozpoczęciem Phase 1. Pytania: (1) Czy skrzynki są na Office 365 / Microsoft 365? (2) Czy admin ma dostęp do Azure AD / Entra ID? (3) Jaki format credentials jest dostępny?
- **Fallback:** Zaimplementuj unified adapter pattern (EmailProvider interface) w Phase 1, dodaj IMAP implementation w Phase 2 jeśli potrzebne.

**Gap 2: OpenAI Data Processing Agreement (DPA) status**
- **Impact:** GDPR compliance — transfer danych osobowych do OpenAI wymaga DPA.
- **Mitigation:** Sprawdź czy agencja PR ma istniejący OpenAI account z podpisanym DPA. Jeśli nie — podpisz przed Phase 3 (AI analysis). Dokumentuj w privacy policy że AI analysis jest wykonywana przez OpenAI.
- **Alternative:** Rozważ anonimizację danych przed wysłaniem do AI (zamień imiona/adresy na tokeny `[MIESZKANIEC_1]`, `[ADRES_1]`), potem podmień w raporcie.

**Gap 3: Supabase region selection**
- **Impact:** GDPR — dane osobowe muszą pozostać w EU.
- **Mitigation:** Upewnij się że Supabase project jest w EU region (Frankfurt) przed stworzeniem schema. Nie można zmienić regionu po utworzeniu projektu.

**Gap 4: Empirical validation — AI accuracy dla polskiego + domain jargon**
- **Impact:** Jakość analiz może być niższa niż oczekiwano, wymaga iteracji na promptach.
- **Mitigation:** (1) Phase 3 zaczyna się od kilku testowych wątków (5-10) z ręczną walidacją przed pełnym batch. (2) System prompt zawiera kontekst domenowy + few-shot examples. (3) Pierwszy pełny raport jest weryfikowany przez człowieka przed przekazaniem klientowi. (4) Edytowalne prompty pozwalają na iteracje bez zmian w kodzie.

**Gap 5: Token cost estimation accuracy**
- **Impact:** Research szacuje ~$11 per analiza 1000 wątków, ale rzeczywisty koszt zależy od długości emaili i liczby sekcji.
- **Mitigation:** (1) Token budgeting w kodzie (tiktoken pre-check przed call). (2) Twarde limity per analiza ($5 default, configurable). (3) Użyj GPT-4o-mini na Map phase (10x tańszy), GPT-4o tylko na Reduce phase. (4) Dashboard z cost tracking (tokens used, estimated $).

## Sources

### PRIMARY (HIGH confidence)

**Official Microsoft Documentation:**
- [Microsoft Graph Mail API Overview](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview) — official REST API reference
- [Microsoft Graph List Messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages) — pagination, $select, $filter
- [Microsoft Graph Delta Query Messages](https://learn.microsoft.com/en-us/graph/delta-query-messages) — incremental sync pattern
- [Microsoft Graph Authentication Providers](https://learn.microsoft.com/en-us/graph/sdks/choose-authentication-providers) — daemon app (ClientSecretCredential)
- [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference) — application vs delegated
- [Microsoft Graph Throttling](https://learn.microsoft.com/en-us/graph/throttling) — rate limits, retry-after

**Official Vercel Documentation:**
- [Vercel Functions Duration](https://vercel.com/docs/functions/configuring-functions/duration) — Fluid Compute 300s default, 800s max Pro
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) — scheduled functions

**Official OpenAI Documentation:**
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) — json_schema response format
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits) — tier limits, exponential backoff
- [OpenAI Cookbook: Summarizing Long Documents](https://cookbook.openai.com/examples/summarizing_long_documents) — Map-Reduce pattern

**Official npm packages:**
- [@microsoft/microsoft-graph-client 3.0.7](https://www.npmjs.com/package/@microsoft/microsoft-graph-client) — stable SDK (NOT preview)
- [imapflow](https://www.npmjs.com/package/imapflow) — modern IMAP client, v1.2.x
- [mailparser](https://www.npmjs.com/package/mailparser) — Nodemailer ecosystem, v3.x
- [docx](https://www.npmjs.com/package/docx) — programmatic DOCX generation, v9.x
- [@react-pdf/renderer](https://www.npmjs.com/package/@react-pdf/renderer) — JSX PDF generation, v4.3.x

### SECONDARY (MEDIUM confidence)

**GDPR Compliance:**
- [GDPR.eu Email Encryption](https://gdpr.eu/email-encryption/) — email data protection requirements
- [Supabase GDPR Guide](https://www.kontocsv.de/en/ratgeber/supabase-dsgvo-konform) — RLS patterns, EU regions
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron) — scheduled data retention

**Email Threading:**
- [JWZ Threading Algorithm](https://www.jwz.org/doc/threading.html) — original algorithm description
- [Nylas: What is Email Threading?](https://www.nylas.com/products/email-api/what-is-email-threading/) — modern implementation patterns
- [Thread-Index header mystery](https://blog.mutantmail.com/unraveling-the-thread-index-email-header-mystery/) — Outlook proprietary header

**Background Jobs on Vercel:**
- [Supabase: Processing Large Jobs](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — job queue pattern
- [Inngest: Next.js Timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts) — alternatives comparison

**QA Scorecards & Email Analytics:**
- [Zendesk: How to Build a QA Scorecard](https://www.zendesk.com/blog/qa-scorecard/) — scoring dimensions
- [MaestroQA: Email & Chat Scorecard](https://www.maestroqa.com/blog/qa-scorecard-email-chat) — communication quality metrics
- [EmailAnalytics](https://emailanalytics.com/) — response time tracking, sentiment analysis

### TERTIARY (LOW confidence — needs validation)

**Polish charset issues:**
- [Mozilla Bug 1505315](https://bugzilla.mozilla.org/show_bug.cgi?id=1505315) — Windows-1250 vs ISO-8859-2 mismatch in Outlook
- [Windows-1250 Wikipedia](https://en.wikipedia.org/wiki/Windows-1250) — encoding table

**PDF generation on Vercel:**
- [Deploying Puppeteer on Vercel](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel) — @sparticuz/chromium (~50MB), bundle size concerns
- [react-pdf issue #852](https://github.com/diegomura/react-pdf/issues/852) — font embedding for Unicode

---

*Research completed: 2026-02-10*
*Ready for roadmap: YES*
*Critical blocker: Discovery call z klientem (mailbox type) przed Phase 1*
