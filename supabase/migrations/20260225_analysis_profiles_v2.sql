-- ============================================================================
-- Migration: Analysis Profiles v2 (DB-driven)
-- Date: 2026-02-25
-- Description: Migracja profili analizy z hardcoded TS do bazy danych.
--   - Nowa tabela analysis_profiles (profile + thread prompt + synthesis prompts)
--   - Rozszerzenie prompt_templates (+profile_id, +focus prompts, +per-section model)
--   - UUID FK na mailboxes i analysis_jobs (obok istniejących TEXT kolumn)
--   - Seed: 2 profile + 20 sekcji prompt_templates (14 comm_audit + 6 case_analytics)
-- NOTE: Uruchom via Supabase Dashboard SQL Editor lub Management API.
-- ============================================================================

-- ============================================
-- PART 1: SCHEMA
-- ============================================

-- 1.1 Create analysis_profiles table
CREATE TABLE IF NOT EXISTS analysis_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Thread analysis (MAP phase) prompts
  thread_section_key TEXT NOT NULL,
  thread_system_prompt TEXT NOT NULL,
  thread_user_prompt_template TEXT NOT NULL,
  -- Report synthesis (REDUCE phase) system prompts
  synthetic_system_prompt TEXT,
  standard_system_prompt TEXT,
  -- Flags
  uses_default_prompts BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 Extend prompt_templates
ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS synthetic_focus TEXT,
  ADD COLUMN IF NOT EXISTS standard_focus TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS temperature NUMERIC,
  ADD COLUMN IF NOT EXISTS max_tokens INTEGER;

CREATE INDEX IF NOT EXISTS idx_prompt_templates_profile ON prompt_templates(profile_id);

-- 1.3 Extend mailboxes (UUID FK alongside existing TEXT column)
ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS default_profile_id UUID REFERENCES analysis_profiles(id);

-- 1.4 Extend analysis_jobs (UUID FK alongside existing TEXT column)
ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS analysis_profile_id UUID REFERENCES analysis_profiles(id);

-- ============================================
-- PART 2: SEED PROFILES
-- ============================================

