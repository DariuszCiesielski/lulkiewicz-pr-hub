# Feature Landscape

**Domain:** Analizator Komunikacji Email -- narzedzie wewnetrzne agencji PR do audytu jakosci korespondencji administracji osiedli z mieszkancami
**Researched:** 2026-02-10
**Confidence:** MEDIUM-HIGH (bazowane na analizie narzedzi EmailAnalytics, EmailMeter, Email Audit Engine, MaestroQA, oraz wzorcow z domeny property management i customer service QA)

---

## Kontekst domenowy

To NIE jest standardowe narzedzie email marketing analytics (EmailAnalytics, EmailMeter) ani e-discovery platform (Relativity). To niszowe narzedzie wewnetrzne laczace:
- **Email fetching** -- sciaganie maili ze skrzynek Outlook administracji osiedli
- **AI content analysis** -- ocena jakosci komunikacji wedlug kryteriow PR
- **Report generation** -- raporty dla zespolu PR i klienta (dewelopera)

Najblizsze analogie: QA scorecard tools (MaestroQA, Zendesk QA) + email analytics (EmailAnalytics) + custom AI report generator. Zadne z istniejacych narzedzi nie pokrywa tego use case bezposrednio -- stad wartosc budowania wlasnego.

---

## 1. Table Stakes

Funkcje, bez ktorych narzedzie jest nieuzywalne. Brak = uzytkownicy nie moga wykonywac pracy.

### 1.1 Email Fetching & Mailbox Management

| Feature | Dlaczego wymagane | Zlozonosc | Uwagi |
|---------|-------------------|-----------|-------|
| Konfiguracja polaczenia ze skrzynka (login/haslo lub OAuth) | Bez tego zero danych | Medium | MS Graph API (O365) lub IMAP (on-premise). Priorytet: ustalenie typu skrzynki z adminem |
| Jednorazowe pobranie maili (bulk fetch) | Core flow -- potrzebne tysiace maili do analizy | High | Paginacja obowiazkowa (Vercel 60s timeout). Batche po 50-100 maili. Progress indicator |
| Parsowanie naglowkow: nadawca, odbiorca, data, temat | Podstawa do threadingu i analizy | Low | RFC 822 Message-ID, In-Reply-To, References. Biblioteka: mailparser |
| Parsowanie body: tekst + HTML | Tresc do analizy AI | Medium | Stripping HTML tags, obsluga multipart MIME, encoding (UTF-8, ISO-8859-2 dla PL) |
| Filtrowanie po zakresie czasowym | Uzytkownik wybiera okres analizy (1-3 mies.) | Low | Date range picker. Plus: uwzglednianie starszych otwartych spraw |
| Przechowywanie maili w bazie (Supabase) | Nie sciagac tych samych maili ponownie | Medium | Deduplikacja po Message-ID. Indeksy na date, mailbox_id |
| Obsluga wielu skrzynek (3 skrzynki) | Klient ma 3 skrzynki administracji | Low | Lista skrzynek, kazda z wlasnym polaczeniem |

### 1.2 Thread/Conversation Grouping

| Feature | Dlaczego wymagane | Zlozonosc | Uwagi |
|---------|-------------------|-----------|-------|
| Threading po naglowkach (In-Reply-To, References) | Maile bez kontekstu watku sa bezuzyteczne dla analizy | Medium | RFC 5256 threading. Fallback: subject matching (Re:/Fwd:) |
| Widok watkow -- lista spraw | Uzytkownik musi widziec sprawy, nie pojedyncze maile | Medium | Lista watkow z: temat, liczba maili, status, data pierwszego/ostatniego |
| Podglad watku -- chronologiczna lista maili | Kontekst sprawy od zgloszenia do rozwiazania | Low | Timeline view z nadawca, data, snippet tresci |
| Statystyki watku: liczba wiadomosci, czas trwania, uczestnicy | Dane wejsciowe do analizy AI | Low | Kalkulowane z danych w bazie |

### 1.3 AI Analysis (Core)

