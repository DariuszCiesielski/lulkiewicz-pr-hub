# Project Research Summary

**Project:** Lulkiewicz PR Hub — Analizator Grup FB (v1.1)
**Domain:** Facebook group monitoring + sentiment analysis for real estate property management
**Researched:** 2026-02-12
**Confidence:** MEDIUM-HIGH (HIGH for integration patterns, MEDIUM for Apify specifics, needs Phase 3 validation)

---

## Executive Summary

FB Analyzer jest kolejnym milestone istniejącego projektu Next.js + Supabase. Badania wykazały, że **architektura email-analyzera (v1.0) zapewnia gotowy szablon** — polling-driven batch processing, admin-only API routes, CSS Variables design system, hook-based state management. Dwa moduły są równoległymi rodzeństwem (parallel siblings) — dzielą infrastrukturę (auth, AI, encryption, export), ale operują na całkowicie rozdzielnych domenach danych.

**Rekomendowany stack to zero nowych npm dependencies:** Apify Actor API przez natywny `fetch()`, analiza sentymentu przez istniejący `callAI()`, szyfrowanie przez `encrypt.ts`, eksport DOCX przez `export-report-docx.ts`. Jedyna nowa zależność zewnętrzna to **Apify Actor `curious_coder/facebook-post-scraper`** (third-party SaaS, już używany w N8N workflow klienta). Całkowite reuse istniejących wzorców eliminuje ryzyko techniczne.

**Największe ryzyko: cookie expiration i timeout mismatch.** Facebook session cookies wygasają nieprzewidywalnie (24h–7 dni), a Apify Actor runs trwają minuty (vs. Vercel 60s limit). Mitigacja wymaga dwufazowej architektury scrapowania (start run → poll status → fetch results in batches) oraz cookie health checks przed każdym scrapem. Drugorzędne ryzyko: AI sentiment dla polskiego tekstu real estate wymaga domain-specific prompts z przykładami kolokwializmów ("Super, znów nie działa winda" = sarkazm = negatywny).

---

## Key Findings

### Recommended Stack

**Kluczowa decyzja: zero nowych npm packages.** Cały stack opiera się na istniejących zależnościach i natywnych API Node.js 22. Apify integration przez `fetch()` (3 endpointy REST API) zamiast `apify-client` npm (12 deps, 2.8 MB) — projekt już używa `fetch()` do Microsoft Graph API, więc wzorzec jest identyczny. Sentiment analysis przez `callAI()` z GPT-5.2 zamiast bibliotek NLP (`sentiment`, `natural` — tylko angielski, brak wsparcia PL). Szyfrowanie Apify token + FB cookies przez istniejący `encrypt.ts` (AES-256-GCM).

**Core technologies:**
- **Natywny `fetch()` (Apify REST API)**: Wywołanie aktora, sprawdzanie statusu, pobieranie datasetu — identyczny wzorzec jak Graph API w email sync
- **callAI() (ai-provider.ts)**: Analiza sentymentu + generowanie raportów — jedyna opcja dla wysokiej jakości analizy polskiego tekstu z kontekstem domenowym
- **encrypt.ts (crypto)**: Szyfrowanie Apify token + FB session cookies — sprawdzony pattern z `mailbox_credentials`
- **Apify Actor `curious_coder/facebook-post-scraper`**: Scrapowanie postów + komentarzy z grup FB — już używany w N8N workflow klienta (MEDIUM confidence na schemat wyjściowy — wymaga walidacji w Phase 3)
- **export-report-docx.ts**: Eksport raportów FB do .docx — reuse bez zmian

**Pewność:** HIGH dla integracji (cała logika oparta na analizie 21+ plików istniejącego codebase), MEDIUM dla Apify Actor API (endpointy REST stabilne, ale schemat wyjściowy aktora wymaga testowego runu), LOW dla Apify pricing (szacunkowy $0.01–0.05 per run).

### Expected Features

**Domain:** Monitoring grup Facebook osiedli mieszkaniowych dla agencji PR zarządzających wizerunkiem deweloperów. Core value proposition = automatyczna klasyfikacja sentymentu + alerty o negatywnych wzminkach wymagających interwencji PR.