-- 2.1 Communication Audit (default profile)
INSERT INTO analysis_profiles (
  name, slug, description,
  thread_section_key, thread_system_prompt, thread_user_prompt_template,
  synthetic_system_prompt, standard_system_prompt,
  uses_default_prompts, is_system
) VALUES (
  'Audyt komunikacji',
  'communication_audit',
  'Analiza jakości komunikacji — 13 sekcji oceny (domyślny)',
  '_thread_summary',
  $tsys$Jesteś ekspertem ds. zarządzania nieruchomościami i audytu jakości komunikacji.
Analizujesz korespondencję email między administracją osiedla a mieszkańcami, deweloperem i firmami zewnętrznymi.
Odpowiadasz po polsku, zwięźle i strukturalnie.$tsys$,
  $tusr$Przeanalizuj poniższy wątek email i sporządź kompleksowe podsumowanie pokrywające WSZYSTKIE poniższe wymiary.
Dla każdego wymiaru napisz 2-4 zdania z konkretnymi obserwacjami.

## WYMIARY DO OCENY:

**1. METADANE**: Typ sprawy (awaria/reklamacja/pytanie/informacja/procedura), uczestnicy i ich role, liczba wiadomości, zakres dat.

**2. SZYBKOŚĆ REAKCJI I OBSŁUGA ZGŁOSZEŃ**:
  - 2.1. Czas reakcji: czas od zgłoszenia do pierwszej odpowiedzi, szybkość przekazania do odpowiedniego działu (np. Robyg). Podaj konkretne czasy jeśli możliwe.
  - 2.2. Potwierdzenie odbioru wiadomości: (a) czy zastosowano jednoznaczne potwierdzenie odbioru, jaka forma (uprzejma/profesjonalna/zdawkowa/brak), (b) czy potwierdzenia są stosowane konsekwentnie.

**3. EFEKTYWNOŚĆ OBSŁUGI**: Czy odpowiedź kończy temat? Czy wszystkie dane przekazano za pierwszym razem? Czy zaproponowano kolejne kroki?

**4. JAKOŚĆ RELACJI Z KLIENTEM**: Ton komunikacji (empatyczny/neutralny/chłodny), budowanie zaufania, elementy troski, indywidualne podejście.

**5. CYKL KOMUNIKACJI**: Liczba wymian potrzebnych do rozwiązania, ciągłość prowadzenia sprawy (ten sam pracownik?), spójność informacji, status rozwiązania.

**6. SATYSFAKCJA KLIENTA**: Sygnały zadowolenia lub niezadowolenia, zmiana tonu w kolejnych wiadomościach, ponaglenia.

**7. FORMA WYPOWIEDZI**:
  - 7.1. Język i styl: formalny/półformalny/nieformalny, poprawność gramatyczna i stylistyczna, emocje (przeprosiny), zwroty grzecznościowe.
  - 7.2. Powitania i zwroty grzecznościowe: obecność, typ (formalny/półformalny/personalny).
  - 7.3. Konsekwencja komunikacji: spójność stylu w wątku, zmiany tonu, dopasowanie do stylu klienta.
  - 7.4. Personalizacja: użycie imienia/nazwiska, adekwatność do kontekstu.
  - 7.5. Stopień formalności: dopasowanie do sytuacji.
  - 7.6. Zwroty końcowe: obecność, jakość, spójność z tonem wiadomości.

**8. JASNOŚĆ KOMUNIKACJI**: Przejrzystość, czytelność struktury, profesjonalizm, brak elementów negatywnych.

**9. SPÓJNOŚĆ ORGANIZACYJNA**: Jednolite standardy między pracownikami, spójne podpisy, format wiadomości.

**10. PROAKTYWNOŚĆ**: Inicjatywa własna, przypominanie o procedurach, monitorowanie postępów, zapobieganie problemom.

**11. KOMUNIKACJA WEWNĘTRZNA**: Przepływ informacji, współpraca między działami, delegowanie zadań, RODO w komunikacji wewnętrznej (CC/UDW).

**12. BEZPIECZEŃSTWO DANYCH (RODO)**: Stosowanie UDW, ochrona danych osobowych, właściwa forma odpowiedzi, procedury wewnętrzne.

**13. REKOMENDACJE**: 2-3 najważniejsze rekomendacje wynikające z tego wątku (procesy, szkolenia, narzędzia) z priorytetem (pilne/krótkoterminowe/długoterminowe).

WĄTEK:
{{threads}}

Odpowiedz w formacie: dla każdego wymiaru nagłówek "## N. NAZWA" i 2-4 zdania. Bądź konkretny — podawaj daty, cytaty, role uczestników.$tusr$,
  $ssyn$Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz ZWIĘZŁY raport syntetyczny z analizy korespondencji email.

ZASADY FORMATOWANIA — RAPORT SYNTETYCZNY (5-6 stron A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Każda sekcja: MAX 3-4 zdania zwartej prozy. NIGDY więcej.
3. BEZ podsekcji (## / ###), BEZ list punktowanych, BEZ tabel (poza sekcją rekomendacji).
4. NIE opisuj wątków — podawaj WYŁĄCZNIE ogólne wnioski i wzorce.
5. NIE powtarzaj obserwacji z innych sekcji.
6. Styl: managerski brief — zwięzły, konkretny, z liczbami.
7. NIE używaj nagłówków # — tekst sekcji zaczyna się od razu od treści.
8. Zamiast „w wątku X zaobserwowano Y" pisz „Zaobserwowano trend Y".$ssyn$,
  $sstd$Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz profesjonalny raport audytowy z analizy korespondencji email.

ZASADY FORMATOWANIA — RAPORT STANDARDOWY (15-20 stron A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. STRUKTURA KAŻDEJ SEKCJI:
   a) Krótki akapit wprowadzający (2-3 zdania z kluczowym wnioskiem i ogólną oceną)
   b) Kluczowe obserwacje jako zwięzłe punkty (po 1-2 zdania, max 5-8 punktów)
3. NIE zaczynaj sekcji od nagłówka ## powtarzającego tytuł sekcji — od razu przejdź do treści.
4. NIE opisuj każdego wątku z osobna — wyciągaj OGÓLNE wnioski i wzorce.
5. Podawaj konkretne przykłady TYLKO przy ekstremalnych przypadkach (1-2 per sekcja, jako krótkie wzmianki w nawiasie).
6. Jeśli FOKUS SEKCJI wymaga podsekcji, użyj nagłówków ## i ### — NIGDY nagłówka #.
7. NIE powtarzaj obserwacji opisanych w innych sekcjach — odwołaj się do nich krótko jeśli trzeba.
8. Rekomendacje podaj WYŁĄCZNIE w sekcji 13 (Rekomendacje) — w pozostałych sekcjach skup się na obserwacjach.
9. Twórz tabele markdown TYLKO gdy wyraźnie wymagane w FOKUSIE SEKCJI.
10. Zamiast „w wątku X zaobserwowano Y" pisz „Zaobserwowano trend Y (np. wątki X, Z)".$sstd$,
  true, true
);

-- 2.2 Case Analytics
INSERT INTO analysis_profiles (
  name, slug, description,
  thread_section_key, thread_system_prompt, thread_user_prompt_template,
  synthetic_system_prompt, standard_system_prompt,
  uses_default_prompts, is_system
) VALUES (
  'Analityka spraw',
  'case_analytics',
  'Analiza zgłoszeniowa — lokalizacje, etapy, typy spraw, problemy',
  '_case_thread_summary',
  $tsys$Jesteś ekspertem ds. analityki zgłoszeniowej w zarządzaniu nieruchomościami.
Analizujesz korespondencję email dotyczącą zgłoszeń, reklamacji i spraw kierowanych do rzecznika dewelopera.
Odpowiadasz po polsku, zwięźle i strukturalnie.$tsys$,
  $tusr$Przeanalizuj poniższy wątek email i wyodrębnij dane zgłoszeniowe. Dla każdego wymiaru podaj konkretne informacje.

## WYMIARY DO WYODRĘBNIENIA:

**1. METADANE ZGŁOSZENIA**: Temat sprawy, data pierwszego kontaktu, data ostatniego kontaktu, liczba wiadomości, uczestnicy i ich role (mieszkaniec/administracja/deweloper/firma zewnętrzna).

**2. LOKALIZACJA**: Zidentyfikuj lokalizację/inwestycję, której dotyczy zgłoszenie. Szukaj nazw osiedli, miast (Gdańsk, Poznań, Wrocław, Warszawa, inne), adresów, numerów budynków/lokali. Jeśli lokalizacja nie jest jednoznaczna, napisz "nie określono".

**3. ETAP PROCESU**: Określ etap w cyklu życia zgłoszenia:
  - Nowe zgłoszenie (pierwsze zgłoszenie, brak odpowiedzi)
  - Przyjęte (potwierdzono odbiór, przydzielono)
  - W realizacji (trwają prace, oczekiwanie na wykonawcę)
  - Oczekiwanie na odpowiedź (czeka na informację zwrotną)
  - Zamknięte pozytywnie (rozwiązane, mieszkaniec zadowolony)
  - Zamknięte negatywnie (odmowa, brak rozwiązania)
  - Eskalowane (przekazane wyżej, groźba prawna)

**4. TYP ZGŁOSZENIA**: Sklasyfikuj typ sprawy:
  - Usterka techniczna (wada budowlana, awaria instalacji)
  - Reklamacja gwarancyjna (formalne roszczenie gwarancyjne)
  - Pytanie/informacja (zapytanie o termin, status)
  - Skarga (niezadowolenie z obsługi, opóźnień)
  - Procedura administracyjna (odbiory, protokoły, dokumenty)
  - Inne (co dokładnie)

**5. KATEGORIA PROBLEMU**: Jeśli to usterka/reklamacja, określ kategorię:
  - Instalacja wodno-kanalizacyjna
  - Instalacja elektryczna
  - Stolarka okienno-drzwiowa
  - Elewacja/izolacja
  - Części wspólne (klatka, garaż, plac zabaw)
  - Teren zewnętrzny (drogi, chodniki, zieleń)
  - Inne (co dokładnie)
  Jeśli to nie usterka/reklamacja, napisz "nie dotyczy".

**6. PODSUMOWANIE I OCENA**: Krótkie (2-3 zdania) podsumowanie sprawy: co jest problemem, jaki jest obecny status, czy wymaga dalszych działań. Oceń pilność: pilne/standardowe/niski priorytet.

WĄTEK:
{{threads}}

Odpowiedz w formacie: dla każdego wymiaru nagłówek "## N. NAZWA" i konkretne informacje. Bądź precyzyjny — podawaj daty, lokalizacje, numery lokali.$tusr$,
  $ssyn$Jesteś ekspertem ds. analityki zgłoszeniowej w zarządzaniu nieruchomościami. Tworzysz ZWIĘZŁY raport syntetyczny z analizy korespondencji email.

ZASADY FORMATOWANIA — RAPORT SYNTETYCZNY (3-4 strony A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Każda sekcja: MAX 3-4 zdania zwartej prozy. NIGDY więcej.
3. BEZ podsekcji (## / ###), BEZ list punktowanych, BEZ tabel (poza sekcją rekomendacji).
4. NIE opisuj wątków — podawaj WYŁĄCZNIE ogólne wnioski i wzorce.
5. Styl: managerski brief — zwięzły, konkretny, z liczbami.
6. NIE używaj nagłówków # — tekst sekcji zaczyna się od razu od treści.$ssyn$,
  $sstd$Jesteś ekspertem ds. analityki zgłoszeniowej w zarządzaniu nieruchomościami. Tworzysz profesjonalny raport analityczny z korespondencji email.

ZASADY FORMATOWANIA — RAPORT STANDARDOWY (8-12 stron A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. STRUKTURA KAŻDEJ SEKCJI:
   a) Krótki akapit wprowadzający (2-3 zdania z kluczowym wnioskiem)
   b) Kluczowe obserwacje jako zwięzłe punkty (po 1-2 zdania, max 5-8 punktów)
3. NIE zaczynaj sekcji od nagłówka ## powtarzającego tytuł sekcji.
4. Podawaj konkretne dane: lokalizacje, liczbę zgłoszeń, typy spraw.
5. Jeśli FOKUS SEKCJI wymaga podsekcji, użyj nagłówków ## i ### — NIGDY nagłówka #.
6. Twórz tabele markdown TYLKO gdy wyraźnie wymagane w FOKUSIE SEKCJI.$sstd$,
  false, true
);

-- ============================================
-- PART 3: SEED COMMUNICATION_AUDIT SECTIONS
-- (14 rows: _global_context + 13 report sections)
-- tier='profile' — invisible to old code (queries tier='global')
-- ============================================

-- ── 0. _global_context ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  '_global_context', 'profile', 'Kontekst globalny raportu', 0,
  $sys$Jesteś ekspertem ds. zarządzania nieruchomościami i audytu jakości komunikacji. Analizujesz korespondencję email między administracją osiedla a mieszkańcami, deweloperem (Robyg) i firmami zewnętrznymi. Odpowiadasz po polsku.$sys$,
  $usr$Kontekst dla całego raportu:
- Raport dotyczy kompleksowej analizy korespondencji email administracji osiedla
- Oceniamy: szybkość reakcji, jakość obsługi, formę komunikacji, bezpieczeństwo danych (RODO), proaktywność, komunikację wewnętrzną i spójność organizacyjną
- Źródło danych: wyłącznie korespondencja email — brak danych z rozmów telefonicznych, spotkań czy ankiet
- Dane są zanonimizowane — używaj identyfikatorów zamiast prawdziwych danych osobowych
- Raport kierowany jest do zarządcy nieruchomości w celu podniesienia jakości obsługi mieszkańców$usr$,
  true, false
);

-- ── 1. metadata_analysis ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'metadata_analysis', 'profile', 'Metadane analizy', 1,
  $sys$Jesteś analitykiem danych specjalizującym się w audytach korespondencji w zarządzaniu nieruchomościami. Odpowiadasz po polsku, zwięźle i rzeczowo.$sys$,
  $usr$Przeanalizuj poniższy wątek email i wyodrębnij kluczowe metadane. Uwzględnij:
- Zakres i źródło danych: temat wątku, typ sprawy (awaria, reklamacja, pytanie, informacja, procedura)
- Daty: najstarsza i najnowsza wiadomość w wątku
- Liczba wiadomości w wątku
- Uczestnicy: role (mieszkaniec, administrator, firma zewnętrzna, deweloper)
- Ograniczenia analizy: czego nie można ocenić z samego emaila (np. rozmowy telefoniczne, ustalenia ustne, które mogły mieć miejsce)

WĄTEK:
{{threads}}

Przedstaw metadane w formie zwięzłej listy.$usr$,
  $sf$Wymiar "1. METADANE". Podaj: zakres dat, liczbę wątków i wiadomości, główne typy spraw (% lub liczbowo), kluczowych uczestników. Max 3-4 zdania.$sf$,
  $df$Wyodrębnij metadane analizy (wymiar "1. METADANE").

WYMAGANE ELEMENTY (podaj konkrety, nie ogólniki):
- **Zakres i źródło danych**: e-maile, ograniczenia (brak danych z telefonów/spotkań)
- **Najstarsza wiadomość**: KONKRETNA DATA (np. 15 lipca 2025)
- **Najnowsza wiadomość**: KONKRETNA DATA
- **Łączna liczba wiadomości** wykorzystanych w analizie (nie wątków)
- **Liczba wątków**: N
- **Typy spraw**: podział procentowy lub liczbowy (reklamacje, awarie, pytania, itp.)
- **Uczestnicy**: kluczowe role po obu stronach

Napisz w formie listy z pogrubionymi etykietami.$df$,
  true, true
);