| Feature | Dlaczego wymagane | Zlozonosc | Uwagi |
|---------|-------------------|-----------|-------|
| Analiza jakosci komunikacji (ton, uprzedziwosc, profesjonalizm) | Core value proposition -- po to budujemy to narzedzie | High | Prompt per sekcja raportu. Scoring 1-10 wzorem EmailAnalytics sentiment |
| Analiza czasu reakcji per watek | Kluczowy KPI -- administracja ma odpowiadac szybko | Medium | Obliczany z timestampow. AI interpretuje: "2h = dobry", "5 dni = zly" |
| Ocena statusu sprawy (otwarta/zamknieta/w toku) | Raport musi pokazac ile spraw rozwiazano | Medium | AI klasyfikacja na podstawie ostatnich wiadomosci w watku |
| Ocena RODO w tresci maili | Wymog prawny -- administracja moze naruszac RODO | High | Detekcja: PESEL, nr dowodu, dane zdrowotne, dane finansowe w tresci. Pattern matching + AI |
| Ocena danych kontaktowych (czy podawane sa info o osobach realizujacych) | Wymog klienta -- mieszkaniec musi wiedziec kto sie zajmuje sprawa | Low | AI sprawdza czy w odpowiedziach sa: imie/nazwisko, stanowisko, tel, email |
| Podsumowanie: co dobre + sugestie naprawcze | Actionable output -- nie tylko ocena, ale rekomendacje | Medium | AI generuje per sekcja raportu |

### 1.4 Report Generation

| Feature | Dlaczego wymagane | Zlozonosc | Uwagi |
|---------|-------------------|-----------|-------|
| Raport wewnetrzny (pelny) | Zespol PR potrzebuje wszystkich danych | Medium | Wszystkie sekcje analizy, surowe dane, szczegoly |
| Raport kliencki (filtrowany) | Deweloper dostaje okrojona wersje bez wewnetrznych uwag | Medium | Podzbiow sekcji, ladniejsze formatowanie, brak surowych danych |
| Edytowalne prompty per sekcja raportu | Kazdy audyt moze wymagac innego nacisku | High | Domyslny prompt + override per sekcja. UI: side-by-side (domyslny vs edytowalny) -- wzorzec z Marketing Hub |
| Podglad raportu przed eksportem | Uzytkownik musi zobaczyc co generuje AI zanim wyeksportuje | Low | Render HTML w przegladarce |

### 1.5 Export

| Feature | Dlaczego wymagane | Zlozonosc | Uwagi |
|---------|-------------------|-----------|-------|
| Kopiowanie do schowka (rich text) | Szybkie wklejenie do emaila/dokumentu | Low | Clipboard API z text/html MIME type. Chrome 86+ |
| Eksport .docx | Standard korporacyjny -- raporty w Wordzie | Medium | docxtemplater z szablonem .docx. Batchowe sekcje |
| Eksport .pdf | Archiwizacja, drukowanie | Medium | Puppeteer server-side lub react-pdf. Uwaga na Vercel timeout |

---

## 2. Differentiators

Funkcje, ktore wyrozniaja narzedzie. Nie sa oczekiwane, ale daja przewage.

### 2.1 Zaawansowana analiza AI

| Feature | Propozycja wartosci | Zlozonosc | Uwagi |
|---------|---------------------|-----------|-------|
| Scoring per watek (1-10 w wielu wymiarach) | Quantyfikacja jakosci -- nie tylko "dobrze/zle" ale konkretny score | Medium | Wymiary: ton, czas reakcji, kompletnosc, RODO. Wykresy radarowe |
| Automatyczna kategoryzacja tematow watkow | Grupowanie: "awarie", "oplaty", "reklamacje", "pytania ogolne" | Medium | AI clustering lub pre-defined categories + AI classification |
| Porownanie miedzy skrzynkami | Ktora administracja komunikuje sie lepiej? | Low | Agregacja scorow per skrzynka, porownawczy dashboard |
| Trend analysis (porownanie okresu z okresem) | Czy jakosci poprawia sie po interwencji PR? | Medium | Wymaga min. 2 raportow dla tego samego osiedla. Chart: "styczen vs luty" |
| Detekcja "czerwonych flag" (eskalacje, grozby prawne, wulgaryzmy) | Szybka identyfikacja spraw wymagajacych interwencji | Medium | AI flagging z priorytetem. Lista alertow w raporcie |
| Przyklad: cytowanie najlepszych i najgorszych odpowiedzi | Konkretne przyklady do pokazania klientowi | Low | AI wybiera top 3 best + top 3 worst z cytatami |

### 2.2 Dashboard & Overview

| Feature | Propozycja wartosci | Zlozonosc | Uwagi |
|---------|---------------------|-----------|-------|
| Dashboard z KPI tiles | Szybki przeglad metryki bez otwierania raportu | Medium | Tiles: avg response time, # watkow, RODO violations, overall score |
| Wykresy trendow (response time over time) | Wizualizacja zmian jakosci | Medium | Recharts/Chart.js. Wymaga danych historycznych |
| Heatmap aktywnosci (dni tygodnia x godziny) | Kiedy administracja odpowiada -- czy po godzinach? | Low | Wzorzec z EmailAnalytics |
| Top nadawcy/odbiorcy | Kto pisze najwiecej, kto odpowiada najwolniej | Low | Agregacja z danych w bazie |

