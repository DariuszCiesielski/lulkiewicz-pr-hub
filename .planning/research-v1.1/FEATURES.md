# Feature Landscape: Analizator Grup FB

**Domena:** Monitoring grup Facebook osiedli mieszkaniowych + analiza sentymentu dla agencji PR
**Badanie:** 2026-02-12
**Pewnosc:** MEDIUM (bazuje na wiedzy treningowej o narzędziach social listening + analiza istniejącego kodu v1.0; WebSearch/WebFetch niedostępne — nie zweryfikowano z bieżącymi źródłami)

---

## Table Stakes (must-have)

Funkcje, których brak sprawia, ze narzędzie jest bezużyteczne dla agencji PR monitorującej osiedla.

| # | Funkcja | Dlaczego wymagana | Złożoność | Zależność od istniejących | Notatki |
|---|---------|-------------------|-----------|--------------------------|---------|
| TS-1 | **CRUD grup FB** | Admin musi zarządzać listą monitorowanych grup (dodawanie URL, edycja nazwy, dezaktywacja) | Niska | Wzorzec: mailboxes CRUD | Jedna grupa = jedno osiedle |
| TS-2 | **Scrapowanie postów + komentarzy** | Bez danych nie ma czego analizować — cały pipeline zaczyna się od scrapowania | Średnia | Reuse: useSyncJob pattern, polling, encrypt.ts (Apify token) | Apify Actor `curious_coder/facebook-post-scraper`; upsert by facebook_post_id |
| TS-3 | **Deduplikacja postów** | Powtórne scrapowanie nie może tworzyć duplikatów — identycznie jak z emailami | Niska | Wzorzec: upsert ON CONFLICT (group_id, facebook_post_id) z email sync | Kluczowe przy delta scrape |
| TS-4 | **Analiza sentymentu AI (pozytywny/negatywny/neutralny)** | Core value proposition — automatyczna klasyfikacja tonu postów | Średnia | Reuse: callAI(), loadAIConfig(), ai-provider.ts | Prompt per post (nie per wątek jak w email-analyzer); output: sentiment enum + confidence score |
| TS-5 | **Ocena istotności (relevance score)** | Nie każdy post dotyczy administracji — trzeba odfiltrować szum (sprzedaż mieszkań, polecenia firm, pytania o okolicę) | Średnia | Reuse: callAI() | Skala 0-10; filtr "dotyczy administracji/zarządcy" vs "szum" |
| TS-6 | **Kategoryzacja tematyczna** | PR-owiec musi wiedzieć CZY to skarga na opłaty, awaria windy, czy pochwała ochrony | Średnia | Część promptu AI razem z TS-4 i TS-5 | Predefiniowane kategorie + opcja "inne" |
| TS-7 | **Lista postów z filtrami** | Przeglądanie scrapowanych postów z możliwością filtrowania po sentymencie, relevance, kategorii, dacie | Średnia | Wzorzec: ThreadList + ThreadFilters z email-analyzer | Filtry: grupa, sentyment, relevance >= X, kategoria, zakres dat |
| TS-8 | **Szczegóły postu z komentarzami** | Drill-down w konkretny post — pełna treść + komentarze z ich sentymentem | Niska | Wzorzec: thread drill-down z email-analyzer | Komentarze też powinny mieć sentyment |
| TS-9 | **Dashboard z KPI** | Szybki przegląd stanu: ile postów, ile negatywnych, trendy | Średnia | Wzorzec: email-analyzer dashboard (KPI tiles + quick actions) | KPI: total postów, negatywne/pozytywne/neutralne, top kategorie |
| TS-10 | **Alerty o negatywnych postach** | PR-owiec musi szybko reagować na negatywne wzmianki z wysokim relevance — to jest powód istnienia narzędzia | Średnia | Dashboard + filtrowanie | Lista "wymagające uwagi" = negatywne + relevance >= 7 |
| TS-11 | **Raport zbiorczy per grupa** | Wynik pracy — dokument do przekazania deweloperowi: "co mieszkańcy myślą o zarządzaniu" | Średnia | Reuse: report generation pattern, report_sections, DOCX export | Sekcje inne niż email-analyzer (patrz TS-14) |
| TS-12 | **Eksport DOCX** | Raport musi być w formacie, który deweloper może wydrukować/przesłać dalej | Niska | Reuse: markdown-to-docx.ts, export-report-docx.ts — już zaimplementowane w v1.0 | Minimalne dostosowania |
| TS-13 | **Konfiguracja Apify (settings)** | Admin musi podać Apify API token, wybrać Actor, ustawić parametry scrapowania | Niska | Wzorzec: AI Settings z email-analyzer (szyfrowany klucz) | Token szyfrowany AES-256-GCM |
| TS-14 | **Sekcje raportu FB (dedykowane prompty)** | Raport FB potrzebuje innych sekcji niż email-analyzer | Średnia | Reuse: prompt_templates pattern, ale nowe sekcje | Patrz "Rekomendowane sekcje raportu" poniżej |