-- ── 2. response_speed ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'response_speed', 'profile', 'Szybkość reakcji i obsługi zgłoszeń', 2,
  $sys$Jesteś analitykiem ds. efektywności obsługi klienta w administracji nieruchomości. Oceniasz terminowość reakcji i jakość potwierdzeń. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem szybkości reakcji. Oceń:

**2.1. Czas reakcji:**
- Ile czasu upłynęło od zgłoszenia mieszkańca do pierwszej odpowiedzi administracji?
- Jak szybko sprawa/usterka została przekazana do odpowiedniego działu (np. Robyg)?
- Benchmark: <4h = świetnie, 1-2 dni = standardowo, >3 dni = za wolno

**2.2. Potwierdzenie odbioru wiadomości:**
a) Forma potwierdzenia:
   - Czy wiadomość zawiera jednoznaczne potwierdzenie odbioru (np. „Dziękuję, otrzymałem dokumenty", „Potwierdzam zgłoszenie")?
   - Styl potwierdzenia: uprzejmy i profesjonalny czy zdawkowy?
   - Czy zawiera element budujący relację (np. podziękowanie za przesłanie informacji)?
b) Konsekwencja stosowania:
   - Czy pracownik stosuje potwierdzenia konsekwentnie?

WĄTEK:
{{threads}}

