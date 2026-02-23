# Roadmap: Lulkiewicz PR Hub

## Overview

Lulkiewicz PR Hub to wewnetrzna platforma narzędziowa dla agencji PR obslugujacej deweloperow nieruchomosci. MVP dostarcza jeden kluczowy modul -- Analizator Komunikacji Email -- ktory pobiera tysiace maili ze skrzynek Outlook administracji osiedli, grupuje je w watki, analizuje jakosc komunikacji za pomoca AI i generuje raporty (wewnetrzny + kliencki) z eksportem do .docx/.pdf/clipboard. Roadmapa prowadzi przez 6 sekwencyjnych faz: od fundamentu (auth, hub shell) przez pipeline emailowy (ingestion, threading) i analiza AI, az po raporty i dashboard.

Milestone v1.1 dodaje drugi modul -- Analizator Grup FB -- ktory scrapuje posty z grup Facebookowych osiedli mieszkaniowych (przez Apify Actor), analizuje sentyment AI, filtruje istotne posty i generuje raporty z linkami do oryginalnych postow na FB. Fazy 7-12 prowadza od fundamentu (DB, nawigacja) przez integracje Apify, analize AI, widok postow i dashboard, az po raporty z eksportem DOCX.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### v1.0 Email Analyzer (Phases 1-6) -- COMPLETE (+ Phase 2.1 INSERTED)

- [x] **Phase 1: Hub Shell & Fundament** - Auth, role, design system, grid narzedziowy, sidebar, responsywnosc
- [x] **Phase 2: Email Connection & Fetching** - Podlaczenie skrzynek Outlook, bulk sync maili, parsowanie, baza danych
- [x] **Phase 2.1: Multi-Folder Sync** (INSERTED) - Sync wszystkich folderow (nie tylko Inbox), legenda statusow, polskie znaki — **3 plans, 2 waves**
- [x] **Phase 3: Email Threading & Browsing** - Grupowanie maili w watki, widok watkow, filtrowanie, zakres czasowy
- [x] **Phase 4: AI Analysis, Prompty & Kryteria Oceny** - Analiza AI per watek, Map-Reduce pipeline, prompt management, custom scoring
- [x] **Phase 5: Report Generation & Export** - Generowanie raportow (wew/kliencki), podglad, edycja, eksport docx/pdf/clipboard
- [x] **Phase 6: Dashboard & Polish** - KPI tiles, podsumowania per skrzynka, quick actions, ostatnie raporty

### v1.0 Email Analyzer Quality (Phase 2.2 INSERTED)

- [x] **Phase 2.2: Email Analyzer Quality** (INSERTED) — Thread intelligence (AI summary + status), analysis UX (date presets, ETA, sound), synthetic reports (AI REDUCE), UI polish (contrast, navigation, prompt CRUD) — **4 plans, 2 waves**

### v1.1 FB Analyzer (Phases 7-12)

- [ ] **Phase 7: FB Foundation** - Migracja DB (6 tabel + RLS), typy TS, nawigacja sidebar, layout + shell pages, admin utilities extraction — **3 plans, 2 waves**
- [ ] **Phase 8: Group Management** - CRUD grup FB, status active/paused, bulk ops, konfiguracja Apify (token szyfrowany + FB cookies) — **4 plans, 3 waves**
- [x] **Phase 9: Scraping Engine** - Integracja Apify Actor API, dwufazowa architektura polling, ochrona konta FB, rate limiting, error handling — **4 plans, 2 waves**
- [ ] **Phase 10: AI Sentiment Analysis** - Kwalifikacja postow (sentyment + relevance + kategorie), domain-specific prompty PL, batch processing, edytowalne prompty
- [ ] **Phase 11: Post Browsing & Dashboard** - Widok TYLKO istotnych postow z filtrami i linkami do FB, dashboard KPI, alerty negatywne, quick actions
- [ ] **Phase 12: Reports & Export** - Raporty na zadanie z sekcjami per grupa, tabela postow z linkami FB, edytowalne prompty, eksport DOCX, historia

