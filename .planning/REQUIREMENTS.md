# Requirements: Lulkiewicz PR Hub

**Defined:** 2026-02-10
**Core Value:** Hub narzędziowy — AI analizuje maile i posty z grup FB dla audytu komunikacji administracji osiedli

## v1.0 Requirements (Email Analyzer) — COMPLETE

Phases 1-6 complete. See ROADMAP.md for details.

### Hub Shell (Phase 1) — Complete
- [x] **HUB-01** through **HUB-10**: Auth, roles, design system, grid, sidebar, responsive

### Email Connection & Fetching (Phase 2) — Complete
- [x] **MAIL-01** through **MAIL-05**: Mailbox CRUD, test connection, credentials encryption
- [x] **FETCH-01** through **FETCH-07**: Bulk sync, pagination, progress, delta sync, parsing

### Email Threading (Phase 3) — Complete
- [x] **THREAD-01** through **THREAD-05**: Threading, thread view, filters, date range

### AI Analysis & Prompts (Phase 4) — Complete
- [x] **AI-01** through **AI-10**: AI analysis, Map-Reduce, config, anonymization
- [x] **PROMPT-01** through **PROMPT-05**: Editable prompts, 3-tier resolution
- [ ] **EVAL-01** through **EVAL-04**: Evaluation criteria (DB exists, UI not built — known gap)

### Reports & Export (Phase 5) — Complete
- [x] **REPORT-01** through **REPORT-06**: Report generation, templates, preview, edit, history
- [x] **EXPORT-01**: Clipboard copy
- [x] **EXPORT-02**: DOCX export
- [ ] **EXPORT-03**: PDF export (deferred — known gap)

### Dashboard (Phase 6) — Complete
- [x] **DASH-01** through **DASH-04**: KPI tiles, per-mailbox summary, quick actions, recent reports

---

## v1.1 Requirements (FB Analyzer)

Requirements for milestone v1.1. Each maps to roadmap phases 7+.

### Fundament & Nawigacja

- [x] **FBNAV-01**: ToolId `fb-analyzer` aktywny na hub grid (zastępuje Coming Soon)
- [x] **FBNAV-02**: Sidebar nawigacja FB Analyzer z children (Dashboard, Grupy, Posty, Analiza, Raporty, Ustawienia)
- [x] **FBNAV-03**: Layout FB Analyzer + strony shell
- [x] **FBNAV-04**: Migracja Supabase: tabele fb_groups, fb_posts, fb_comments, fb_scrape_jobs, fb_analysis_jobs, fb_reports + RLS admin-only + indeksy
- [x] **FBNAV-05**: Typy TypeScript domeny FB (FbGroup, FbPost, FbComment, FbScrapeJob, FbAnalysisJob, FbReport)
- [x] **FBNAV-06**: Ekstrakcja verifyAdmin()/getAdminClient() do shared module (src/lib/api/admin.ts)

### Zarządzanie Grupami FB

- [ ] **FBGRP-01**: CRUD grup FB z polem deweloper (grupowanie) + URL Facebooka
- [ ] **FBGRP-02**: Status grupy (active/paused) — wstrzymanie monitoringu
- [ ] **FBGRP-03**: Lista grup z metadanymi (deweloper, ostatni scrape, liczba postów, status)
- [ ] **FBGRP-04**: Konfiguracja Apify: token API (szyfrowany AES-256) + Facebook session cookies

### Scrapowanie Postów

- [ ] **FBSCR-01**: Trigger scrapowania per grupa przez Apify Actor API (natywny fetch, bez apify-client)
- [ ] **FBSCR-02**: Dwufazowa architektura: start Apify run → poll status co 5s → fetch wyników (mieści się w Vercel 60s)
- [ ] **FBSCR-03**: useScrapeJob hook z progress bar (wzorzec useSyncJob)
- [ ] **FBSCR-04**: Upsert postów z deduplikacją ON CONFLICT (group_id, facebook_post_id)
- [ ] **FBSCR-05**: Rate limiting między grupami (min. 3 min przerwy, losowe opóźnienia)
- [ ] **FBSCR-06**: Error handling: logowanie błędów, retry, informacja w UI o statusie
- [ ] **FBSCR-07**: Ochrona konta FB: dedykowane konto, Apify Proxy, losowe opóźnienia, limit dzienny scrapowań, cookie health check przed scrapowaniem

### Analiza AI

- [ ] **FBAI-01**: Kwalifikacja per post: istotny/nieistotny + sentyment (positive/negative/neutral) + kategoria + AI snippet — 1 wywołanie AI, structured JSON
- [ ] **FBAI-02**: Domyślny prompt AI: "szukaj opinii mieszkańców dotyczących administracji osiedla i dewelopera"
- [ ] **FBAI-03**: Edytowalny prompt przez admina (reuse prompt_templates z email-analyzer)
- [ ] **FBAI-04**: Konfigurowalne słowa kluczowe / tematy do monitorowania (per grupa lub globalnie)
- [ ] **FBAI-05**: Batch processing z useFbAnalysisJob hook + progress bar
- [ ] **FBAI-06**: Predefiniowane kategorie: opłaty, naprawy, czystość, bezpieczeństwo, zieleń, komunikacja, finanse, prawo, sąsiedzi, pochwały, inne