### Rekomendowane sekcje raportu FB (TS-14 szczegóły)

W odróżnieniu od email-analyzer (7 sekcji o jakości komunikacji), raport FB powinien mieć sekcje dopasowane do monitoringu social media:

| # | Klucz sekcji | Tytuł | Opis |
|---|-------------|-------|------|
| 1 | `fb_summary` | Podsumowanie ogólne | Przegląd aktywności w grupie, główne tematy, ton dyskusji |
| 2 | `fb_sentiment_overview` | Analiza sentymentu | Rozkład pozytywne/negatywne/neutralne, trendy w czasie |
| 3 | `fb_negative_highlights` | Uwagi negatywne | Najważniejsze skargi i problemy zgłaszane przez mieszkańców |
| 4 | `fb_positive_highlights` | Uwagi pozytywne | Pochwały i pozytywne opinie o zarządzaniu |
| 5 | `fb_categories` | Analiza tematyczna | Rozkład kategorii (opłaty, naprawy, bezpieczeństwo, czystość, etc.) |
| 6 | `fb_risk_assessment` | Ocena ryzyka PR | Posty mogące eskalować — wymagające interwencji |
| 7 | `fb_recommendations` | Rekomendacje | Konkretne kroki dla administracji na podstawie feedbacku mieszkańców |

---

## Differentiators (przewagi konkurencyjne)

Funkcje, które wyróżniają narzędzie. Nie są oczekiwane, ale dają realną wartość.

| # | Funkcja | Wartość | Złożoność | Notatki |
|---|---------|---------|-----------|---------|
| D-1 | **AI snippet (streszczenie postu)** | Zamiast czytać pełny post (często długi, emocjonalny), admin widzi 1-2 zdania streszczenia | Niska | Generowany razem z sentymentem w jednym wywołaniu AI — dodatkowy koszt minimalny |
| D-2 | **Analiza komentarzy (nie tylko postów)** | Komentarze często zawierają więcej informacji niż sam post — "ja też mam ten problem" | Średnia | Osobna analiza sentymentu komentarzy; agregacja: "post negatywny + 12 komentarzy potwierdzających = eskalacja" |
| D-3 | **Trend sentymentu w czasie** | Wykres: czy sytuacja się poprawia czy pogarsza z miesiąca na miesiąc | Średnia | Wymaga >= 2 scrapowań w różnych terminach; prosty line chart (nie potrzeba biblioteki — CSS/SVG) |
| D-4 | **Porównanie grup (cross-group)** | Deweloper ma 5 osiedli — "które osiedle ma najgorzej?" | Średnia | Dashboard-level: ranking grup po % negatywnych postów |
| D-5 | **Automatyczne tagowanie "eskalacji"** | AI rozpoznaje posty, które mogą trafić do mediów / rady mieszkańców | Średnia | Dodatkowe pole `is_escalation_risk: boolean` w analizie AI; trigger: silnie negatywne + dużo reakcji/komentarzy |
| D-6 | **Raport porównawczy (okres vs okres)** | "Luty vs Styczeń: o 30% mniej skarg na opłaty" | Wysoka | Wymaga dwóch ukończonych analiz dla tego samego okresu; logika diff |
| D-7 | **Eksport alertów email/Telegram** | Natychmiastowe powiadomienie gdy pojawi się post eskalacyjny | Średnia | Obecny workflow N8N robi to przez Telegram — naturalny upgrade; ale wymaga infrastruktury (webhook, cron) |
| D-8 | **Edytowalne prompty AI (per sekcja)** | Admin może dostosować, co AI analizuje — tak jak w email-analyzer | Niska | Reuse: prompt_templates UI z email-analyzer — prawie identyczny pattern |
| D-9 | **Heatmapa aktywności** | Kiedy mieszkańcy najczęściej piszą (dzień tygodnia, godzina) — informacja dla zarządcy | Niska | Agregacja posted_at po dayOfWeek + hour; prosta wizualizacja grid |
| D-10 | **Kontekst reakcji (likes/comments/shares)** | Post z 50 lajkami jest ważniejszy niż post z 0 — waga w analizie | Niska | Apify zwraca likes/comments/shares; włączyć jako czynnik w relevance scoring |