### 2.3 Workflow & UX

| Feature | Propozycja wartosci | Zlozonosc | Uwagi |
|---------|---------------------|-----------|-------|
| Predefiniowane szablony promptow per typ osiedla | Nowe osiedle vs stare -- inne kryteria oceny | Low | Library promptow, uzytkownik wybiera przy starcie analizy |
| Historia raportow z mozliwoscia porownania | Sledzenie poprawy w czasie | Medium | Lista raportow per skrzynka, diff view |
| Bulk analysis -- wiele skrzynek na raz | Analiza 3 skrzynek jednym kliknieciem | Medium | Queue/batch processing. Progress per skrzynka |
| Annotations/komentarze do sekcji raportu | Zespol PR moze dodac wlasne uwagi przed wyslaniem klientowi | Low | Proste pole tekstowe per sekcja |

---

## 3. Anti-Features

Funkcje, ktorych swiadomie NIE budujemy. Czeste bledy w tej domenie.

| Anti-Feature | Dlaczego unikac | Co robic zamiast |
|--------------|----------------|------------------|
| Odpowiadanie na maile z poziomu aplikacji | Ogromna zlozonosc (compose, send, draft), nie jest core value. Narzedzie jest read-only | Tylko analiza. Link do oryginalnego maila w Outlook |
| Automatyczny sync (cron/realtime) | Overkill dla kilku osob robiaccych audyt raz w miesiacu. Komplikuje architekture | Manualne "Pobierz maile" z progress bar. V2: opcjonalny scheduler |
| Multi-tenant (wiele organizacji) | To narzedzie wewnetrzne JEDNEJ agencji. Multi-tenancy = niepotrzebna zlozonosc | Jedna instancja Lulkiewicz PR. RLS per user role (admin/user), nie per org |
| Integracja z Gmail/Yahoo/inne | Klient uzywa wylacznie Outlook. Abstrakcja wielu providerow = overengineering | Tylko MS Graph API / IMAP dla Outlook. Abstrakcja na interfejsie dla V2 |
| Zaawansowany NLP/ML pipeline | Training custom models, fine-tuning -- zbyt dlugi czas do MVP | GPT-4o/Claude via API z dobrze napisanymi promptami. Prompty sa edytowalne |
| Real-time collaboration na raporcie | Zbyt maly zespol (kilka osob) na Google Docs-like collab | Jedna osoba generuje raport, eksportuje, dzieli sie plikiem |
| Email deliverability analysis (SPF, DKIM, DMARC) | To nie email marketing tool -- nie obchodzi nas czy maile dochodza | Skupiamy sie na tresci i jakosci komunikacji, nie na infrastrukturze |
| Integracja z CRM/ticketing | Brak CRM u klienta, brak potrzeby | Standalone tool. V2: ewentualnie webhook/export |
| Dashboardy real-time z live data | Audyt to process batchowy, nie monitoring real-time | Dashboard z danymi z ostatniego audytu, odswiezany przy nowym pobraniu |
| OCR/attachment analysis | Parsowanie zalacznikow (PDF, obrazki) -- ogromna zlozonosc | V1: analiza tylko body textu maili. V2: opcjonalnie nazwy zalacznikow |
| Wielojezycznosc (i18n) | Uzytkownicy to polski zespol PR, maile tez po polsku | Tylko PL. Hardcoded UI labels |

---

## 4. Feature Dependencies

```
Konfiguracja skrzynki (polaczenie)
  |
  v
Bulk fetch maili (z paginacja)
  |
  v
Parsowanie naglowkow + body
  |
  +---> Przechowywanie w DB (Supabase)
  |       |
  |       v
  |     Threading (grupowanie w watki)
  |       |
  |       +---> Widok watkow (UI lista spraw)
  |       |       |
  |       |       v
  |       |     Podglad watku (timeline)
  |       |
  |       +---> Statystyki watku (czas reakcji, uczestnicy)
  |               |
  |               v
  |             AI Analiza per watek
  |               |
  |               +---> Scoring per watek
  |               |
  |               +---> Kategoryzacja tematow
  |               |
  |               v
  |             AI Analiza zbiorcza (cala skrzynka)
  |               |
  |               v
  |             Generowanie raportu
  |               |
  |               +---> Edytowalne prompty per sekcja
  |               |
  |               +---> Szablon wewnetrzny vs kliencki
  |               |
  |               v
  |             Podglad raportu (HTML)
  |               |
  |               +---> Eksport: schowek
  |               +---> Eksport: .docx
  |               +---> Eksport: .pdf
  |
  v
Dashboard (wymaga danych z co najmniej 1 analizy)
  |
  +---> KPI tiles
  +---> Wykresy trendow (wymaga >= 2 analiz)
  +---> Porownanie skrzynek (wymaga >= 2 skrzynek)
```

