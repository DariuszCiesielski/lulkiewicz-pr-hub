# Requirements: Lulkiewicz PR Hub

**Defined:** 2026-02-10
**Core Value:** AI analizuje tysiące maili i generuje raport oceniający jakość komunikacji administracji osiedli z mieszkańcami

## v1 Requirements

Requirements for MVP release. Each maps to roadmap phases.

### Hub Shell

- [ ] **HUB-01**: Użytkownik może się zarejestrować (email + hasło) i zalogować
- [ ] **HUB-02**: Sesja utrzymuje się po odświeżeniu przeglądarki
- [ ] **HUB-03**: Niezalogowany użytkownik jest przekierowany na stronę logowania
- [ ] **HUB-04**: System ról admin/user — admin zarządza użytkownikami i narzędziami
- [ ] **HUB-05**: Panel admina: lista użytkowników, dodawanie, edycja ról, kontrola dostępu do narzędzi
- [ ] **HUB-06**: Grid 6 narzędzi na dashboardzie: 1 aktywne (Analizator Email) + 5 Coming Soon
- [ ] **HUB-07**: Sidebar z nawigacją do narzędzi i sekcji
- [ ] **HUB-08**: Unified Design System: 6 motywów z przełącznikiem w menu użytkownika
- [ ] **HUB-09**: Footer z prawami autorskimi (wzorzec brand-elements)
- [ ] **HUB-10**: Responsywność na mobile i tablet

### Email Connection

- [ ] **MAIL-01**: Formularz konfiguracji skrzynki: adres email, login, hasło (lub OAuth), typ serwera
- [ ] **MAIL-02**: Test połączenia ze skrzynką z informacją o wyniku (sukces/błąd z opisem)
- [ ] **MAIL-03**: Obsługa wielu skrzynek (multi-mailbox) — lista skrzynek z możliwością dodawania/usuwania
- [ ] **MAIL-04**: Bezpieczne przechowywanie credentials (szyfrowanie AES-256, deszyfrowanie server-side)
- [ ] **MAIL-05**: Auto-detekcja typu serwera (O365 vs IMAP) lub ręczny wybór

### Email Fetching

- [ ] **FETCH-01**: Jednorazowe pobranie wszystkich maili ze skrzynki do bazy (bulk download)
- [ ] **FETCH-02**: Paginowany/chunked sync — obsługuje tysiące maili bez timeout (Vercel limit)
- [ ] **FETCH-03**: Progress bar pobierania z liczbą pobranych/całkowitych maili
- [ ] **FETCH-04**: Manualne odświeżanie — przycisk "Pobierz nowe" (delta sync)
- [ ] **FETCH-05**: Parsowanie nagłówków: From, To, Cc, Date, Subject, In-Reply-To, References, Message-ID
- [ ] **FETCH-06**: Parsowanie treści: HTML → plaintext, obsługa polskich znaków (charset detection)
- [ ] **FETCH-07**: Migracja Supabase: tabele emails, mailboxes, sync_jobs

### Email Threading

- [ ] **THREAD-01**: Automatyczne grupowanie maili w wątki (In-Reply-To, References, Subject fallback)
- [ ] **THREAD-02**: Widok wątków: lista wątków z liczbą wiadomości, datą, uczestnikami
- [ ] **THREAD-03**: Drill-down w wątek: chronologiczny widok maili w wątku
- [ ] **THREAD-04**: Filtrowanie wątków: po dacie, nadawcy, statusie (otwarty/zamknięty), słowach kluczowych
- [ ] **THREAD-05**: Wybór zakresu czasowego analizy (1-3 miesiące) z uwzględnieniem starszych otwartych spraw

### AI Analysis

- [ ] **AI-01**: AI analiza ogólna: jakość komunikacji, kultura wypowiedzi, zasady grzecznościowe
- [ ] **AI-02**: AI analiza per wątek: czas reakcji, status sprawy (otwarta/zamknięta), skuteczność rozwiązania
- [ ] **AI-03**: AI ocena: obecność danych kontaktowych i informacji o osobach realizujących sprawę
- [ ] **AI-04**: AI ocena: przestrzeganie RODO w treści maili (wykrywanie naruszeń)
- [ ] **AI-05**: AI analiza: sugestie działań naprawczych + co jest robione dobrze
- [ ] **AI-06**: Map-Reduce pipeline: analiza per-wątek → agregacja w sekcje raportu
- [ ] **AI-07**: Progress bar analizy AI z informacją o aktualnie przetwarzanym wątku
- [ ] **AI-08**: Konfiguracja AI: wybór providera (OpenAI/Anthropic/Google), klucz API, model