---

## Anti-Features (NIE budować)

Funkcje, które są kuszące, ale prowadzą do problemów lub nie dają wartości w tym kontekście.

| # | Anti-Feature | Dlaczego unikać | Co zrobić zamiast tego |
|---|-------------|-----------------|----------------------|
| AF-1 | **Scraping w real-time (webhook/cron)** | Vercel ma maxDuration=60s i brak persistent cron; Apify runs trwają minuty; dodaje złożoność infrastrukturalną bez proporcjonalnej wartości | Manual trigger "Scrapuj teraz" + polling (identycznie jak email sync). Admin i tak sprawdza narzędzie raz dziennie/tygodniowo. |
| AF-2 | **Własny scraper FB (bez Apify)** | Facebook aktywnie blokuje scrapery; maintainowanie własnego to niekończąca się walka z rate limitami i zmianami DOM | Apify Actor — oni utrzymują scraper, my konsumujemy dane |
| AF-3 | **Odpowiadanie na posty z narzędzia** | Wymaga Facebook API / Graph API z uprawnieniami do publikacji; compliance nightmare; RODO | Narzędzie to MONITORING, nie ZARZĄDZANIE — admin reaguje manualnie na FB |
| AF-4 | **Analiza profili autorów** | Tworzenie profili mieszkańców ("Jan Kowalski — 5 skarg, 0 pochwał") narusza RODO i tworzy ryzyko prawne | Anonimizacja autorów; agreguj po tematach, nie po osobach |
| AF-5 | **Wieloplatformowy monitoring (Twitter, Google Reviews)** | Rozproszenie zakresu; grupy FB osiedli to 95% aktywności mieszkańców — reszta to margines | Focus na FB; inne platformy jako osobne narzędzia w Hub (Social Media Manager jest już w roadmap) |
| AF-6 | **Dashboard z wykresami real-time** | Dane zmieniają się raz na scraping (raz dziennie/tygodniowo); real-time charts to overengineering | Static KPI tiles odświeżane przy ładowaniu strony (wzorzec z email-analyzer dashboard) |
| AF-7 | **Tłumaczenie postów** | Grupy osiedli polskich — 99.9% postów po polsku | Jeśli kiedyś potrzeba — GPT tłumaczy w locie, nie potrzeba dedykowanej feature |
| AF-8 | **Wykrywanie botów/fake accounts** | Grupy osiedlowe są zamknięte, zweryfikowane — boty to marginalny problem | Nie budować; jeśli się pojawi — flaguj manualnie |
| AF-9 | **Bulk actions na postach** | "Zaznacz 50 postów i zmień sentyment" — sugeruje manual override AI, co podważa zaufanie do systemu | Jeśli AI się myli — popraw prompty (D-8), nie ręcznie nadpisuj wyniki |
| AF-10 | **Integracja z CRM/ticketing** | Over-scope; to narzędzie monitoringowe, nie system zgłoszeniowy | Eksport DOCX/raport wystarczy do przekazania informacji |

---

## Feature Dependencies