### Krytyczne sciezki

1. **Skrzynka -> Fetch -> Parse -> DB -> Threading** -- bez tego zero danych do analizy
2. **Threading -> AI Analiza -> Raport** -- core value chain
3. **Raport -> Eksport** -- deliverable dla klienta

### Blokady miedzy fazami

- AI Analiza NIE moze zaczac sie bez zakonczenia threadingu (potrzebuje pelnych watkow)
- Eksport .docx/.pdf moze byc budowany rownolegle z UI raportu (rozne renderery)
- Dashboard moze byc budowany rownolegle z eksportem (niezalezne od siebie)

---

## 5. MVP Recommendation

### Faza 1: Fundament (MUST -- bez tego nic nie dziala)
1. Hub scaffold (login, sidebar, grid narzedzi)
2. Konfiguracja polaczenia ze skrzynka Outlook
3. Bulk fetch maili z paginacja + zapis do DB
4. Parsowanie naglowkow i body
5. Threading (grupowanie w watki)

### Faza 2: Core Analysis (MUST -- core value proposition)
6. Widok watkow (lista spraw z filtrami)
7. Podglad watku (timeline)
8. AI analiza per watek (ton, czas reakcji, RODO, dane kontaktowe)
9. AI analiza zbiorcza + podsumowanie
10. Edytowalne prompty per sekcja raportu

### Faza 3: Reports & Export (MUST -- deliverable)
11. Szablon raportu wewnetrznego
12. Szablon raportu klienckiego
13. Podglad raportu w przegladarce
14. Kopiowanie do schowka (rich text)
15. Eksport .docx

### Faza 4: Polish & Differentiators (SHOULD -- po walidacji MVP)
16. Eksport .pdf
17. Dashboard z KPI tiles
18. Scoring per watek (radar chart)
19. Kategoryzacja tematow
20. Porownanie miedzy skrzynkami
21. Trend analysis (okres vs okres)

### Defer to v2+
- Automatyczny sync (cron)
- Historia raportow z diff view
- Bulk analysis wielu skrzynek
- Heatmap aktywnosci
- Predefiniowane szablony promptow per typ osiedla
- Annotations do sekcji raportu
- Detekcja czerwonych flag (osobna sekcja alertow)

---

## 6. Sekcje raportu -- rekomendowana struktura

Na podstawie researchu QA scorecardow i communication auditow, rekomendowane sekcje raportu:

### Raport wewnetrzny (pelny)
1. **Podsumowanie wykonawcze** -- 3-5 zdan, overall score, kluczowe wnioski
2. **Statystyki ilosciowe** -- # maili, # watkow, avg czas reakcji, rozklad godzinowy
3. **Ocena jakosci komunikacji** -- ton, uprzedziwosc, profesjonalizm (score 1-10)
4. **Ocena czasu reakcji** -- rozklad, outliers, najwolniejsze watki
5. **Ocena kompletnosci odpowiedzi** -- czy podano dane kontaktowe, czy odpowiedziano na pytanie
6. **Zgodnosc z RODO** -- wykryte naruszenia, typ danych, watki z problemami
7. **Najlepsze/najgorsze przyklady** -- cytaty z konkretnych maili
8. **Rekomendacje naprawcze** -- konkretne sugestie co poprawic
9. **Analiza per watek (appendix)** -- szczegolowa ocena kazdego watku

### Raport kliencki (filtrowany)
1. **Podsumowanie wykonawcze** -- latwiejszy jezyk, bez zargonu PR
2. **Kluczowe metryki** -- 4-5 KPI w formie graficznej
3. **Ocena jakosci komunikacji** -- ogolna ocena bez surowych danych
4. **Rekomendacje** -- co poprawic, sformulowane jako partnerskie sugestie
5. **Porownanie z poprzednim okresem** (jesli dostepne)

---