**Must have (14 table stakes):**
- CRUD grup FB, scrapowanie postów + komentarzy (Apify Actor), deduplikacja (upsert by `facebook_post_id`)
- Analiza sentymentu AI (pozytywny/negatywny/neutralny/mieszany), ocena istotności (relevance score 0–10, filtr szumu "sprzedaż mieszkań"), kategoryzacja tematyczna (opłaty, naprawy, bezpieczeństwo, etc.)
- Lista postów z filtrami (sentyment, relevance, kategoria, data), drill-down w post z komentarzami
- Dashboard z KPI (total postów, negatywne/pozytywne/neutralne, top kategorie), alerty o negatywnych postach
- Raport zbiorczy per grupa z 7 dedykowanymi sekcjami FB (sentiment overview, negative highlights, positive highlights, categories, risk assessment, recommendations), eksport DOCX
- Konfiguracja Apify (token szyfrowany, parametry scrapowania)

**Should have (10 differentiators):**
- AI snippet (streszczenie postu 1-2 zdania), analiza komentarzy (nie tylko postów), trend sentymentu w czasie, porównanie grup (cross-group ranking)
- Automatyczne tagowanie eskalacji (AI rozpoznaje posty mogące trafić do mediów), edytowalne prompty AI per sekcja raportu
- Kontekst reakcji (likes/comments/shares jako waga w relevance scoring)

**Defer (post-MVP):**
- Raport porównawczy (okres vs okres), eksport alertów email/Telegram, heatmapa aktywności, trend historyczny (wymaga >= 2 scrape w różnych terminach)

**Anti-features (NIE budować):**
- Scraping real-time (webhook/cron) — Vercel maxDuration=60s, dodaje złożoność bez wartości; admin i tak sprawdza raz dziennie
- Własny scraper FB (bez Apify) — niekończąca się walka z Facebook anti-scraping
- Odpowiadanie na posty z narzędzia — compliance nightmare, RODO; narzędzie to monitoring, nie zarządzanie
- Analiza profili autorów — narusza RODO; agreguj po tematach, nie osobach

**Struktura raportu FB (7 sekcji — różni się od email analyzer):**
1. Podsumowanie ogólne (`fb_summary`)
2. Analiza sentymentu (`fb_sentiment_overview`)
3. Uwagi negatywne (`fb_negative_highlights`)
4. Uwagi pozytywne (`fb_positive_highlights`)
5. Analiza tematyczna (`fb_categories`)
6. Ocena ryzyka PR (`fb_risk_assessment`)
7. Rekomendacje (`fb_recommendations`)

### Architecture Approach

**Parallel siblings pattern:** FB Analyzer i Email Analyzer są równoległymi modułami współdzielącymi infrastrukturę (auth, AI, encryption, export), ale z całkowicie rozdzielnymi komponentami UI, API routes i tabelami DB. **Reuse utilities, keep components separate.** Kopiuj wzorce, nie kod — Email i FB mają różne data shapes (mailboxes/threads/emails vs groups/posts/comments), więc shared components wprowadziłyby złożone generyki dla minimalnej korzyści.

**6 nowych tabel DB:** `fb_groups`, `fb_posts`, `fb_comments`, `fb_scrape_jobs`, `fb_analysis_jobs`, `fb_reports`. Kluczowa decyzja: AI sentiment przechowywany bezpośrednio na `fb_posts` (sentiment, relevance_score, ai_snippet, ai_categories) zamiast osobnej tabeli `fb_analysis_results` — sentyment to prosta metadata (enum + float + snippet), nie 7 strukturalnych sekcji jak email analysis.

**Apify integration: dwufazowa architektura polling-based:**
1. **Phase A:** `POST /api/fb/scrape` — uruchamia Apify Actor run, zapisuje `apify_run_id`, return immediately
2. **Phase B:** `POST /api/fb/scrape/process` (polling co 5-10s) — sprawdza status Apify run; jeśli RUNNING → return `hasMore: true`; jeśli SUCCEEDED → fetch dataset items w batch (100 per request), upsert do DB

**Różnica vs email sync:** Email sync = paginated (100 messages/batch, wiele batchy). Apify scrape = fire-and-forget (1 run = cały scrape grupy, polling statusu, 1 pobranie datasetu po completion). Wzorzec `useScrapeJob` (kopia `useSyncJob`) mapuje naturalnie, ale server-side logika jest inna — większość wywołań `/process` tylko sprawdza status (fast), ostatnie wywołanie pobiera dane (slow, paginowane).