```
TS-1 (CRUD grup)
  |
  v
TS-13 (Konfiguracja Apify) --> TS-2 (Scrapowanie) --> TS-3 (Deduplikacja)
                                    |
                                    v
                            TS-4 (Sentyment AI) + TS-5 (Relevance) + TS-6 (Kategorie)
                                    |
                                    +-- D-1 (AI snippet)
                                    +-- D-2 (Analiza komentarzy)
                                    +-- D-5 (Eskalacja)
                                    +-- D-10 (Kontekst reakcji)
                                    |
                                    v
                            TS-7 (Lista z filtrami) + TS-8 (Drill-down)
                                    |
                                    v
                            TS-10 (Alerty negatywne) --> TS-9 (Dashboard KPI)
                                    |                       |
                                    |                       +-- D-3 (Trend sentymentu)
                                    |                       +-- D-4 (Porównanie grup)
                                    |                       +-- D-9 (Heatmapa)
                                    v
                            TS-11 (Raport) + TS-14 (Sekcje raportu)
                                    |
                                    v
                            TS-12 (Eksport DOCX) + D-8 (Edytowalne prompty)
                                    |
                                    +-- D-6 (Raport porównawczy) [post-MVP]
                                    +-- D-7 (Powiadomienia) [post-MVP]
```

---

## Predefiniowane kategorie postów (TS-6)

Na podstawie typowej tematyki grup osiedli mieszkaniowych:

| Kategoria | Opis | Przykłady |
|-----------|------|-----------|
| `oplaty` | Opłaty, czynsz, rozliczenia | "Dlaczego czynsz wzrósł o 200 zł?" |
| `naprawy` | Naprawy, konserwacja, usterki | "Winda nie działa od tygodnia" |
| `czystosc` | Czystość, porządek, sprzątanie | "Klatka schodowa jest brudna" |
| `bezpieczenstwo` | Ochrona, monitoring, zamki | "Brama garażowa nie zamyka się" |
| `zielen` | Zieleń, plac zabaw, otoczenie | "Kto skosił trawnik?" |
| `komunikacja` | Jakość komunikacji administracji | "Nikt nie odpowiada na maile" |
| `finanse` | Fundusz remontowy, rozliczenia | "Gdzie jest sprawozdanie finansowe?" |
| `prawo` | Regulamin, uchwały, głosowania | "Czy wspólnota może zakazać grillowania?" |
| `sasiedzi` | Konflikty sąsiedzkie | "Sąsiad z góry zalewa mnie regularnie" |
| `pochwaly` | Pozytywne opinie | "Nowy administrator jest świetny" |
| `inne` | Nie pasuje do żadnej kategorii | Fallback |

AI powinno przypisywać 1-3 kategorie per post (tablica `ai_categories[]` w `fb_posts`).

---

## Struktura analizy AI per post (TS-4 + TS-5 + TS-6 + D-1)

Rekomendowany format odpowiedzi AI (structured JSON output):

```json
{
  "sentiment": "negative",
  "sentiment_confidence": 0.92,
  "relevance_score": 8,
  "relevance_reasoning": "Post bezpośrednio krytykuje reakcję administracji na awarię",
  "categories": ["naprawy", "komunikacja"],
  "snippet": "Mieszkaniec skarży się na brak reakcji administracji na awarię ogrzewania trwającą 3 dni.",
  "is_escalation_risk": true,
  "escalation_reasoning": "Duża liczba komentarzy potwierdzających + groźba zgłoszenia do nadzoru budowlanego"
}
```

To pozwala na jedno wywołanie AI per post zamiast wielu osobnych (oszczędność tokenów i czasu).

---

## Rekomendacja MVP

### Faza 1 (Fundament): TS-1, TS-13
- CRUD grup + konfiguracja Apify + migracje DB + typy

### Faza 2 (Scrapowanie): TS-2, TS-3
- Integracja Apify Actor + upsert + progress

### Faza 3 (Przeglądanie): TS-7, TS-8
- Lista postów z filtrami + drill-down (BEZ AI — surowe dane)

### Faza 4 (Analiza AI): TS-4, TS-5, TS-6, D-1, D-10
- Sentyment + relevance + kategorie + snippet + waga reakcji
- Jedno wywołanie AI per post (structured JSON output)

### Faza 5 (Dashboard + Alerty): TS-9, TS-10, D-4
- KPI tiles + lista "wymagające uwagi" + porównanie grup

### Faza 6 (Raportowanie): TS-11, TS-12, TS-14, D-8
- Generowanie raportu + DOCX + edytowalne prompty