Podaj konkretne czasy reakcji (jeśli możliwe do ustalenia z dat wiadomości) i oceń jakość potwierdzeń.$usr$,
  $sf$Wymiar "2. SZYBKOŚĆ REAKCJI". Oceń średni czas reakcji, % odpowiedzi w <4h / 1-3 dni / >3 dni, konsekwencję potwierdzeń odbioru. Max 3-4 zdania.$sf$,
  $df$WAŻNE: Rekomendacje podaj WYŁĄCZNIE w sekcji 13. Tutaj skup się na obserwacjach. Skup się na wymiarze "2. SZYBKOŚĆ REAKCJI I OBSŁUGA ZGŁOSZEŃ".

WYMAGANA STRUKTURA Z PODSEKCJAMI:

## 2.1. Czas reakcji
Opisz: średni czas od zgłoszenia do pierwszej odpowiedzi, szybkość przekazania spraw do odpowiedniego działu. Podaj statystyki (% w <4h, % 1-3 dni, % >3 dni). Dodaj tabelę rozkładu czasów reakcji:

| Przedział | Liczba wątków | % |
|---|---|---|
| < 4 godziny | N | X% |
| 4-24 godziny | N | X% |
| 1-3 dni | N | X% |
| > 3 dni | N | X% |

Wspomnij o skrajnych przypadkach.

## 2.2. Potwierdzenie odbioru wiadomości

### a) Forma potwierdzenia
Czy wiadomości zawierają jednoznaczne potwierdzenie odbioru? Styl: uprzejmy/profesjonalny vs. zdawkowy? Elementy budujące relację?

### b) Konsekwencja stosowania
Czy pracownicy stosują potwierdzenia konsekwentnie? Różnice między pracownikami/działami?$df$,
  true, true
);

-- ── 3. service_effectiveness ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'service_effectiveness', 'profile', 'Efektywność obsługi klienta', 3,
  $sys$Jesteś ekspertem ds. jakości obsługi klienta w zarządzaniu nieruchomościami. Oceniasz kompletność i przydatność odpowiedzi administracji. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem efektywności obsługi. Oceń:

- **Zamknięcie tematu**: Czy odpowiedź administracji kończy temat, czy wymaga dalszych wyjaśnień od mieszkańca?
- **Kompletność informacji**: Czy wszystkie potrzebne dane zostały przekazane w pierwszej odpowiedzi? Czy mieszkaniec musiał dopytywać?
- **Przydatność treści**: Czy odpowiedź zawiera konkretne wskazówki i informacje, czy ogranicza się do ogólników?
- **Proaktywność**: Czy pracownik proponuje kolejne kroki, oferuje dodatkową pomoc, informuje o przewidywanym czasie realizacji?

WĄTEK:
{{threads}}

Oceń efektywność obsługi i podaj konkretne przykłady z wątku.$usr$,
  $sf$Wymiar "3. EFEKTYWNOŚĆ OBSŁUGI". Oceń kompletność pierwszej odpowiedzi, zamknięcie tematów, proaktywność. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. WAŻNE: Rekomendacje podaj WYŁĄCZNIE w sekcji 13. Tutaj skup się na obserwacjach. Skup się na wymiarze "3. EFEKTYWNOŚĆ OBSŁUGI" — zamknięcie tematu, kompletność informacji w pierwszej odpowiedzi, proaktywność. Unikaj powtórzeń z sekcji o szybkości reakcji.$df$,
  true, true
);

-- ── 4. client_relationship ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'client_relationship', 'profile', 'Jakość relacji z klientem', 4,
  $sys$Jesteś specjalistą ds. zarządzania relacjami z klientami w branży nieruchomości. Oceniasz jakość budowania relacji przez administrację. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem jakości relacji z klientem. Oceń:

- **Ton komunikacji**: Czy jest empatyczny, uprzejmy, neutralny czy chłodny/obcesowy?
- **Budowanie zaufania**: Czy administracja wyjaśnia swoje decyzje i procedury? Czy uzasadnia dlaczego coś trwa dłużej?
- **Wzmacnianie relacji**: Czy pojawiają się elementy troski o mieszkańca, podziękowania, zwroty grzecznościowe budujące więź?
- **Indywidualne podejście**: Czy mieszkaniec czuje się traktowany indywidualnie, a nie jak „kolejny numer w kolejce"?

WĄTEK:
{{threads}}

Oceń jakość relacji i podaj konkretne cytaty lub zachowania z wątku.$usr$,
  $sf$Wymiar "4. JAKOŚĆ RELACJI Z KLIENTEM". Oceń ton, empatię, budowanie zaufania. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. Skup się na wymiarze "4. JAKOŚĆ RELACJI Z KLIENTEM" — ton komunikacji, empatia, budowanie zaufania, indywidualne podejście. Unikaj powtórzeń z sekcji o formie wypowiedzi.$df$,
  true, true
);

-- ── 5. communication_cycle ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'communication_cycle', 'profile', 'Skuteczność komunikacji w cyklu sprawy', 5,
  $sys$Jesteś analitykiem procesów obsługi w administracji nieruchomości. Oceniasz efektywność całego cyklu komunikacji od zgłoszenia do rozwiązania. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem skuteczności całego cyklu komunikacji. Oceń:

- **Liczba wymian**: Ile wiadomości było potrzebnych do rozwiązania/obsługi sprawy? Czy można było załatwić to mniejszą liczbą wymian?
- **Ciągłość prowadzenia sprawy**: Czy ten sam pracownik prowadzi temat od początku do końca, czy sprawa jest „przerzucana" między osobami?
- **Spójność informacji**: Czy w kolejnych wiadomościach nie ma sprzeczności, powtórzeń lub luk informacyjnych?
- **Status rozwiązania**: Czy sprawa została zamknięta? Jeśli nie — na jakim etapie utknęła?

WĄTEK:
{{threads}}