**Major components:**
1. **Groups Management** — CRUD grup FB (URL, name, status), settings (Apify token szyfrowany)
2. **Apify Integration Layer** — `apify-client.ts` (3 funkcje: startActorRun, getRunStatus, getDatasetItems), polling hook `useScrapeJob`
3. **Post Browsing** — Lista postów z filtrami (sentiment, relevance, kategoria, data), drill-down (post + komentarze)
4. **AI Sentiment Analysis** — `useFbAnalysisJob` (batch processing 1 post per request), prompty domain-specific (kolokwializmy PL, kontekst real estate), structured JSON output (sentiment, score, categories, snippet)
5. **Dashboard** — KPI tiles (total, sentiment distribution, top categories), alerty negatywne (relevance >= 7)
6. **Reports + Export** — Generowanie 7 sekcji FB (aggregacja analyzed posts), DOCX export (reuse `export-report-docx.ts`)

**Recommended extraction:** `verifyAdmin()` i `getAdminClient()` są copy-paste w 21 API route files. Wyciągnij do `src/lib/api/admin.ts` w Phase 1 — tylko nowe FB routes używają extracted utility, istniejące email routes można migrować później (optional, nie blocking).

### Critical Pitfalls

**Top 5 pitfalls z prevention strategies:**

1. **Apify Scrape Timeout vs Vercel Timeout Mismatch (CRITICAL — Phase 3)**
   - **Problem:** Apify Actor run trwa 3-15 min, Vercel limit 60s. Jeśli `/scrape/process` próbuje START + WAIT for results w jednym wywołaniu → timeout 504 dla każdej grupy z 50+ postów.
   - **Prevention:** Dwufazowa architektura (Phase A: start run, return; Phase B: poll status co 5-10s → fetch dataset w batch po SUCCEEDED). Dataset pagination (100 items per request) z `offset`/`limit`.
   - **Detection:** Test z grupą 200+ postów.

2. **Facebook Cookie Expiration Mid-Scrape (CRITICAL — Phase 3)**
   - **Problem:** FB session cookies (`c_user`, `xs`) wygasają nieprzewidywalnie (24h–7 dni). Jeśli cookies expire → Apify run "succeeds" z 0 results (silent failure).
   - **Prevention:** Cookie health check przed scrapem (lightweight test: `maxPosts: 1`), post-scrape validation (`posts_found = 0` na grupie z historią = suspicious), `cookie_status` field w UI (valid/expired/unknown), admin notification (banner/Telegram).
   - **Detection:** `posts_found = 0` na grupie z poprzednimi postami.

3. **AI Sentiment Misclassification for Polish Real Estate Context (HIGH — Phase 5)**
   - **Problem:** Generic sentiment analysis myli polski tekst real estate: "Super, znów nie działa winda" (sarkazm = negatywny) klasyfikowane jako pozytywny, "Proszę o interwencję w sprawie cisza nocna" (skarga) jako neutralne (polite language).
   - **Prevention:** Domain-specific system prompts z przykładami polskich kolokwializmów, few-shot examples (5-10 real posts), structured JSON output (sentiment + confidence score + aspect-level sentiment), manual review pierwszych 20-30 analyzed posts (iteracja prompts jeśli accuracy < 80%).

4. **Duplicate Post Detection Failure (HIGH — Phase 1 + Phase 3)**
   - **Problem:** Wielokrotne scrape tej samej grupy → duplikaty postów w DB → zawyżone KPI, duplikatowa analiza, wasted AI tokens.
   - **Prevention:** `UNIQUE(group_id, facebook_post_id)` constraint w Phase 1, upsert strategy `ON CONFLICT DO UPDATE SET` (update likes/comments/shares — te się zmieniają), track content changes (`content_hash` SHA-256, `content_updated_at`), test migration (insert same post twice → verify constraint works).
   - **Detection:** `SELECT facebook_post_id, COUNT(*) FROM fb_posts GROUP BY facebook_post_id HAVING COUNT(*) > 1`.

5. **Account Ban Escalation (HIGH — Phase 3)**
   - **Problem:** FB account używany do session cookies zostaje banned (temporary/permanent) → całkowity feature outage do czasu nowych cookies.
   - **Prevention:** NIE używać personal account admina (dedykowany account do scrapingu), rate limiting między grupami (5 min delay, wzorzec z N8N workflow), scrape frequency limit (max 1x/dzień per grupa), sequential scraping (never parallel dla tego samego accountu), graceful degradation (reszta app działa bez scrapingu).