## Phase Details

### Phase 1: Hub Shell & Fundament
**Goal**: Uzytkownik moze sie zalogowac, zobaczyc grid narzedziowy i nawigowac po aplikacji z pelnym design systemem
**Depends on**: Nothing (first phase)
**Requirements**: HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, HUB-06, HUB-07, HUB-08, HUB-09, HUB-10
**Success Criteria** (what must be TRUE):
  1. Uzytkownik moze sie zarejestrowac (email + haslo), zalogowac i sesja utrzymuje sie po odswiezeniu przegladarki
  2. Niezalogowany uzytkownik jest automatycznie przekierowany na strone logowania
  3. Admin widzi panel admina z lista uzytkownikow, moze dodawac uzytkownikow, edytowac role (admin/user) i kontrolowac dostep do narzedzi
  4. Dashboard wyswietla grid 6 kart narzedziowych — Analizator Email aktywny, pozostale 5 jako "Coming Soon" — z sidebar nawigacja i footer
  5. Aplikacja wyglada spojnie na desktop, tablet i mobile z Unified Design System (6 motywow, przelacznik w menu uzytkownika)
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js + Supabase Auth (rejestracja, logowanie, sesja, protected routes)
- [x] 01-02-PLAN.md — System rol admin/user + panel admina (user management, tool access control)
- [x] 01-03-PLAN.md — Hub UI: grid narzedziowy, sidebar, Unified Design System, footer, responsywnosc

### Phase 2: Email Connection & Fetching
**Goal**: Uzytkownik moze podlaczyc skrzynke Outlook i pobrac z niej tysiace maili do bazy danych z widocznym progressem
**Depends on**: Phase 1
**Requirements**: MAIL-01, MAIL-02, MAIL-03, MAIL-04, MAIL-05, FETCH-01, FETCH-02, FETCH-03, FETCH-04, FETCH-05, FETCH-06, FETCH-07
**Success Criteria** (what must be TRUE):
  1. Uzytkownik moze dodac skrzynke Outlook (adres email, credentials), przetestowac polaczenie i zobaczyc wynik (sukces/blad z opisem)
  2. Uzytkownik moze zarzadzac wieloma skrzynkami (dodawanie, usuwanie, lista z statusami)
  3. Uzytkownik moze uruchomic bulk sync maili i widziec progress bar (pobrane/calkowite) — sync obsluguje tysiace maili bez timeout
  4. Uzytkownik moze odswiezyc skrzynke (delta sync — tylko nowe maile od ostatniego pobrania)
  5. Pobrane maile sa poprawnie sparsowane (nadawca, odbiorca, data, temat, Message-ID, In-Reply-To, References, tresc w czystym tekscie z poprawnymi polskimi znakami)
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md — Fundament: DB migration (mailboxes, sync_jobs, emails), typy TS, AES-256 encrypt, Graph API auth + client
- [x] 02-02-PLAN.md — Mailbox CRUD API + test polaczenia + UI zarzadzania skrzynkami (formularz, lista, statusy)
- [x] 02-03-PLAN.md — Sync engine: email fetcher (pagination), parser (HTML to text, threading headers), sync API routes
- [x] 02-04-PLAN.md — Sync UI: useSyncJob hook, progress bar, full sync + delta sync integracja z UI

### Phase 3: Email Threading & Browsing
**Goal**: Uzytkownik moze przegladac maile pogrupowane w watki (sprawy) z filtrowaniem i wyborem zakresu czasowego
**Depends on**: Phase 2
**Requirements**: THREAD-01, THREAD-02, THREAD-03, THREAD-04, THREAD-05
**Success Criteria** (what must be TRUE):
  1. Maile sa automatycznie pogrupowane w watki (In-Reply-To, References, Subject fallback lub Graph conversationId)
  2. Uzytkownik widzi liste watkow z liczba wiadomosci, datami, uczestnikami i moze wejsc w szczegoly watku (chronologiczny widok maili)
  3. Uzytkownik moze filtrowac watki po dacie, nadawcy, statusie (otwarty/zamkniety) i slowach kluczowych
  4. Uzytkownik moze wybrac zakres czasowy analizy (1-3 miesiace) z uwzglednieniem starszych otwartych spraw