Opisz przebieg cyklu sprawy i oceń jego efektywność.$usr$,
  $sf$Wymiar "5. CYKL KOMUNIKACJI". Oceń liczbę wymian do rozwiązania, ciągłość prowadzenia sprawy, status zamknięcia. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. WAŻNE: Rekomendacje podaj WYŁĄCZNIE w sekcji 13. Tutaj skup się na obserwacjach. Skup się na wymiarze "5. CYKL KOMUNIKACJI" — liczba wymian potrzebnych do rozwiązania, ciągłość prowadzenia sprawy (ten sam pracownik?), status rozwiązania. Unikaj powtórzeń z sekcji o efektywności.$df$,
  true, true
);

-- ── 6. client_feedback ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'client_feedback', 'profile', 'Satysfakcja i feedback klientów', 6,
  $sys$Jesteś analitykiem satysfakcji klienta w zarządzaniu nieruchomościami. Analizujesz sygnały zadowolenia lub niezadowolenia mieszkańców. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem sygnałów satysfakcji lub niezadowolenia mieszkańca. Szukaj:

- **Pozytywny feedback**: Podziękowania, wyrazy uznania, zadowolenie z obsługi
- **Negatywny feedback**: Skargi, frustracja, niezadowolenie, groźby eskalacji
- **Ton emocjonalny mieszkańca**: Jak zmienia się ton w kolejnych wiadomościach — poprawia się czy pogarsza?
- **Sygnały pośrednie**: Zwięzłe odpowiedzi mogące świadczyć o zniecierpliwieniu, wielokrotne ponaglenia, brak odpowiedzi na propozycje

UWAGA: Bazuj wyłącznie na treści emaili — nie mamy dostępu do ankiet satysfakcji ani rozmów telefonicznych.

WĄTEK:
{{threads}}

Opisz zaobserwowane sygnały satysfakcji/niezadowolenia z konkretnymi przykładami.$usr$,
  $sf$Wymiar "6. SATYSFAKCJA KLIENTA". Oceń sygnały zadowolenia/niezadowolenia, zmiany tonu, ponaglenia. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. Skup się na wymiarze "6. SATYSFAKCJA KLIENTA" — sygnały zadowolenia/niezadowolenia, zmiana tonu w kolejnych wiadomościach, ponaglenia. Bazuj WYŁĄCZNIE na treści emaili.$df$,
  true, true
);

-- ── 7. expression_form ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'expression_form', 'profile', 'Użyta forma wypowiedzi', 7,
  $sys$Jesteś lingwistą i ekspertem ds. komunikacji biznesowej. Analizujesz formę językową korespondencji administracji nieruchomości. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj formę wypowiedzi administracji w poniższym wątku. Oceń szczegółowo:

**7.1. Język i styl:**
- Styl: formalny, półformalny czy nieformalny?
- Poprawność stylistyczna i gramatyczna — czy są rażące błędy ortograficzne lub gramatyczne?
- Obecność emocji: czy pojawiają się przeprosiny? Kto przeprasza i za co?
- Czy użyto zwrotów grzecznościowych?

**7.2. Powitania i zwroty grzecznościowe:**
- Czy wiadomość zawiera powitanie?
- Typ: formalne („Szanowni Państwo"), półformalne („Dzień dobry") czy personalne („Pani Wiolu")?
- Czy brak powitania wynika z kontekstu (kontynuacja wątku) czy z braku staranności?

**7.3. Konsekwencja komunikacji:**
- Czy w wątku zachowany jest spójny styl?
- Czy następują gwałtowne zmiany tonu (np. od „Szanowni Państwo" do „Cześć")?
- Czy ton odpowiedzi jest dopasowany do stylu klienta?

**7.4. Personalizacja:**
- Czy nadawca użył imienia/nazwiska adresata?
- Czy personalizacja jest adekwatna do kontekstu (indywidualna sprawa vs. komunikat masowy)?

**7.5. Stopień formalności:**
- Czy poziom formalności jest dopasowany do sytuacji (oficjalne pismo = formalny, szybka odpowiedź techniczna = neutralny)?

**7.6. Zwroty końcowe:**
- Czy wiadomość kończy się uprzejmym zwrotem („Z poważaniem", „Pozdrawiam")?
- Czy zakończenie jest spójne ze stylem rozpoczęcia?

WĄTEK:
{{threads}}

Oceń każdy z powyższych aspektów z konkretnymi przykładami z wątku.$usr$,
  $sf$Wymiar "7. FORMA WYPOWIEDZI". Oceń styl (formalność), powitania, personalizację, zwroty końcowe, spójność. Max 3-4 zdania.$sf$,
  $df$Skup się na wymiarze "7. FORMA WYPOWIEDZI".

WYMAGANA STRUKTURA Z PODSEKCJAMI:

## 7.1. Język i styl
Styl: formalny/półformalny/nieformalny. Poprawność gramatyczna i stylistyczna. Emocje (przeprosiny). Zwroty grzecznościowe.

## 7.2. Powitania i zwroty grzecznościowe
Obecność powitania. Typ: formalny/półformalny/personalny. Brak powitania — przyczyna?

## 7.3. Konsekwencja komunikacji
Spójność stylu w wątkach. Zmiany tonu. Dopasowanie do stylu klienta.

## 7.4. Personalizacja
Użycie imienia/nazwiska. Adekwatność do kontekstu.

## 7.5. Stopień formalności
Dopasowanie do sytuacji (oficjalne pismo = formalny, szybka odpowiedź techniczna = neutralny).

## 7.6. Zwroty końcowe
Obecność i jakość. Spójność z tonem rozpoczęcia.$df$,
  true, true
);

-- ── 8. recipient_clarity ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'recipient_clarity', 'profile', 'Jasność i komfort odbiorcy', 8,
  $sys$Jesteś ekspertem ds. UX komunikacji pisemnej. Oceniasz, jak odbiorca (mieszkaniec) postrzega komunikację administracji. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem jasności i komfortu odbiorcy. Oceń:

- **Przejrzystość**: Czy komunikacja jest zrozumiała, logicznie uporządkowana i łatwa do śledzenia?
- **Profesjonalizm**: Czy forma wiadomości buduje zaufanie i poczucie kompetencji?
- **Indywidualne traktowanie**: Czy mieszkaniec czuje, że jego sprawa jest ważna i traktowana poważnie?
- **Brak elementów negatywnych**: Czy nie ma elementów, które mogłyby być odebrane jako lekceważące, chaotyczne, mało profesjonalne lub zniechęcające?
- **Czytelność struktury**: Czy wiadomości są odpowiednio sformatowane (akapity, punkty), czy są „ścianą tekstu"?