**Pitfalls Phase 3 research:** Apify Actor output schema (LOW confidence — needs test run), Apify dataset pagination (LOW confidence — verify docs), FB cookie expiration timing (MEDIUM confidence — varies), Actor input parameters (`sessionCookies` vs `cookies` field name).

---

## Implications for Roadmap

Badania wskazują na **7 faz sekwencyjnych** (Phases 6+7 można zrównoleglić → 6 faz critical path). Każda faza opiera się na wzorcach email-analyzer, ale z dedykowanym kodem dla domeny FB.

### Phase 1: Foundation (DB + Types + Navigation)
**Rationale:** MUST BE FIRST — wszystkie downstream fazy potrzebują tabel, typów i nawigacji. Zero functional features, ale fundament dla reszty.
**Delivers:** SQL migration (6 tabel + RLS + indexes), `src/types/fb.ts`, extract `src/lib/api/admin.ts` (verifyAdmin, getAdminClient), update Sidebar NAV_ITEMS, update `tools.ts` (active=true), shell pages (empty z placeholders).
**Addresses:** TS-1 (foundation for CRUD), TS-3 (deduplikacja — UNIQUE constraints), Pitfall 4 (duplicate detection).
**Avoids:** Pitfall 18 (migration conflicts — all new tables, no ALTER existing).
**Research flag:** None — standard pattern (existing email schema jako template).

### Phase 2: Group Management (CRUD)
**Rationale:** SECOND — downstream fazy potrzebują grup w DB (scraping wymaga `group_id`, analysis wymaga grupy do filtrowania).
**Delivers:** API routes `/api/fb/groups` (GET, POST, PUT, DELETE), components (GroupForm, GroupCard, GroupList), page `/fb-analyzer/groups`.
**Uses:** Extract admin utility z Phase 1, design system (CSS Variables).
**Implements:** Groups Management component.
**Addresses:** TS-1 (CRUD grup FB).
**Avoids:** Pitfall 19 (ToolId registry — update union type w Phase 1).
**Research flag:** None — trivial CRUD (mailboxes CRUD jako template).

### Phase 3: Apify Scraping
**Rationale:** THIRD — posty w DB są wymagane dla wszystkich kolejnych faz (browsing, analysis, dashboard, reports). This is THE critical phase — core integration z Apify.
**Delivers:** `src/lib/fb/apify-client.ts` (Apify Actor API wrapper), API routes `/api/fb/scrape` + `/scrape/process` + `/scrape/status/[jobId]`, hook `useScrapeJob.ts`, component `ScrapeProgress.tsx`, page `/fb-analyzer/settings` (Apify token config).
**Uses:** Natywny `fetch()`, encrypt.ts (Apify token + FB cookies), useSyncJob pattern (copied + adapted).
**Implements:** Apify Integration Layer.
**Addresses:** TS-2 (scrapowanie), TS-3 (deduplikacja — upsert), TS-13 (konfiguracja Apify).
**Avoids:** Pitfall 1 (timeout mismatch — dwufazowa architektura), Pitfall 2 (cookie expiration — health check), Pitfall 5 (account ban — rate limiting), Pitfall 6 (Actor schema changes — validation layer), Pitfall 7 (dataset fetching timeout — pagination).
**Research flag:** **CRITICAL** — Apify Actor API response format needs validation (current docs + test run). Dokladny schemat wyjściowy `curious_coder/facebook-post-scraper`, nazwa pola cookies (`sessionCcookies` vs `cookies`), dataset pagination params. **Recommendation:** Run manual test scrape via Apify Console before implementation.

### Phase 4: Post Browsing
**Rationale:** FOURTH — weryfikacja że scraping działa (Phase 3), potrzebne do testu flow przed AI analysis. Również delivery value dla admina (przegląd surowych danych).
**Delivers:** API routes `/api/fb/posts` (GET z filtrami) + `/api/fb/posts/[id]`, components (PostCard, PostList, PostFilters, PostDetail, CommentCard, SentimentBadge, RelevanceBadge), pages `/fb-analyzer/posts` + `/fb-analyzer/posts/[id]`.
**Uses:** Design system, ThreadList/ThreadFilters pattern (filtered lists).
**Implements:** Post Browsing component.
**Addresses:** TS-7 (lista z filtrami), TS-8 (drill-down post + komentarze).
**Avoids:** Pitfall 11 (image-only posts — `post_type` field, display logic).
**Research flag:** None — standard filtered list (ThreadList jako template).