### Defer do post-MVP:
- **D-2** (analiza komentarzy): Dodaje złożoność — MVP analizuje tylko posty, komentarze jako kontekst
- **D-3** (trend sentymentu): Wymaga danych historycznych — naturalnie pojawi się po kilku tygodniach użytkowania
- **D-5** (auto-eskalacja): Można dodać do D-1 w fazie 4, ale jako osobna flaga w UI — post-MVP
- **D-6** (raport porównawczy): Wymaga dwóch analiz — post-MVP
- **D-7** (powiadomienia email/Telegram): Wymaga infrastruktury cron/webhook — post-MVP
- **D-9** (heatmapa aktywności): Nice-to-have, niska priorytet

---

## Porównanie z istniejącymi narzędziami rynkowymi

**Uwaga:** Oparte na wiedzy treningowej (LOW confidence). Nie zweryfikowane z bieżącymi źródłami.

| Narzędzie | Co robi | Czego NIE ma (co my mamy) |
|-----------|---------|--------------------------|
| **Brand24** | Social listening: wzmianki marki, sentyment, źródła | Nie monitoruje zamkniętych grup FB; ogólny — nie dla administracji osiedli |
| **SentiOne** | Monitoring mediów społecznościowych, NLP po polsku | Drogie; enterprise — nie dopasowane do niszowego use case |
| **Mention** | Monitoring wzmianek w social media | Brak fokusa na grupy FB osiedli; brak raportów dla zarządców |
| **Hootsuite** | Zarządzanie social media + basic listening | To narzędzie DO PUBLIKACJI, nie monitoring zamkniętych grup |
| **N8N + Apify + Airtable** (obecny workflow) | Scraping + basic kwalifikacja leadów | Brak sentymentu, brak raportów, brak dashboardu, brak historii |

**Nasza przewaga:** Niszowe narzędzie dopasowane do JEDNEGO use case (monitoring osiedli) z raportami dedykowanymi dla deweloperów. Generaliści (Brand24, Hootsuite) nie adresują tego segmentu.

---

## Mapowanie na istniejący kod v1.0

| Nowa feature | Reuse z v1.0 | Co jest nowe |
|-------------|-------------|-------------|
| CRUD grup | mailboxes CRUD pattern | Inne pola (facebook_url zamiast email_address) |
| Scrapowanie | useSyncJob hook, polling pattern | apify-client.ts (nowy), inne API Apify vs Graph API |
| Analiza AI | callAI(), loadAIConfig() | Nowe prompty (sentyment vs 7 sekcji); JSON output vs markdown |
| Dashboard | KPI tiles, quick actions pattern | Inne metryki (sentyment vs response time) |
| Raporty | report generation + DOCX export | Nowe sekcje raportu (fb_ prefixed) |
| Filtrowanie | ThreadFilters pattern | Więcej filtrów (sentyment, relevance, kategorie) |

---

## Kluczowe różnice vs Email Analyzer

| Aspekt | Email Analyzer | FB Analyzer |
|--------|---------------|-------------|
| **Jednostka analizy** | Wątek (grupa emaili) | Pojedynczy post |
| **Sekcje AI** | 7 sekcji per wątek (markdown) | 1 wywołanie per post (structured JSON) |
| **Raport** | MAP-REDUCE (per thread -> aggregate) | Aggregate stats + AI narrative |
| **Anonimizacja** | Tak (RODO — dane osobowe w emailach) | Nie konieczna (posty publiczne w grupie) |
| **Dane źródłowe** | Microsoft Graph API (OAuth) | Apify Actor (API key) |
| **Częstotliwość** | Jednorazowa analiza skrzynki | Cykliczny monitoring (co tydzień/miesiąc) |
| **Output klienta** | Raport jakości komunikacji | Raport nastrojów mieszkańców |

---

## Źródła

- Analiza istniejącego kodu v1.0 (email-analyzer): `src/lib/ai/`, `src/app/api/analysis/`, `src/app/api/reports/`
- Plan architektoniczny: `C:\Users\dariu\.claude\plans\lexical-marinating-blossom.md`
- Handoff doc: `docs/HANDOFF-2026-02-12.md`
- STATE.md: `.planning/STATE.md`
- Wiedza treningowa o narzędziach social listening (Brand24, SentiOne, Mention) — LOW confidence, niezweryfikowane
- Wiedza treningowa o Apify Actor API — MEDIUM confidence (API stabilne od lat, ale szczegóły actora niezweryfikowane)