**Plans**: Fast-tracked (zaimplementowane w jednym commicie 1f853d6, 2026-02-11)

Plans:
- [x] 03-01: Algorytm threadingu (Union-Find) + migracja (email_threads) + thread-builder.ts
- [x] 03-02: UI listy watkow, drill-down w watek, filtrowanie (ThreadList, ThreadCard, ThreadFilters, EmailMessage)

### Phase 4: AI Analysis, Prompty & Kryteria Oceny
**Goal**: Uzytkownik moze uruchomic analiza AI na wybranych watkach, zdefiniowac wlasne kryteria oceny i zarzadzac promptami per sekcja raportu
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, EVAL-01, EVAL-02, EVAL-03, EVAL-04
**Success Criteria** (what must be TRUE):
  1. Uzytkownik moze uruchomic analiza AI i widziec progress bar z informacja o aktualnie przetwarzanym watku — analiza obejmuje 13 sekcji: metadane, szybkosc reakcji, efektywnosc obslugi, jakosc relacji, cykl komunikacji, feedback klientow, forma wypowiedzi, jasnosc komunikacji, spojnosc organizacji, proaktywnosc, komunikacja wewnetrzna, RODO i rekomendacje
  2. Uzytkownik moze konfigurowac providera AI (OpenAI/Anthropic/Google), klucz API i model
  3. Uzytkownik moze edytowac prompty per sekcja raportu z podgladem side-by-side (domyslny vs edytowany), resetowac do domyslnego i korzystac z 3-tier resolution (kod/globalny/per-raport)
  4. Uzytkownik moze definiowac checklisty (tak/nie) i scoring rubrics (kryteria + wagi + skala) — AI ocenia kazdy punkt, wyniki widoczne z wizualnymi wskaznikami
  5. Analiza AI dziala na zasadzie Map-Reduce (per-watek analiza z agregacja) i miesci sie w limitach kontekstu LLM
**Plans**: Fast-tracked (zaimplementowane w jednym commicie 1f853d6, 2026-02-11)

Plans:
- [x] 04-01: Konfiguracja AI (provider, klucz, model) + migracja (analysis_jobs, analysis_results, prompt_templates, evaluation_criteria) + ai-provider.ts
- [x] 04-02: Prompt management UI — edycja promptow per sekcja, default-prompts.ts
- [x] 04-03: Custom evaluation criteria — tabela evaluation_criteria istnieje w DB, brak UI (known gap)
- [x] 04-04: Map-Reduce AI pipeline — analiza per watek z anonimizacja, useAnalysisJob hook, progress bar

### Phase 5: Report Generation & Export
**Goal**: Uzytkownik moze wygenerowac raport (wewnetrzny lub kliencki), przejrzec go, edytowac i wyeksportowac do schowka, .docx lub .pdf
**Depends on**: Phase 4
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. Uzytkownik moze wygenerowac raport AI na podstawie wynikow analizy — wybierajac szablon wewnetrzny (pelny, 13 sekcji) lub kliencki (12 sekcji, bez komunikacji wewnetrznej)
  2. Uzytkownik widzi podglad raportu w przegladarce (markdown rendering) i moze edytowac wygenerowana tresc przed eksportem
  3. Uzytkownik moze skopiowac raport do schowka jednym klikiem, wyeksportowac do .docx (z formatowaniem) i do .pdf (z formatowaniem)
  4. Uzytkownik widzi historie wygenerowanych raportow z datami i statusami
**Plans**: Fast-tracked (zaimplementowane w jednym commicie 1f853d6, 2026-02-11)

