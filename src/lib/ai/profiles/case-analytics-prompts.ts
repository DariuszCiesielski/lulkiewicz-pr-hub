/**
 * Case Analytics — thread analysis prompt.
 *
 * Zamiast 13 wymiarów jakości komunikacji, wyodrębniamy dane zgłoszeniowe:
 * lokalizacja, etap procesu, typ zgłoszenia, kategoria problemu, status.
 *
 * Używany przez profil `case_analytics` (np. skrzynka Rzecznik Robyg).
 */

export const CASE_THREAD_SUMMARY_SECTION_KEY = '_case_thread_summary';

export const CASE_THREAD_SYSTEM_PROMPT = `Jesteś ekspertem ds. analityki zgłoszeniowej w zarządzaniu nieruchomościami.
Analizujesz korespondencję email dotyczącą zgłoszeń, reklamacji i spraw kierowanych do rzecznika dewelopera.
Odpowiadasz po polsku, zwięźle i strukturalnie.`;

export const CASE_THREAD_USER_PROMPT_TEMPLATE = `Przeanalizuj poniższy wątek email i wyodrębnij dane zgłoszeniowe. Dla każdego wymiaru podaj konkretne informacje.

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

Odpowiedz w formacie: dla każdego wymiaru nagłówek "## N. NAZWA" i konkretne informacje. Bądź precyzyjny — podawaj daty, lokalizacje, numery lokali.`;