### Widok Istotnych Postów

- [ ] **FBVIEW-01**: Lista TYLKO istotnych postów (AI-flagowanych) z sentymentem, snippet, **linkiem do postu na FB**
- [ ] **FBVIEW-02**: Filtrowanie: per deweloper, per grupa, sentyment, kategoria, zakres dat
- [ ] **FBVIEW-03**: Podsumowanie per deweloper: liczba monitorowanych grup, istotnych postów, % negatywnych
- [ ] **FBVIEW-04**: Quick actions: scrapuj grupę, uruchom analizę, generuj raport

### Raportowanie

- [ ] **FBREP-01**: Raport na żądanie: user wybiera grupy/dewelopera + zakres dat → generuj
- [ ] **FBREP-02**: Format raportu: sekcje per grupa + podsumowanie AI (co dobre, co złe, rekomendacje)
- [ ] **FBREP-03**: Tabela wpisów w raporcie: grupa, data, treść postu, sentyment, snippet AI, **link do postu FB**
- [ ] **FBREP-04**: Edytowalne prompty per sekcja raportu (reuse prompt editor)
- [ ] **FBREP-05**: Eksport DOCX z klikalnymi linkami do postów FB
- [ ] **FBREP-06**: Historia raportów z datami

---

## v2+ Requirements (deferred)

### FB Analyzer rozszerzenia
- **FBEXT-01**: Analiza komentarzy (osobny sentyment per komentarz, agregacja)
- **FBEXT-02**: Trend sentymentu w czasie (wykres: miesiąc vs miesiąc)
- **FBEXT-03**: Auto-tagowanie eskalacji (flaga + alert)
- **FBEXT-04**: Raport porównawczy okres vs okres
- **FBEXT-05**: Powiadomienia email/Telegram o negatywnych postach
- **FBEXT-06**: Heatmapa aktywności (dzień/godzina)
- **FBEXT-07**: Automatyczny scraping (cron)

### Email Analyzer rozszerzenia
- **SYNC-01** through **SYNC-03**: Auto-sync, powiadomienia
- **ANLYT-01** through **ANLYT-03**: Trendy, porównania, benchmarking
- **GMAIL-01** through **GMAIL-02**: Gmail support

### Pozostałe narzędzia hubu
- **TOOL-01** through **TOOL-05**: Narzędzia 3-6 (do ustalenia)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Odpowiadanie na posty/komentarze FB | Read-only monitoring, user reaguje manualnie na FB |
| Publikowanie treści w grupach FB | Narzędzie monitoringowe, nie do zarządzania social media |
| Przeglądanie WSZYSTKICH postów | User widzi tylko istotne (AI-flagowane) posty |
| Real-time scraping (cron/webhook) | Manual trigger, admin sprawdza raz dziennie/tygodniowo |
| Profilowanie autorów (kto pisał ile) | RODO — nie budujemy profili mieszkańców |
| Własny scraper FB (bez Apify) | Facebook blokuje — Apify utrzymuje scraper |
| Multi-platform (Twitter, Google Reviews) | Focus na FB, inne platformy = osobne narzędzia |
| Odpowiadanie na maile (email-analyzer) | Tylko analiza read-only |
| Multi-tenancy | Jedna instancja dla Lulkiewicz PR |
| Mobile app | Web-first, responsive |
| Wielojęzyczność | Tylko PL |

## Traceability

### v1.0 (Phases 1-6) — Complete

| Requirement | Phase | Status |
|-------------|-------|--------|
| HUB-01..10 | Phase 1 | Complete |
| MAIL-01..05 | Phase 2 | Complete |
| FETCH-01..07 | Phase 2 | Complete |
| THREAD-01..05 | Phase 3 | Complete |
| AI-01..10 | Phase 4 | Complete |
| EVAL-01..04 | Phase 4 | Partial (DB only) |
| PROMPT-01..05 | Phase 4 | Complete |
| REPORT-01..06 | Phase 5 | Complete |
| EXPORT-01..02 | Phase 5 | Complete |
| EXPORT-03 | Phase 5 | Deferred |
| DASH-01..04 | Phase 6 | Complete |

### v1.1 (Phases 7-12) — Pending

| Requirement | Phase | Status |
|-------------|-------|--------|
| FBNAV-01..06 | Phase 7 (FB Foundation) | **Complete** |
| FBGRP-01..04 | Phase 8 (Group Management) | Pending |
| FBSCR-01..07 | Phase 9 (Scraping Engine) | Pending |
| FBAI-01..06 | Phase 10 (AI Sentiment Analysis) | Pending |
| FBVIEW-01..04 | Phase 11 (Post Browsing & Dashboard) | Pending |
| FBREP-01..06 | Phase 12 (Reports & Export) | Pending |

**Coverage:**
- v1.0 requirements: 59 total (56 complete, 3 deferred/partial)
- v1.1 requirements: 33 total (all mapped to phases 7-12)
- Mapped to phases: v1.0 all mapped, v1.1 all mapped

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-12 after v1.1 roadmap creation (phases 7-12 mapped)*