### Phase 5: AI Sentiment Analysis
**Rationale:** FIFTH — core value proposition, wymaga postów w DB (Phase 3+4). Analysis results zasilają dashboard i reports.
**Delivers:** `src/lib/fb/fb-sentiment-prompts.ts` (domain-specific prompts PL), API routes `/api/fb/analysis` + `/analysis/process`, hook `useFbAnalysisJob.ts`, component `AnalysisProgress.tsx`, page `/fb-analyzer/analyze`.
**Uses:** callAI() (reuse), loadAIConfig() (reuse), useAnalysisJob pattern (copied + adapted), BATCH_SIZE=1 (Vercel timeout safety).
**Implements:** AI Sentiment Analysis component.
**Addresses:** TS-4 (sentyment AI), TS-5 (relevance score), TS-6 (kategorie), D-1 (AI snippet), D-10 (kontekst reakcji — likes/comments/shares w relevance scoring).
**Avoids:** Pitfall 3 (Polish sentiment misclassification — domain prompts z examples), Pitfall 8 (reusing AI provider — FB-specific wrapper), Pitfall 12 (Apify token storage — canonical location: encrypted in DB).
**Research flag:** **MEDIUM** — AI prompt engineering dla polskiego real estate wymaga iteracji. Plan: manual review pierwszych 20-30 analyzed posts, tune prompts jeśli accuracy < 80%. Few-shot examples w promptach (5-10 real posts z oczekiwaną klasyfikacją).

### Phase 6: Dashboard
**Rationale:** SIXTH — wymaga posts + analysis data (Phase 5). Delivers actionable insights (alerty negatywne, KPI overview).
**Delivers:** API route `/api/fb/dashboard` (aggregated KPI), component `FbDashboardKPI.tsx`, page `/fb-analyzer/dashboard`.
**Uses:** Dashboard pattern z email-analyzer (KPI tiles + quick actions).
**Implements:** Dashboard component (KPI: total posts, sentiment distribution, top categories, alerts).
**Addresses:** TS-9 (dashboard KPI), TS-10 (alerty negatywne), D-4 (porównanie grup cross-group ranking).
**Avoids:** Pitfall 14 (missing error table — `error_message` field + UI widget "Last 5 scrape failures").
**Research flag:** None — straightforward aggregation queries.

### Phase 7: Reports + Export
**Rationale:** SEVENTH (LAST) — wymaga analyzed posts (Phase 5). Final deliverable = dokumentacja dla klienta dewelopera.
**Delivers:** `src/lib/fb/fb-report-generator.ts` (report logic, 7 sekcji FB), API routes `/api/fb/reports` (GET, POST, PUT, DELETE), components (FbReportGenerator, FbReportPreview), pages `/fb-analyzer/reports` + `/fb-analyzer/reports/[id]`, DOCX export (reuse `export-report-docx.ts`).
**Uses:** Report generation pattern (email reports jako template), markdown-to-docx.ts (reuse).
**Implements:** Reports + Export component.
**Addresses:** TS-11 (raport zbiorczy), TS-12 (eksport DOCX), TS-14 (sekcje raportu FB — 7 dedykowanych), D-8 (edytowalne prompty AI per sekcja).
**Avoids:** Pitfall 17 (shared AI config conflict — use same config dla obu tools w v1.1, document że settings są shared).
**Research flag:** None — standard report generation (email reports jako template, różne sekcje).

### Phase Ordering Rationale

**Sekwencyjność:**
- Phase 1 → 2 → 3 = strict dependency (DB → groups → scraping)
- Phase 3 → 4 → 5 = data flow (scrape → browse → analyze)
- Phase 5 → {6, 7} = analysis zasilą dashboard i reports

**Parallelization opportunities:**
- Phase 2 + settings page (Phase 3) mogą overlap (CRUD grup + Apify settings są niezależne)
- Phase 6 + Phase 7 są częściowo niezależne (oba zależą od Phase 5, ale nie od siebie)

**Critical path:** 6 sekwencyjnych faz (Phase 1 → 2 → 3 → 4 → 5 → {6 || 7}).

