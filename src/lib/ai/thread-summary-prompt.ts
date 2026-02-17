/**
 * Comprehensive thread summary prompt — replaces 14 individual section prompts.
 * One AI call per thread produces a structured summary covering all dimensions.
 *
 * The analysis phase stores ONE row per thread in analysis_results (section_key = '_thread_summary').
 * The report phase then synthesizes all thread summaries into 14 report sections.
 */

export const THREAD_SUMMARY_SECTION_KEY = '_thread_summary';

export const THREAD_SUMMARY_SYSTEM_PROMPT = `Jesteś ekspertem ds. zarządzania nieruchomościami i audytu jakości komunikacji.
Analizujesz korespondencję email między administracją osiedla a mieszkańcami, deweloperem i firmami zewnętrznymi.
Odpowiadasz po polsku, zwięźle i strukturalnie.`;

export const THREAD_SUMMARY_USER_PROMPT_TEMPLATE = `Przeanalizuj poniższy wątek email i sporządź kompleksowe podsumowanie pokrywające WSZYSTKIE poniższe wymiary.
Dla każdego wymiaru napisz 2-4 zdania z konkretnymi obserwacjami.

## WYMIARY DO OCENY:

**1. METADANE**: Typ sprawy (awaria/reklamacja/pytanie/informacja/procedura), uczestnicy i ich role, liczba wiadomości, zakres dat.

**2. SZYBKOŚĆ REAKCJI**: Czas od zgłoszenia do pierwszej odpowiedzi, szybkość przekazania do odpowiedniego działu. Czy zastosowano potwierdzenie odbioru?

**3. EFEKTYWNOŚĆ OBSŁUGI**: Czy odpowiedź kończy temat? Czy wszystkie dane przekazano za pierwszym razem? Czy zaproponowano kolejne kroki?

**4. JAKOŚĆ RELACJI Z KLIENTEM**: Ton komunikacji (empatyczny/neutralny/chłodny), budowanie zaufania, elementy troski, indywidualne podejście.

**5. CYKL KOMUNIKACJI**: Liczba wymian potrzebnych do rozwiązania, ciągłość prowadzenia sprawy (ten sam pracownik?), spójność informacji, status rozwiązania.

**6. SATYSFAKCJA KLIENTA**: Sygnały zadowolenia lub niezadowolenia, zmiana tonu w kolejnych wiadomościach, ponaglenia.

**7. FORMA WYPOWIEDZI**: Styl (formalny/półformalny/nieformalny), poprawność językowa, powitania, zwroty końcowe, personalizacja, konsekwencja stylu.

**8. JASNOŚĆ KOMUNIKACJI**: Przejrzystość, czytelność struktury, profesjonalizm, brak elementów negatywnych.

**9. SPÓJNOŚĆ ORGANIZACYJNA**: Jednolite standardy między pracownikami, spójne podpisy, format wiadomości.

**10. PROAKTYWNOŚĆ**: Inicjatywa własna, przypominanie o procedurach, monitorowanie postępów, zapobieganie problemom.

**11. KOMUNIKACJA WEWNĘTRZNA**: Przepływ informacji, współpraca między działami, delegowanie zadań, RODO w komunikacji wewnętrznej (CC/UDW).

**12. BEZPIECZEŃSTWO DANYCH (RODO)**: Stosowanie UDW, ochrona danych osobowych, właściwa forma odpowiedzi, procedury wewnętrzne.

**13. REKOMENDACJE**: 2-3 najważniejsze rekomendacje wynikające z tego wątku (procesy, szkolenia, narzędzia) z priorytetem (pilne/krótkoterminowe/długoterminowe).

WĄTEK:
{{threads}}

Odpowiedz w formacie: dla każdego wymiaru nagłówek "## N. NAZWA" i 2-4 zdania. Bądź konkretny — podawaj daty, cytaty, role uczestników.`;