Plans:
- [x] 05-01: Generowanie raportu z wynikow AI + migracja (reports tabela) + API routes (/api/reports, /api/reports/[id])
- [x] 05-02: Podglad raportu (markdown rendering), edycja sekcji, historia raportow — reports page + report detail page
- [ ] 05-03: Eksport — kopiowanie do schowka (DONE), .docx i .pdf (NOT IMPLEMENTED — known gap)

### Phase 6: Dashboard & Polish
**Goal**: Uzytkownik widzi na dashboardzie Analizatora Email kluczowe metryki, podsumowania i szybkie akcje
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard wyswietla kafelki KPI: sredni czas odpowiedzi, procent otwartych spraw, ogolny scoring komunikacji
  2. Dashboard pokazuje podsumowanie per skrzynka (liczba watkow, maili, ostatnia synchronizacja) i liste ostatnich raportow z datami/statusami
  3. Dashboard oferuje quick actions: generuj raport, odswiez skrzynke, dodaj nowa skrzynke
**Plans**: Fast-tracked (zaimplementowane w jednym commicie 1f853d6, 2026-02-11)

Plans:
- [x] 06-01: Dashboard Analizatora Email — KPI tiles, podsumowania per skrzynka, quick actions, ostatnie raporty

---

### Phase 2.2: Email Analyzer Quality (INSERTED)
**Goal**: Poprawa jakosci i uzytecznosci Email Analyzer na podstawie testow produkcyjnych — raporty syntetyczne zamiast 400+ stron, AI summary per watek, ulepszone UX analizy
**Depends on**: Phase 2.1
**Requirements**: Zebrane z testow produkcyjnych (24 uwagi)
**Success Criteria** (what must be TRUE):
  1. Kazdy watek ma AI-generowany opis (1-2 zdania) i poprawny status (open/closed_positive/closed_negative/pending)
  2. Strona analizy ma szybkie filtry dat (4 presety), spinner z ETA, opcjonalny dzwiek, historie analiz
  3. Domyslny raport syntetyczny ma ~5-15 stron (nie 400+) — AI agreguje wyniki z wielu watkow
  4. Raport szczegolowy (watek po watku) dostepny jako opcja
  5. Eksport DOCX ma unikalne nazwy plikow (typ_skrzynka_daty.docx)
  6. Kontrast czcionek WCAG AA, plynna nawigacja, prompt CRUD (dodaj/usun/kopiuj/kolejnosc), globalny prompt, checkboxy sekcji per typ raportu
**Plans:** 4 plans

Plans:
- [x] 02.2-01-PLAN.md — Thread Intelligence: AI summary per watek, ulepszone statusy, persisted mailbox selection
- [x] 02.2-02-PLAN.md — Analysis UX: date presets, spinner+ETA, dzwiek, historia analiz
- [x] 02.2-03-PLAN.md — Synthetic Reports: AI REDUCE, formatowanie, nazwy DOCX
- [x] 02.2-04-PLAN.md — UI/UX Polish: kontrast WCAG AA, nawigacja, prompt CRUD, podglad klucza API

### Phase 7: FB Foundation
**Goal**: Aplikacja ma kompletny fundament dla FB Analyzer — tabele DB, typy TS, nawigacja w sidebar, puste strony shell i wyekstrahowane utilities administracyjne
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: FBNAV-01, FBNAV-02, FBNAV-03, FBNAV-04, FBNAV-05, FBNAV-06
**Success Criteria** (what must be TRUE):
  1. Hub grid wyswietla karte "Analizator Grup FB" jako aktywne narzedzie (nie "Coming Soon") i klikniecie przenosi do modulu FB
  2. Sidebar FB Analyzer pokazuje nawigacje z children: Dashboard, Grupy, Posty, Analiza, Raporty, Ustawienia — kazda strona renderuje shell z placeholderem
  3. Wszystkie 6 tabel FB istnieje w Supabase z poprawnymi RLS policies (admin-only), indeksami i UNIQUE constraints (group_id + facebook_post_id na fb_posts)
  4. Typy TypeScript domeny FB (FbGroup, FbPost, FbComment, FbScrapeJob, FbAnalysisJob, FbReport) sa zdefiniowane i importowalne
  5. verifyAdmin() i getAdminClient() sa wyekstrahowane do shared module (src/lib/api/admin.ts) — nowe FB routes korzystaja z extracted utility