WĄTEK:
{{threads}}

Oceń jasność komunikacji z perspektywy mieszkańca i podaj konkretne przykłady.$usr$,
  $sf$Wymiar "8. JASNOŚĆ KOMUNIKACJI". Oceń przejrzystość, czytelność struktury, profesjonalizm. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. Skup się na wymiarze "8. JASNOŚĆ KOMUNIKACJI" — przejrzystość, czytelność struktury, profesjonalizm, brak elementów negatywnych. Unikaj powtórzeń z sekcji o formie wypowiedzi.$df$,
  true, true
);

-- ── 9. organization_consistency ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'organization_consistency', 'profile', 'Spójność komunikacji w organizacji', 9,
  $sys$Jesteś konsultantem ds. standardów komunikacji organizacyjnej w zarządzaniu nieruchomościami. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem spójności komunikacji organizacyjnej. Oceń:

- **Styl pracowników**: Jeśli w wątku występuje więcej niż jeden pracownik administracji — czy stosują podobny poziom formalności i strukturę wiadomości?
- **Standardy organizacyjne**: Czy widoczne są jednolite standardy (np. stały format powitania, podpis, struktura odpowiedzi)?
- **Różnice**: Czy występują różnice, które mogą być odebrane jako brak standardów w organizacji?
- **Podpisy i stopki**: Czy wiadomości zawierają spójne podpisy z danymi kontaktowymi?

WĄTEK:
{{threads}}

Opisz zaobserwowane wzorce i różnice w komunikacji pracowników.$usr$,
  $sf$Wymiar "9. SPÓJNOŚĆ ORGANIZACYJNA". Oceń jednolitość standardów, podpisów, formatów między pracownikami/działami. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. Skup się na wymiarze "9. SPÓJNOŚĆ ORGANIZACYJNA" — jednolite standardy między pracownikami, spójne podpisy, format wiadomości, różnice między działami.$df$,
  true, true
);

-- ── 10. proactive_actions ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'proactive_actions', 'profile', 'Proaktywne działania administracji', 10,
  $sys$Jesteś ekspertem ds. zarządzania proaktywnego w administracji nieruchomości. Oceniasz inicjatywność zespołu. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem proaktywności administracji. Oceń:

- **Inicjatywa własna**: Czy administracja sama wychodzi z inicjatywą (np. informuje o planowanych pracach, zmianach, terminach)?
- **Przypominanie o procedurach**: Czy zespół przypomina mieszkańcom o ważnych procedurach i terminach?
- **Dbanie o bezpieczeństwo danych**: Czy proaktywnie zwraca uwagę na kwestie ochrony danych?
- **Monitorowanie postępów**: Czy administracja monitoruje postępy zgłoszeń (np. u Robyg) i informuje mieszkańców o statusie bez czekania na pytanie?
- **Zapobieganie problemom**: Czy widoczne są działania prewencyjne, a nie tylko reaktywne?

WĄTEK:
{{threads}}

Opisz zaobserwowane przejawy proaktywności lub ich brak z konkretnymi przykładami.$usr$,
  $sf$Wymiar "10. PROAKTYWNOŚĆ". Oceń inicjatywę własną, przypominanie o procedurach, monitorowanie postępów. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. WAŻNE: Rekomendacje podaj WYŁĄCZNIE w sekcji 13. Tutaj skup się na obserwacjach. Skup się na wymiarze "10. PROAKTYWNOŚĆ" — inicjatywa własna, przypominanie o procedurach, monitorowanie postępów, zapobieganie problemom. Unikaj powtórzeń z sekcji o efektywności.$df$,
  true, true
);

-- ── 11. internal_communication ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'internal_communication', 'profile', 'Komunikacja wewnętrzna', 11,
  $sys$Jesteś ekspertem ds. komunikacji wewnętrznej w organizacjach zarządzających nieruchomościami. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem komunikacji wewnętrznej w organizacji. Oceń:

- **Przepływ informacji**: Jak wygląda przekazywanie informacji wewnątrz firmy? Czy widać sprawny obieg informacji między pracownikami?
- **Współpraca między działami**: Jak przebiega współpraca (np. administracja ↔ dział techniczny, administracja ↔ deweloper)?
- **Delegowanie zadań**: Czy zadania są jasno delegowane? Czy widać kto za co odpowiada?
- **RODO w komunikacji wewnętrznej**: Czy w wewnętrznej korespondencji (CC, przekazywanie) przestrzegane są zasady ochrony danych (UDW, brak ujawniania danych mieszkańców niepotrzebnym osobom)?

UWAGA: Oceniaj na podstawie widocznych w wątku śladów komunikacji wewnętrznej (np. CC do współpracowników, przekazywanie wiadomości, odwoływanie się do ustaleń wewnętrznych).

WĄTEK:
{{threads}}

Opisz zaobserwowane wzorce komunikacji wewnętrznej.$usr$,
  $sf$Wymiar "11. KOMUNIKACJA WEWNĘTRZNA". Oceń przepływ informacji, współpracę między działami, stosowanie CC/UDW. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. Skup się na wymiarze "11. KOMUNIKACJA WEWNĘTRZNA" — przepływ informacji, współpraca między działami, delegowanie zadań, RODO w komunikacji wewnętrznej (CC/UDW).$df$,
  true, false
);

-- ── 12. data_security ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'data_security', 'profile', 'Bezpieczeństwo danych (RODO)', 12,
  $sys$Jesteś ekspertem ds. ochrony danych osobowych (RODO/GDPR) w kontekście zarządzania nieruchomościami. Identyfikujesz dobre i złe praktyki. Odpowiadasz po polsku.$sys$,
  $usr$Przeanalizuj poniższy wątek email pod kątem bezpieczeństwa danych i zgodności z RODO. Oceń:

- **Stosowanie UDW**: Czy przy korespondencji do wielu odbiorców użyto UDW (ukrytej kopii) zamiast jawnych list adresowych?
- **Ochrona danych osobowych**: Czy w korespondencji nie ujawniono niepotrzebnie danych osobowych (PESEL, numery kont, adresy, numery lokali) osobom trzecim?
- **Właściwa forma odpowiedzi**: Czy dane osobowe mieszkańca nie trafiły do niewłaściwych odbiorców przez CC/odpowiedź do wszystkich?
- **Powoływanie się na przepisy**: Czy w razie potrzeby administracja powołuje się na przepisy o ochronie danych osobowych?
- **Procedury wewnętrzne**: Czy widać przestrzeganie wewnętrznych procedur ochrony danych?