**Build order avoids pitfalls:**
- UNIQUE constraints w Phase 1 (Pitfall 4: duplicate detection)
- Dwufazowa architektura scrapowania w Phase 3 (Pitfall 1: timeout mismatch)
- Cookie health checks w Phase 3 (Pitfall 2: cookie expiration)
- Domain-specific prompts w Phase 5 (Pitfall 3: sentiment misclassification)

### Research Flags

**Phases needing deeper research:**
- **Phase 3 (Scraping):** Apify Actor API output schema — dokladne pola zwracane przez `curious_coder/facebook-post-scraper`, input parameter naming (`sessionCookies` vs `cookies`), dataset pagination behavior. **Action:** Manual test run via Apify Console + read Actor README on Apify Store before implementation.
- **Phase 5 (AI Analysis):** Polish sentiment prompts — iteracja po manual review pierwszych analyzed posts. **Action:** Przygotuj 5-10 few-shot examples z real posts (jeśli dostępne) przed finalizacją prompts.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** SQL migrations + types — email schema jako template (HIGH confidence).
- **Phase 2 (Groups CRUD):** Trivial CRUD — mailboxes CRUD jako template (HIGH confidence).
- **Phase 4 (Post Browsing):** Filtered lists — ThreadList/ThreadFilters jako template (HIGH confidence).
- **Phase 6 (Dashboard):** Aggregation queries — email dashboard jako template (HIGH confidence).
- **Phase 7 (Reports):** Report generation + DOCX — email reports jako template, różne sekcje (HIGH confidence).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Wszystkie decyzje oparte na codebase analysis (21+ files). Natywny fetch() vs apify-client (12 deps) = clear choice. Apify REST API endpointy stable (training data). Actor output schema = MEDIUM (needs validation). |
| Features | **MEDIUM-HIGH** | Table stakes (14 features) oparte na domain knowledge social listening + PR monitoring. Differentiators (10 features) oparte na competitor analysis (Brand24, SentiOne) — training data only (LOW confidence na specifics). Sekcje raportu FB (7) dopasowane do use case. |
| Architecture | **HIGH** | Cały architecture plan oparty na full codebase analysis istniejącego email-analyzer. Parallel siblings pattern = proven (oba moduły współdzielą infrastructure, rozdzielne components). Dwufazowa architektura Apify scrapowania = konieczność z powodu Vercel timeout (HIGH confidence). DB schema (6 tabel) = mirror email schema pattern (HIGH confidence). |
| Pitfalls | **HIGH** | Top 5 critical pitfalls: Pitfall 1 (Apify timeout) = HIGH confidence (istniejący BATCH_SIZE=1 constraint, commit 715f9d2). Pitfall 2 (cookie expiration) = MEDIUM (training data FB scraping patterns). Pitfall 3 (Polish sentiment) = MEDIUM (NLP knowledge PL language). Pitfall 4 (duplicate detection) = HIGH (email schema jako template). Pitfall 5 (account ban) = MEDIUM (training data FB anti-scraping). |

**Overall confidence:** MEDIUM-HIGH

**Breakdown:**
- **Integration patterns (architecture, reuse, DB schema):** HIGH — cały plan oparty na istniejącym codebase
- **Apify Actor specifics (output schema, input params):** MEDIUM-LOW — wymaga validation w Phase 3 research
- **Polish sentiment AI (prompts, accuracy):** MEDIUM — wymaga iteracji w Phase 5
- **Facebook anti-scraping (cookie expiration, account bans):** MEDIUM — training data (cutoff: May 2025), może się zmienić

### Gaps to Address

**Apify Actor API validation (Phase 3):**
- **Gap:** Dokladny schemat wyjściowy `curious_coder/facebook-post-scraper` (field names, types) — LOW confidence, oparte na training data
- **Action:** Manual test run via Apify Console przed implementacją Phase 3. Weryfikuj: (1) output fields (`postId` vs `post_id`? `text` vs `content`?), (2) input parameters (`sessionCookies` vs `cookies`?), (3) dataset pagination (`offset` + `limit` supported?), (4) run timing (ile trwa run dla grupy z 100 postów?), (5) error handling (co zwraca gdy cookies expired?)
- **Timing:** Before Phase 3 implementation starts

