# Roadmap: Lulkiewicz PR Hub

## Overview

Lulkiewicz PR Hub to wewnetrzna platforma narzędziowa dla agencji PR obslugujacej deweloperow nieruchomosci. MVP dostarcza jeden kluczowy modul -- Analizator Komunikacji Email -- ktory pobiera tysiace maili ze skrzynek Outlook administracji osiedli, grupuje je w watki, analizuje jakosc komunikacji za pomoca AI i generuje raporty (wewnetrzny + kliencki) z eksportem do .docx/.pdf/clipboard. Roadmapa prowadzi przez 6 sekwencyjnych faz: od fundamentu (auth, hub shell) przez pipeline emailowy (ingestion, threading) i analiza AI, az po raporty i dashboard.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Hub Shell & Fundament** - Auth, role, design system, grid narzedziowy, sidebar, responsywnosc
- [ ] **Phase 2: Email Connection & Fetching** - Podlaczenie skrzynek Outlook, bulk sync maili, parsowanie, baza danych
- [ ] **Phase 3: Email Threading & Browsing** - Grupowanie maili w watki, widok watkow, filtrowanie, zakres czasowy
- [ ] **Phase 4: AI Analysis, Prompty & Kryteria Oceny** - Analiza AI per watek, Map-Reduce pipeline, prompt management, custom scoring
- [ ] **Phase 5: Report Generation & Export** - Generowanie raportow (wew/kliencki), podglad, edycja, eksport docx/pdf/clipboard
- [ ] **Phase 6: Dashboard & Polish** - KPI tiles, podsumowania per skrzynka, quick actions, ostatnie raporty

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
**Plans**: TBD

Plans:
- [ ] 01-01: Scaffold Next.js + Supabase Auth (rejestracja, logowanie, sesja, protected routes)
- [ ] 01-02: System rol admin/user + panel admina (user management, tool access control)
- [ ] 01-03: Hub UI — grid narzedziowy, sidebar, Unified Design System, footer, responsywnosc

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
**Plans**: TBD

Plans:
- [ ] 02-01: Discovery call + architektura email (Graph API vs IMAP), migracja Supabase (mailboxes, emails, sync_jobs)
- [ ] 02-02: Konfiguracja skrzynki UI + bezpieczne przechowywanie credentials (AES-256) + test polaczenia
- [ ] 02-03: Bulk sync z paginacja (chunked job queue + polling) + progress bar + delta sync
- [ ] 02-04: Parsowanie naglowkow i tresci (charset detection, HTML to plaintext, polskie znaki)

### Phase 3: Email Threading & Browsing
**Goal**: Uzytkownik moze przegladac maile pogrupowane w watki (sprawy) z filtrowaniem i wyborem zakresu czasowego
**Depends on**: Phase 2
**Requirements**: THREAD-01, THREAD-02, THREAD-03, THREAD-04, THREAD-05
**Success Criteria** (what must be TRUE):
  1. Maile sa automatycznie pogrupowane w watki (In-Reply-To, References, Subject fallback lub Graph conversationId)
  2. Uzytkownik widzi liste watkow z liczba wiadomosci, datami, uczestnikami i moze wejsc w szczegoly watku (chronologiczny widok maili)
  3. Uzytkownik moze filtrowac watki po dacie, nadawcy, statusie (otwarty/zamkniety) i slowach kluczowych
  4. Uzytkownik moze wybrac zakres czasowy analizy (1-3 miesiace) z uwzglednieniem starszych otwartych spraw
**Plans**: TBD

Plans:
- [ ] 03-01: Algorytm threadingu + migracja (email_threads, processed_emails)
- [ ] 03-02: UI listy watkow, drill-down w watek, filtrowanie, wybor zakresu czasowego