Podaj konkretne **przykłady poprawnych praktyk** (co zrobiono dobrze) oraz **niepoprawnych praktyk** (co wymaga korekty).

WĄTEK:
{{threads}}

Opisz zaobserwowane praktyki z oceną i rekomendacjami.$usr$,
  $sf$Wymiar "12. BEZPIECZEŃSTWO DANYCH (RODO)". Oceń stosowanie UDW, ochronę danych osobowych, procedury wewnętrzne. Max 3-4 zdania.$sf$,
  $df$NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. Skup się na wymiarze "12. BEZPIECZEŃSTWO DANYCH (RODO)" — stosowanie UDW, ochrona danych osobowych, właściwa forma odpowiedzi, procedury wewnętrzne. Podaj przykłady dobrych i złych praktyk.$df$,
  true, true
);

-- ── 13. recommendations ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'),
  'recommendations', 'profile', 'Rekomendacje i działania usprawniające', 13,
  $sys$Jesteś konsultantem ds. poprawy jakości zarządzania nieruchomościami. Formułujesz konkretne, wykonalne rekomendacje. Odpowiadasz po polsku.$sys$,
  $usr$Na podstawie analizy poniższego wątku, sformułuj konkretne rekomendacje. Uwzględnij:

- **Procesy**: Jakie procedury warto wdrożyć lub usprawnić?
- **Szkolenia**: Jakie szkolenia mogą być potrzebne (komunikacja, RODO, obsługa klienta)?
- **Narzędzia**: Jakie narzędzia mogłyby pomóc (szablony odpowiedzi, system ticketowy, checklisty)?
- **Odpowiedzialność**: Kto powinien być odpowiedzialny za wdrożenie (administracja, zarządca, dział IT)?
- **Priorytety**: Oznacz każdą rekomendację priorytetem:
  - Pilne (do wdrożenia natychmiast)
  - Krótkoterminowe (1-3 miesiące)
  - Długoterminowe (3-12 miesięcy)

WĄTEK:
{{threads}}

Sformułuj 3-5 rekomendacji z uzasadnieniem i priorytetem. Bądź konkretny — unikaj ogólników.$usr$,
  $sf$Zbierz i skonsoliduj TOP 5-7 rekomendacji ze WSZYSTKICH wymiarów analizy.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Kategoria |
|---|---|---|---|
| 1 | Opis... | Pilne / Krótkoterminowe / Długoterminowe | Procesy / Szkolenia / Narzędzia |

NIE powtarzaj tych samych rekomendacji (SLA/CRM/ticketing) wielokrotnie — skonsoliduj podobne.
Po tabeli dodaj 1-2 zdania o najważniejszych priorytetach strategicznych.$sf$,
  $df$Zbierz i zsyntezuj rekomendacje ze WSZYSTKICH wymiarów analizy. Skonsoliduj podobne rekomendacje — NIE powtarzaj tych samych (SLA/CRM/ticketing) wielokrotnie.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Odpowiedzialny | Kategoria |
|---|---|---|---|---|
| 1 | Opis rekomendacji... | Pilne / Krótkoterminowe / Długoterminowe | Kto odpowiada | Procesy / Szkolenia / Narzędzia |

Priorytety: **Pilne** (natychmiast), **Krótkoterminowe** (1-3 mies.), **Długoterminowe** (3-12 mies.).
Grupuj: najpierw Pilne, potem Krótkoterminowe, potem Długoterminowe.

Po tabeli dodaj krótki akapit z 3 najważniejszymi priorytetami strategicznymi.$df$,
  true, true
);

-- ============================================
-- PART 4: SEED CASE_ANALYTICS SECTIONS
-- (6 rows: case_metadata through case_recommendations)
-- ============================================

-- ── 1. case_metadata ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'case_analytics'),
  'case_metadata', 'profile', 'Metadane analizy zgłoszeń', 1,
  '', '',
  $sf$Wymiar "1. METADANE". Podaj: zakres dat, liczbę zgłoszeń, główne lokalizacje, główne typy spraw. Max 3-4 zdania.$sf$,
  $df$Wyodrębnij metadane analizy zgłoszeniowej.

WYMAGANE ELEMENTY:
- **Zakres dat**: najstarsza i najnowsza wiadomość
- **Łączna liczba zgłoszeń** (wątków)
- **Łączna liczba wiadomości**
- **Główne lokalizacje**: lista z liczbą zgłoszeń per lokalizacja
- **Główni uczestnicy**: role (mieszkańcy, administracja, deweloper, firmy)
- **Ograniczenia**: czego nie można ocenić z samych emaili

Napisz w formie listy z pogrubionymi etykietami.$df$,
  true, true
);

-- ── 2. case_geography ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'case_analytics'),
  'case_geography', 'profile', 'Rozkład geograficzny zgłoszeń', 2,
  '', '',
  $sf$Wymiar "2. LOKALIZACJA". Podaj rozkład zgłoszeń per lokalizacja/inwestycja. Które lokalizacje generują najwięcej zgłoszeń? Max 3-4 zdania.$sf$,
  $df$Przeanalizuj rozkład geograficzny zgłoszeń.

WYMAGANA STRUKTURA:

## Rozkład per lokalizacja
Podaj tabelę markdown:

| Lokalizacja/Inwestycja | Liczba zgłoszeń | % | Główne problemy |
|---|---|---|---|

## Analiza hot-spotów
Które lokalizacje generują nieproporcjonalnie dużo zgłoszeń? Czy widać wzorce (np. nowe inwestycje vs. starsze)?

## Zgłoszenia bez zidentyfikowanej lokalizacji
Ile zgłoszeń nie udało się przypisać do lokalizacji? Dlaczego?$df$,
  true, true
);

-- ── 3. case_stages ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'case_analytics'),
  'case_stages', 'profile', 'Etapy procesu zgłoszeniowego', 3,
  '', '',
  $sf$Wymiar "3. ETAPY PROCESU". Podaj rozkład zgłoszeń per etap (nowe/w realizacji/zamknięte). Ile spraw jest otwartych? Max 3-4 zdania.$sf$,
  $df$Przeanalizuj etapy procesu zgłoszeniowego.

WYMAGANA STRUKTURA:

## Rozkład per etap
Podaj tabelę markdown:

| Etap procesu | Liczba zgłoszeń | % |
|---|---|---|
| Nowe zgłoszenie | N | X% |
| Przyjęte | N | X% |
| W realizacji | N | X% |
| Oczekiwanie na odpowiedź | N | X% |
| Zamknięte pozytywnie | N | X% |
| Zamknięte negatywnie | N | X% |
| Eskalowane | N | X% |

## Analiza przepływu
Jaki % zgłoszeń jest rozwiązywany? Średni czas od zgłoszenia do zamknięcia? Bottlenecki w procesie?

## Sprawy otwarte wymagające uwagi
Wymień sprawy, które są otwarte najdłużej lub mają status "eskalowane".$df$,
  true, true
);

-- ── 4. case_types ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'case_analytics'),
  'case_types', 'profile', 'Typologie zgłoszeń', 4,
  '', '',
  $sf$Wymiar "4. TYPY ZGŁOSZEŃ". Podaj rozkład typów (usterki/reklamacje/pytania/skargi). Który typ dominuje? Max 3-4 zdania.$sf$,
  $df$Przeanalizuj typy zgłoszeń.

WYMAGANA STRUKTURA:

## Rozkład per typ zgłoszenia
Podaj tabelę markdown:

| Typ zgłoszenia | Liczba | % | Główne lokalizacje |
|---|---|---|---|
| Usterka techniczna | N | X% | ... |
| Reklamacja gwarancyjna | N | X% | ... |
| Pytanie/informacja | N | X% | ... |
| Skarga | N | X% | ... |
| Procedura administracyjna | N | X% | ... |

## Trendy i wzorce
Czy widać dominację jednego typu? Korelacja między typem a lokalizacją? Sezonowość?

## Typ vs. etap procesu
Które typy zgłoszeń najczęściej utykają na etapie "w realizacji"? Które są zamykane najszybciej?$df$,
  true, true
);

-- ── 5. case_problems ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'case_analytics'),
  'case_problems', 'profile', 'Analiza problemów technicznych', 5,
  '', '',
  $sf$Wymiar "5. KATEGORIE PROBLEMÓW". Podaj najczęstsze kategorie problemów (wod-kan, elektryka, stolarka, elewacja). Które wymagają pilnej uwagi? Max 3-4 zdania.$sf$,
  $df$Przeanalizuj kategorie problemów technicznych.

WYMAGANA STRUKTURA:

## Rozkład per kategoria problemu
Podaj tabelę markdown (TYLKO dla usterek/reklamacji):

| Kategoria problemu | Liczba | % | Lokalizacje |
|---|---|---|---|
| Instalacja wodno-kanalizacyjna | N | X% | ... |
| Instalacja elektryczna | N | X% | ... |
| Stolarka okienno-drzwiowa | N | X% | ... |
| Elewacja/izolacja | N | X% | ... |
| Części wspólne | N | X% | ... |
| Teren zewnętrzny | N | X% | ... |

## Problemy systemowe
Czy widać powtarzające się problemy w konkretnych lokalizacjach? Czy wskazuje to na wadę systemową (np. seria okien, partia materiałów)?

## Ocena pilności
Które problemy wymagają natychmiastowej interwencji? Które mogą poczekać?$df$,
  true, true
);

-- ── 6. case_recommendations ──
INSERT INTO prompt_templates (
  profile_id, section_key, tier, title, section_order,
  system_prompt, user_prompt_template,
  synthetic_focus, standard_focus,
  in_internal_report, in_client_report
) VALUES (
  (SELECT id FROM analysis_profiles WHERE slug = 'case_analytics'),
  'case_recommendations', 'profile', 'Rekomendacje', 6,
  '', '',
  $sf$Zbierz TOP 5 rekomendacji ze WSZYSTKICH wymiarów analizy zgłoszeniowej.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Kategoria |
|---|---|---|---|
| 1 | Opis... | Pilne / Krótkoterminowe / Długoterminowe | Proces / Techniczny / Organizacyjny |

Po tabeli 1-2 zdania o priorytetach strategicznych.$sf$,
  $df$Zbierz i zsyntezuj rekomendacje ze WSZYSTKICH wymiarów analizy zgłoszeniowej.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Odpowiedzialny | Kategoria |
|---|---|---|---|---|
| 1 | Opis rekomendacji... | Pilne / Krótkoterminowe / Długoterminowe | Kto odpowiada | Proces / Techniczny / Organizacyjny |

Priorytety: **Pilne** (natychmiast), **Krótkoterminowe** (1-3 mies.), **Długoterminowe** (3-12 mies.).
Grupuj: najpierw Pilne, potem Krótkoterminowe, potem Długoterminowe.

Po tabeli dodaj:
1. Akapit o najważniejszych lokalizacjach wymagających uwagi
2. Akapit o problemach systemowych (jeśli zidentyfikowane)
3. 3 najważniejsze priorytety strategiczne$df$,
  true, true
);

-- ============================================
-- PART 5: DATA MIGRATION
-- ============================================

-- 5.1 Set default_profile_id on mailboxes based on existing analysis_profile TEXT
UPDATE mailboxes SET default_profile_id = ap.id
FROM analysis_profiles ap
WHERE ap.slug = mailboxes.analysis_profile;

-- 5.2 Set analysis_profile_id on analysis_jobs based on existing analysis_profile TEXT
UPDATE analysis_jobs SET analysis_profile_id = ap.id
FROM analysis_profiles ap
WHERE ap.slug = analysis_jobs.analysis_profile;

-- 5.3 Set default for mailboxes without analysis_profile (should not happen, but safety)
UPDATE mailboxes SET default_profile_id = (
  SELECT id FROM analysis_profiles WHERE slug = 'communication_audit'
)
WHERE default_profile_id IS NULL;

-- ============================================
-- PART 6: RLS, TRIGGERS, INDEXES
-- ============================================

-- 6.1 RLS
ALTER TABLE analysis_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage analysis_profiles" ON analysis_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM app_allowed_users WHERE user_id = auth.uid() AND role = 'admin'));

-- 6.2 Updated_at trigger (reuse existing function if it exists)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER set_analysis_profiles_updated_at
  BEFORE UPDATE ON analysis_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- 6.3 Additional indexes
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_profile ON analysis_jobs(analysis_profile_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_profile ON mailboxes(default_profile_id);