**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Migracja SQL (6 tabel FB + RLS + indeksy) + typy TypeScript domeny FB
- [x] 07-02-PLAN.md — Aktywacja fb-analyzer na hub + sidebar nawigacja + layout + 6 stron shell
- [x] 07-03-PLAN.md — Ekstrakcja verifyAdmin()/getAdminClient() do shared module + aktualizacja 21 API routes

### Phase 8: Group Management
**Goal**: Admin moze zarzadzac grupami FB (dodawac, edytowac, usuwac, wstrzymywac monitoring) i skonfigurowac polaczenie z Apify
**Depends on**: Phase 7
**Requirements**: FBGRP-01, FBGRP-02, FBGRP-03, FBGRP-04
**Success Criteria** (what must be TRUE):
  1. Admin moze dodac grupe FB podajac nazwe, URL Facebooka i dewelopera — grupa pojawia sie na liscie z metadanymi (deweloper, status, liczba postow: 0, ostatni scrape: nigdy)
  2. Admin moze edytowac grupe (zmiana nazwy, URL, dewelopera) i usunac grupe z potwierdzeniem
  3. Admin moze przelaczac status grupy (active/paused) — wstrzymane grupy sa wizualnie oznaczone i wykluczone z scrapowania
  4. Admin moze skonfigurowac Apify API token i Facebook session cookies — dane sa szyfrowane (AES-256-GCM) i przechowywane bezpiecznie w bazie

**Plans:** 4 plans

Plans:
- [x] 08-01-PLAN.md — Migracja SQL (ALTER TABLE fb_groups + CREATE TABLE fb_settings) + aktualizacja typow TS
- [x] 08-02-PLAN.md — API routes: fb-groups CRUD/bulk/developers + fb-settings (encrypted credentials)
- [x] 08-03-PLAN.md — UI strony grup: tabela z sekcjami per deweloper, modal CRUD, bulk upload, bulk actions
- [x] 08-04-PLAN.md — UI strony ustawien: Apify token, FB cookies, Actor ID (super admin), instrukcje AI

### Phase 9: Scraping Engine
**Goal**: Admin moze scrapowac posty z grup FB przez Apify Actor z widocznym progressem, ochrona konta i obsluga bledow
**Depends on**: Phase 8
**Requirements**: FBSCR-01, FBSCR-02, FBSCR-03, FBSCR-04, FBSCR-05, FBSCR-06, FBSCR-07
**Success Criteria** (what must be TRUE):
  1. Admin klika "Scrapuj" na aktywnej grupie — Apify Actor run startuje, progress bar pokazuje status (uruchamianie, scrapowanie, pobieranie wynikow, zakonczone) — posty pojawiaja sie w bazie danych
  2. Posty sa deduplikowane (upsert ON CONFLICT) — ponowne scrapowanie tej samej grupy aktualizuje istniejace posty (likes, komentarze) zamiast tworzyc duplikaty
  3. Scrapowanie wielu grup wymusza minimalny 3-minutowy odstep miedzy grupami z losowymi opoznieniami — UI informuje o kolejce i szacowanym czasie
  4. Bledy scrapowania (timeout, expired cookies, Apify error) sa logowane, wyswietlane w UI z opisem i sugestia rozwiazania, a system proponuje retry
  5. Przed scrapowaniem wykonywany jest cookie health check (testowy scrape maxPosts: 1) — jesli cookies wygasly, user widzi alert z instrukcja odswiezenia

**Plans:** 4 plans