### Phase 4: AI Analysis, Prompty & Kryteria Oceny
**Goal**: Uzytkownik moze uruchomic analiza AI na wybranych watkach, zdefiniowac wlasne kryteria oceny i zarzadzac promptami per sekcja raportu
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, EVAL-01, EVAL-02, EVAL-03, EVAL-04
**Success Criteria** (what must be TRUE):
  1. Uzytkownik moze uruchomic analiza AI i widziec progress bar z informacja o aktualnie przetwarzanym watku — analiza obejmuje jakosc komunikacji, czas reakcji, status spraw, dane kontaktowe, RODO i sugestie naprawcze
  2. Uzytkownik moze konfigurowac providera AI (OpenAI/Anthropic/Google), klucz API i model
  3. Uzytkownik moze edytowac prompty per sekcja raportu z podgladem side-by-side (domyslny vs edytowany), resetowac do domyslnego i korzystac z 3-tier resolution (kod/globalny/per-raport)
  4. Uzytkownik moze definiowac checklisty (tak/nie) i scoring rubrics (kryteria + wagi + skala) — AI ocenia kazdy punkt, wyniki widoczne z wizualnymi wskaznikami
  5. Analiza AI dziala na zasadzie Map-Reduce (per-watek analiza z agregacja) i miesci sie w limitach kontekstu LLM
**Plans**: TBD

Plans:
- [ ] 04-01: Konfiguracja AI (provider, klucz, model) + migracja (analysis_jobs, analysis_results, prompt_templates, evaluation_criteria)
- [ ] 04-02: Prompt management UI — 3-tier system, side-by-side, reset, edycja per sekcja
- [ ] 04-03: Custom evaluation criteria — checklisty, scoring rubrics, domyslny zestaw
- [ ] 04-04: Map-Reduce AI pipeline — analiza per watek, agregacja, progress bar, Structured Outputs

### Phase 5: Report Generation & Export
**Goal**: Uzytkownik moze wygenerowac raport (wewnetrzny lub kliencki), przejrzec go, edytowac i wyeksportowac do schowka, .docx lub .pdf
**Depends on**: Phase 4
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. Uzytkownik moze wygenerowac raport AI na podstawie wynikow analizy — wybierajac szablon wewnetrzny (pelny, 7 sekcji) lub kliencki (filtrowany)
  2. Uzytkownik widzi podglad raportu w przegladarce (markdown rendering) i moze edytowac wygenerowana tresc przed eksportem
  3. Uzytkownik moze skopiowac raport do schowka jednym klikiem, wyeksportowac do .docx (z formatowaniem) i do .pdf (z formatowaniem)
  4. Uzytkownik widzi historie wygenerowanych raportow z datami i statusami
**Plans**: TBD

Plans:
- [ ] 05-01: Generowanie raportu z wynikow AI + migracja (reports, report_sections) + 2 szablony (wewnetrzny/kliencki)
- [ ] 05-02: Podglad raportu (markdown rendering), edycja sekcji, historia raportow
- [ ] 05-03: Eksport — kopiowanie do schowka, .docx, .pdf

### Phase 6: Dashboard & Polish
**Goal**: Uzytkownik widzi na dashboardzie Analizatora Email kluczowe metryki, podsumowania i szybkie akcje
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard wyswietla kafelki KPI: sredni czas odpowiedzi, procent otwartych spraw, ogolny scoring komunikacji
  2. Dashboard pokazuje podsumowanie per skrzynka (liczba watkow, maili, ostatnia synchronizacja) i liste ostatnich raportow z datami/statusami
  3. Dashboard oferuje quick actions: generuj raport, odswiez skrzynke, dodaj nowa skrzynke
**Plans**: TBD

Plans:
- [ ] 06-01: Dashboard Analizatora Email — KPI tiles, podsumowania per skrzynka, quick actions, ostatnie raporty

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hub Shell & Fundament | 0/3 | Not started | - |
| 2. Email Connection & Fetching | 0/4 | Not started | - |
| 3. Email Threading & Browsing | 0/2 | Not started | - |
| 4. AI Analysis, Prompty & Kryteria Oceny | 0/4 | Not started | - |
| 5. Report Generation & Export | 0/3 | Not started | - |
| 6. Dashboard & Polish | 0/1 | Not started | - |