**Polish sentiment prompt engineering (Phase 5):**
- **Gap:** Few-shot examples dla polskiego real estate tekstu — brak real data w research phase
- **Action:** Manual review pierwszych 20-30 analyzed posts, iteracja prompts jeśli accuracy < 80%. Przygotuj 5-10 few-shot examples w promptach (jeśli real posts dostępne przed Phase 5, użyj ich jako examples).
- **Timing:** During Phase 5 implementation, iteracja po pierwszym batch analysis

**Facebook cookie expiration detection (Phase 3):**
- **Gap:** Nie znamy dokładnego timing wygasania cookies (24h–7 dni to szerokie okno) ani dokladnej error response z Apify Actor gdy cookies expired
- **Action:** Monitor `fb_scrape_jobs` przez pierwsze tygodnie użytkowania. Track pattern: `posts_found = 0` na grupie z historią. Refinuj detection logic w cookie health check based on observed failures.
- **Timing:** Post-Phase 3 monitoring, refinement w v1.1.1 patch

**Apify cost tracking (Phase 3 + Phase 6):**
- **Gap:** Orientacyjny koszt per run ($0.01–0.05) to szacunek (LOW confidence) — zalezy od group size, Apify pricing tier, proxy usage
- **Action:** Track actual Apify compute units per scrape job (dostępne w Apify API response lub dashboard). Display w `/fb-analyzer/settings` + dashboard alert jeśli monthly cost > threshold.
- **Timing:** Phase 3 (track CU in `fb_scrape_jobs`), Phase 6 (dashboard widget)

---

## Sources

### Primary (HIGH confidence)
- **Istniejący codebase v1.0 (21+ files analyzed):** `src/lib/ai/ai-provider.ts`, `src/lib/crypto/encrypt.ts`, `src/lib/export/export-report-docx.ts`, `src/hooks/useSyncJob.ts`, `src/hooks/useAnalysisJob.ts`, `src/app/api/sync/`, `src/app/api/analysis/`, `src/app/api/reports/`, `src/components/email/`, `src/components/threads/` — HIGH confidence na wszystkie integration patterns, design system, polling-based architecture
- **Project plan:** `C:\Users\dariu\.claude\plans\lexical-marinating-blossom.md` (milestone v1.1 architecture)
- **Handoff doc:** `docs/HANDOFF-2026-02-12.md` (context on email-analyzer v1.0, N8N workflow)
- **STATE.md:** `.planning/STATE.md` (phases 3-6 complete, v1.1 started)
- **npm registry:** `npm view apify-client` (v2.22.0, 12 deps, 2.8 MB), `npm view sentiment` (v5.0.2, EN only), `npm view natural` (v8.1.0, brak PL) — HIGH confidence na package details

### Secondary (MEDIUM confidence)
- **Training data (Apify Actor API):** REST API endpointy (`POST /v2/acts/{id}/runs`, `GET /v2/actor-runs/{id}`, `GET /v2/datasets/{id}/items`), run status lifecycle (READY → RUNNING → SUCCEEDED/FAILED) — MEDIUM confidence (API stable od lat, ale szczegóły mogą się różnić)
- **Training data (Facebook scraping patterns):** Cookie expiration behavior (24h–7 dni), anti-scraping measures (rate limits, IP reputation, account age), session cookies required (`c_user`, `xs`, `datr`, `fr`, `sb`) — MEDIUM confidence (general patterns, ale FB zmienia detection methods)
- **Training data (Polish NLP):** Sentiment analysis challenges dla języka polskiego (diminutives, sarcasm, domain vocab), kolokwializmy real estate ("Super, znów nie działa winda") — MEDIUM confidence (linguistic knowledge stabilne, ale model quality varies)

### Tertiary (LOW confidence, needs validation)
- **Training data (`curious_coder/facebook-post-scraper` Actor):** Output schema (`postId`, `text`, `authorName`, `timestamp`, `likesCount`, `comments[]`), input parameters (`groupUrls`, `sortType`, `scrapeUntil`, `maxPosts`, `sessionCookies`), run timing (1-5 min per grupa), cost ($0.01–0.05 per run) — LOW confidence, wszystko wymaga walidacji z Actor README + test run
- **Training data (competitor tools):** Brand24, SentiOne, Mention features i pricing — LOW confidence, niezweryfikowane z current market offerings

---

*Research completed: 2026-02-12*
*Ready for roadmap: yes*
*Next step: Roadmap creation (7 phases: Foundation → Groups CRUD → Apify Scraping → Post Browsing → AI Analysis → Dashboard → Reports)*