Plans:
- [x] 09-01-PLAN.md — Backend foundation: Apify API wrapper (3 funkcje), post mapper z graceful fallbacks, typy TS scrape
- [x] 09-02-PLAN.md — API routes: POST /api/fb/scrape (start job), POST /api/fb/scrape/process (3-mode pipeline), GET /api/fb/scrape/status/[jobId]
- [x] 09-03-PLAN.md — Frontend: useScrapeJob hook z multi-group queue, ScrapeProgress/ScrapeButton komponenty, integracja z tabela grup
- [x] 09-04-PLAN.md — Gap closure: Pre-scrape cookie health check (testowy Apify run, status cookie_check, warning UI)

### Phase 10: AI Sentiment Analysis
**Goal**: Admin moze uruchomic analiza AI na scrapowanych postach — kazdy post otrzymuje sentyment, relevance score, kategorie i AI snippet w jednym wywolaniu AI
**Depends on**: Phase 9
**Requirements**: FBAI-01, FBAI-02, FBAI-03, FBAI-04, FBAI-05, FBAI-06
**Success Criteria** (what must be TRUE):
  1. Admin klika "Analizuj" na grupie — AI przetwarza posty batch-ami z progress bar (X/Y postow) — kazdy post otrzymuje sentyment (positive/negative/neutral), relevance score (0-10), AI snippet (1-2 zdania) i kategorie tematyczne
  2. Domyslny prompt AI szuka opinii mieszkancow dotyczacych administracji osiedla i dewelopera — rozpoznaje sarkazm, skargi ukryte w grzecznym jezyku i kolokwializmy polskie
  3. Admin moze edytowac prompt AI przez interfejs prompt editor (reuse z email-analyzer) — zmiany wplywaja na przyszle analizy
  4. Admin moze konfigurowac slowa kluczowe i tematy do monitorowania (per grupa lub globalnie) — posty pasujace do slow kluczowych maja podwyzszone relevance score
  5. Posty sa klasyfikowane do predefiniowanych kategorii: oplaty, naprawy, czystosc, bezpieczenstwo, zielen, komunikacja, finanse, prawo, sasiedzi, pochwaly, inne

Plans: TBD

### Phase 11: Post Browsing & Dashboard
**Goal**: Admin widzi TYLKO istotne (AI-flagowane) posty z filtrami i linkami do FB oraz dashboard z KPI i alertami o negatywnych postach
**Depends on**: Phase 10
**Requirements**: FBVIEW-01, FBVIEW-02, FBVIEW-03, FBVIEW-04
**Success Criteria** (what must be TRUE):
  1. Lista postow wyswietla WYLACZNIE istotne posty (AI-flagowane, relevance >= prog) z sentymentem, AI snippet i klikalnym linkiem do oryginalnego postu na Facebooku
  2. Admin moze filtrowac posty per deweloper, per grupa, sentyment (positive/negative/neutral), kategoria tematyczna i zakres dat — filtry dzialaja lacznie
  3. Dashboard pokazuje podsumowanie per deweloper: liczba monitorowanych grup, istotnych postow, procent negatywnych — z alertami o nowych negatywnych postach (relevance >= 7)
  4. Quick actions sa dostepne z dashboardu i listy postow: scrapuj grupe, uruchom analize, generuj raport — bez koniecznosci przechodzenia na osobne strony

Plans: TBD