### Custom Evaluation Criteria

- [ ] **EVAL-01**: Użytkownik może definiować checklisty (punkty do sprawdzenia tak/nie) — AI ocenia każdy
- [ ] **EVAL-02**: Użytkownik może definiować scoring rubrics (kryteria + wagi + skala np. 1-5)
- [ ] **EVAL-03**: Domyślny zestaw kryteriów oceny z możliwością pełnej customizacji
- [ ] **EVAL-04**: Wyniki scoringu widoczne w raporcie z wizualnymi wskaźnikami (progress bars, oceny)

### Prompt Management

- [ ] **PROMPT-01**: Domyślne prompty per sekcja raportu (z kodu)
- [ ] **PROMPT-02**: Edytowalne prompty — użytkownik może modyfikować treść promptu dla każdej sekcji
- [ ] **PROMPT-03**: Podgląd side-by-side: domyślny prompt vs edytowany
- [ ] **PROMPT-04**: Reset promptu do domyślnego jednym klikiem
- [ ] **PROMPT-05**: 3-tier resolution: domyślny z kodu → globalny → per-raport (wzorzec Marketing Hub)

### Report Generation

- [ ] **REPORT-01**: Generowanie raportu AI na podstawie analizy maili i wybranych kryteriów
- [ ] **REPORT-02**: Dwa szablony raportów: wewnętrzny (pełny) i kliencki (filtrowany)
- [ ] **REPORT-03**: Podgląd raportu w aplikacji z markdown rendering
- [ ] **REPORT-04**: Edycja wygenerowanego raportu przed eksportem
- [ ] **REPORT-05**: Historia raportów — lista wygenerowanych raportów z datami
- [ ] **REPORT-06**: Migracja Supabase: tabele reports, report_templates, prompts, evaluation_criteria

### Export

- [ ] **EXPORT-01**: Kopiowanie raportu do schowka (jeden klik)
- [ ] **EXPORT-02**: Eksport do .docx (Word) z formatowaniem
- [ ] **EXPORT-03**: Eksport do .pdf z formatowaniem

### Dashboard

- [ ] **DASH-01**: Kafelki KPI: średni czas odpowiedzi, % otwartych spraw, ogólny scoring komunikacji
- [ ] **DASH-02**: Podsumowanie per skrzynka: liczba wątków, maili, ostatnia synchronizacja
- [ ] **DASH-03**: Quick actions: generuj raport, odśwież skrzynkę, dodaj nową skrzynkę
- [ ] **DASH-04**: Ostatnie raporty z datami i statusami

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Pozostałe narzędzia hubu

- **TOOL-01**: Narzędzie 2 (do ustalenia z klientem)
- **TOOL-02**: Narzędzie 3 (do ustalenia z klientem)
- **TOOL-03**: Narzędzie 4 (do ustalenia z klientem)
- **TOOL-04**: Narzędzie 5 (do ustalenia z klientem)
- **TOOL-05**: Narzędzie 6 (do ustalenia z klientem)

### Auto-sync & Notifications

- **SYNC-01**: Automatyczna synchronizacja maili (cron / Supabase CRON)
- **SYNC-02**: Powiadomienia o nowych mailach
- **SYNC-03**: Alerty o spóźnionych odpowiedziach

### Advanced Analytics

- **ANLYT-01**: Trendy komunikacyjne w czasie (wykresy)
- **ANLYT-02**: Porównanie między skrzynkami / osiedlami
- **ANLYT-03**: Benchmarking — scoring vs średnia branżowa

### Gmail Support

- **GMAIL-01**: Integracja z Gmail API
- **GMAIL-02**: Obsługa skrzynek Gmail obok Outlook

## Out of Scope

| Feature | Reason |
|---------|--------|
| Odpowiadanie na maile z aplikacji | Tylko analiza read-only, nie klient mailowy |
| Automatyczny sync (cron) | MVP: manualne odświeżanie, auto-sync w v2 |
| Multi-tenancy (wiele organizacji) | Jedna instancja dla Lulkiewicz PR |
| Integracja z innymi dostawcami poczty (Gmail, Yahoo) | Na razie tylko Outlook |
| Mobile app | Web-first, responsive design |
| Wielojęzyczność | Tylko PL |
| Publiczny landing page | Narzędzie wewnętrzne, tylko login |
| Pobieranie/analiza załączników | Skupiamy się na treści maili, nie na plikach |
| Real-time monitoring maili | Batch analysis, nie streaming |

## Traceability

(Populated during roadmap creation)

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 0
- Unmapped: 55

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