## 7. Kryteria oceny jakosci komunikacji -- rekomendowany scorecard

Na podstawie researchu QA scorecardow (Zendesk, MaestroQA, MaestroQA email chat):

| Kategoria | Kryteria | Waga | Typ oceny |
|-----------|----------|------|-----------|
| **Czas reakcji** | Czas od otrzymania do pierwszej odpowiedzi | 20% | Numeryczny (godziny) |
| **Ton i kultura** | Uprzedziwosc, profesjonalizm, brak wulgaryzmu | 20% | Scale 1-10 |
| **Kompletnosc odpowiedzi** | Czy odpowiedziano na wszystkie pytania | 15% | Scale 1-10 |
| **Dane kontaktowe** | Czy podano imie, stanowisko, tel/email osoby realizujacej | 10% | Binary (tak/nie) |
| **Rozwiazanie sprawy** | Czy sprawa zostala rozwiazana | 15% | Enum (zamknieta/otwarta/w toku) |
| **Zgodnosc z RODO** | Brak ujawniania danych osobowych w tresci | 10% | Binary (naruszenie/brak) |
| **Poprawnosc jezykowa** | Gramatyka, ortografia, czytelnosc | 10% | Scale 1-10 |

---

## Sources

### Email Analytics & Monitoring Tools
- [EmailAnalytics](https://emailanalytics.com/) -- response time tracking, sentiment analysis, team dashboards
- [EmailMeter](https://www.emailmeter.com) -- email analytics for Gmail and Microsoft 365, SLA tracking
- [Email Audit Engine](https://emailauditengine.com/) -- email audit reports, white-label, client retention

### QA Scorecards & Email Quality
- [Zendesk -- How to build a QA scorecard](https://www.zendesk.com/blog/qa-scorecard/)
- [MaestroQA -- QA Scorecard for Email and Chat](https://www.maestroqa.com/blog/qa-scorecard-email-chat)
- [Teramind -- Call Center Email Quality Monitoring](https://www.teramind.co/blog/call-center-email-quality-monitoring/)
- [EmailAnalytics -- Customer Service Email Metrics](https://emailanalytics.com/customer-service-email-metrics)

### Email Threading & Clustering
- [Nylas -- What is Email Threading?](https://www.nylas.com/products/email-api/what-is-email-threading/)
- [Relativity -- Email Threading 101](https://www.relativity.com/blog/email-threading-101-an-introduction-to-an-essential-e-discovery-tool/)
- [Wikipedia -- Conversation threading](https://en.wikipedia.org/wiki/Conversation_threading)

### GDPR & Personal Data Detection
- [CookieYes -- GDPR Scanning Software](https://www.cookieyes.com/blog/gdpr-scanning-software/)
- [Strac -- PII Data Scanning Tools 2026](https://www.strac.io/blog/top-10-data-scanning-tools)
- [PII Tools -- GDPR Compliance](https://pii-tools.com/gdpr/)

### AI Sentiment & Tone Analysis
- [EmailAnalytics -- AI Sentiment Analysis launch](https://www.prweb.com/releases/emailanalytics-launches-groundbreaking-ai-powered-sentiment-analysis-for-email-communications-302440877.html)
- [Taskade -- Email Conversation Tone Analyzer](https://www.taskade.com/agents/email/email-conversation-tone-analyzer)
- [Wizr AI -- NLP Sentiment Analysis](https://wizr.ai/blog/nlp-sentiment-analysis-transforms-customer-feedback/)

### Export & Document Generation
- [Docxtemplater](https://docxtemplater.com/) -- docx generation from templates
- [Puppeteer for PDF in Next.js](https://dev.to/jordykoppen/turning-react-apps-into-pdfs-with-nextjs-nodejs-and-puppeteer-mfi)
- [Clipboard API -- Rich text copy](https://dev.to/stegriff/copy-rich-html-with-the-native-clipboard-api-5ah8)

### Property Management Communication
- [AppFolio -- Property Management Communication](https://www.appfolio.com/property-manager/communication-service)
- [DoorLoop -- Resident Satisfaction Survey](https://www.doorloop.com/blog/how-to-use-a-resident-satisfaction-survey-template-and-guide)

### Communication Audit Methodology
- [ContactMonkey -- Internal Communications Audit](https://www.contactmonkey.com/blog/internal-communications-audit)
- [Cerkl -- Internal Communications Audit Template](https://cerkl.com/assets/internal-communications-audit-template)
- [Prezentium -- Communication Audit Template](https://prezentium.com/communication-audit/)