### Phase 12: Reports & Export
**Goal**: Admin moze wygenerowac raport FB na zadanie z sekcjami per grupa, tabela postow z linkami i wyeksportowac do DOCX z klikalnymi linkami
**Depends on**: Phase 10 (analyzed posts), Phase 11 (for full flow, but technically independent)
**Requirements**: FBREP-01, FBREP-02, FBREP-03, FBREP-04, FBREP-05, FBREP-06
**Success Criteria** (what must be TRUE):
  1. Admin wybiera grupy (lub dewelopera) i zakres dat, klika "Generuj raport" — raport jest tworzony na zadanie (nie automatycznie po scrapowaniu)
  2. Raport zawiera sekcje per grupa z podsumowaniem AI (co dobre, co zle, rekomendacje) oraz tabele wpisow z kolumnami: grupa, data, tresc postu, sentyment, AI snippet, link do postu FB
  3. Admin moze edytowac prompty per sekcja raportu FB (reuse prompt editor z email-analyzer) — 7 sekcji: podsumowanie, sentyment, negatywne, pozytywne, kategorie, ryzyko PR, rekomendacje
  4. Eksport DOCX zawiera klikalne linki do postow na Facebooku, sformatowane tabele i sekcje — plik jest gotowy do wyslania klientowi-deweloperowi
  5. Admin widzi historie wygenerowanych raportow FB z datami i moze otworzyc dowolny wczesniejszy raport

Plans: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

### v1.0 Email Analyzer

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hub Shell & Fundament | 3/3 | **COMPLETE** | 2026-02-10 |
| 2. Email Connection & Fetching | 4/4 | **COMPLETE** | 2026-02-10 |
| 3. Email Threading & Browsing | 2/2 | **COMPLETE** (fast-track) | 2026-02-11 |
| 4. AI Analysis, Prompty & Kryteria Oceny | 4/4 | **COMPLETE** (fast-track, eval UI gap) | 2026-02-11 |
| 5. Report Generation & Export | 2/3 | **COMPLETE** (fast-track, .docx/.pdf gap) | 2026-02-11 |
| 6. Dashboard & Polish | 1/1 | **COMPLETE** (fast-track) | 2026-02-11 |
| 2.1. Multi-Folder Sync | 3/3 | **COMPLETE** (INSERTED) | 2026-02-15 |
| 2.2. Email Analyzer Quality | 4/4 | **COMPLETE** (INSERTED) | 2026-02-15 |

### v1.1 FB Analyzer

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. FB Foundation | 3/3 | **COMPLETE** | 2026-02-12 |
| 8. Group Management | 4/4 | **COMPLETE** | 2026-02-12 |
| 9. Scraping Engine | 4/4 | **COMPLETE** | 2026-02-23 |
| 10. AI Sentiment Analysis | 0/? | Pending | — |
| 11. Post Browsing & Dashboard | 0/? | Pending | — |
| 12. Reports & Export | 0/? | Pending | — |

## Known Gaps (v1.0)

Fazy 3-6 zostaly zaimplementowane w trybie fast-track (jeden commit 1f853d6 + poprawki 48582a0) zamiast indywidualnych planow. Ponizsze braki sa znane:

1. **Eksport .docx/.pdf** (Phase 5): Tylko kopiowanie do schowka (markdown). Eksport do .docx i .pdf nie zaimplementowany.
2. **Evaluation criteria UI** (Phase 4): Tabela evaluation_criteria istnieje w DB, ale brak UI do zarzadzania kryteriami oceny.
3. **Azure Admin Consent** (Phase 2): Czeka na administratora TAG Polska — wymagane do polaczenia z prawdziwymi skrzynkami Outlook.
4. **Reports API** (Phase 5): POST /api/reports oryginalnie wymagal analysisJobId — naprawione w 48582a0 (akceptuje tez mailboxId).

## Research Flags (v1.1)

Fazy wymagajace glebszego researchu przed implementacja:

1. **Phase 9 (Scraping Engine) — RESOLVED**: Research DONE (2026-02-23). Apify API v2, actor input/output, cookie format, polling architecture — wszystko zweryfikowane. Research: `.planning/phases/09-scraping-engine/09-RESEARCH.md`
2. **Phase 10 (AI Analysis) — MEDIUM**: Prompty AI dla polskiego real estate wymagaja iteracji. Few-shot examples, sarkazm, kolokwializmy. **Akcja:** Manual review pierwszych 20-30 analyzed posts, tune prompts jesli accuracy < 80%.
