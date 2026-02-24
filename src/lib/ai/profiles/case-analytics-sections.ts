/**
 * Case Analytics — 6 sekcji raportu.
 *
 * Zamiast 13 sekcji jakości komunikacji, mamy 6 sekcji analityki zgłoszeniowej:
 * 1. Metadane analizy
 * 2. Rozkład geograficzny
 * 3. Etapy procesu
 * 4. Typologie zgłoszeń
 * 5. Analiza problemów
 * 6. Rekomendacje
 */

import type { ProfileReportSection } from '@/lib/ai/analysis-profiles';

export const CASE_ANALYTICS_SECTIONS: ProfileReportSection[] = [
  {
    section_key: 'case_metadata',
    title: 'Metadane analizy zgłoszeń',
    section_order: 1,
    inClientReport: true,
    syntheticFocus: `Wymiar "1. METADANE". Podaj w formie listy z pogrubionymi etykietami:
- **Zakres dat**: najstarsza i najnowsza wiadomość
- **Łączna liczba zgłoszeń** (wątków) i wiadomości
- **Główne lokalizacje**: rozkład zgłoszeń per lokalizacja (z liczbami)
- **Główne typy spraw**: rozkład procentowy lub liczbowy
- **Główni uczestnicy**: role (mieszkańcy, administracja, deweloper)
- **Ograniczenia**: czego nie można ocenić z samych emaili`,
    standardFocus: `Wyodrębnij metadane analizy zgłoszeniowej.

WYMAGANE ELEMENTY:
- **Zakres dat**: najstarsza i najnowsza wiadomość
- **Łączna liczba zgłoszeń** (wątków)
- **Łączna liczba wiadomości**
- **Główne lokalizacje**: lista z liczbą zgłoszeń per lokalizacja
- **Główni uczestnicy**: role (mieszkańcy, administracja, deweloper, firmy)
- **Ograniczenia**: czego nie można ocenić z samych emaili

Napisz w formie listy z pogrubionymi etykietami.`,
  },
  {
    section_key: 'case_geography',
    title: 'Rozkład geograficzny zgłoszeń',
    section_order: 2,
    inClientReport: true,
    syntheticFocus: `Wymiar "2. LOKALIZACJA". Podaj tabelę markdown z rozkładem zgłoszeń per lokalizacja:

| Lokalizacja | Liczba zgłoszeń | % | Główne problemy |
|---|---|---|---|

Po tabeli 2-3 zdania: które lokalizacje generują nieproporcjonalnie dużo zgłoszeń, widoczne wzorce.`,
    standardFocus: `Przeanalizuj rozkład geograficzny zgłoszeń.

WYMAGANA STRUKTURA:

## Rozkład per lokalizacja
Podaj tabelę markdown:

| Lokalizacja/Inwestycja | Liczba zgłoszeń | % | Główne problemy |
|---|---|---|---|

## Analiza hot-spotów
Które lokalizacje generują nieproporcjonalnie dużo zgłoszeń? Czy widać wzorce (np. nowe inwestycje vs. starsze)?

## Zgłoszenia bez zidentyfikowanej lokalizacji
Ile zgłoszeń nie udało się przypisać do lokalizacji? Dlaczego?`,
  },
  {
    section_key: 'case_stages',
    title: 'Etapy procesu zgłoszeniowego',
    section_order: 3,
    inClientReport: true,
    syntheticFocus: `Wymiar "3. ETAPY PROCESU". Podaj dwie zwięzłe tabele markdown:

1) Etap relacji z deweloperem:
| Etap relacji | Liczba | % |
|---|---|---|

2) Status rozpatrzenia:
| Status | Liczba | % |
|---|---|---|

Po tabelach 2-3 zdania: jaki % zgłoszeń rozwiązany, bottlenecki, sprawy otwarte najdłużej.`,
    standardFocus: `Przeanalizuj etapy procesu zgłoszeniowego w dwóch wymiarach.

WYMAGANA STRUKTURA:

## Etap relacji z deweloperem
Podaj tabelę markdown:

| Etap relacji | Liczba zgłoszeń | % | Główne typy spraw |
|---|---|---|---|
| Przedsprzedażowy | N | X% | ... |
| Posprzedażowy — odbiór | N | X% | ... |
| Posprzedażowy — gwarancja | N | X% | ... |
| Posprzedażowy — eksploatacja | N | X% | ... |
| Nie określono | N | X% | ... |

## Status rozpatrzenia zgłoszeń
Podaj tabelę markdown:

| Status rozpatrzenia | Liczba zgłoszeń | % |
|---|---|---|
| Nowe zgłoszenie | N | X% |
| Przyjęte | N | X% |
| W realizacji | N | X% |
| Oczekiwanie na odpowiedź | N | X% |
| Zamknięte pozytywnie | N | X% |
| Zamknięte negatywnie | N | X% |
| Eskalowane | N | X% |

## Analiza przepływu
Jaki % zgłoszeń jest rozwiązywany? Który etap relacji generuje najdłużej otwarte sprawy? Bottlenecki w procesie?

## Sprawy otwarte wymagające uwagi
Wymień sprawy, które są otwarte najdłużej lub mają status "eskalowane".`,
  },
  {
    section_key: 'case_types',
    title: 'Typologie zgłoszeń',
    section_order: 4,
    inClientReport: true,
    syntheticFocus: `Wymiar "4. TYPY ZGŁOSZEŃ". Podaj tabelę markdown z rozkładem typów zgłoszeń:

| Typ zgłoszenia | Liczba | % | Główne lokalizacje |
|---|---|---|---|

Po tabeli 2-3 zdania: dominujące typy, korelacja z lokalizacją, wzorce.`,
    standardFocus: `Przeanalizuj typy zgłoszeń.

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
| Sprawa przedsprzedażowa | N | X% | ... |

## Trendy i wzorce
Czy widać dominację jednego typu? Korelacja między typem a lokalizacją? Sezonowość?

## Typ vs. etap procesu
Które typy zgłoszeń najczęściej utykają na etapie "w realizacji"? Które są zamykane najszybciej?`,
  },
  {
    section_key: 'case_problems',
    title: 'Analiza problemów technicznych',
    section_order: 5,
    inClientReport: true,
    syntheticFocus: `Wymiar "5. KATEGORIE PROBLEMÓW". Podaj tabelę markdown (TYLKO usterki/reklamacje):

| Kategoria problemu | Liczba | % | Lokalizacje |
|---|---|---|---|

Po tabeli 2-3 zdania: problemy systemowe, powtarzające się wzorce, ocena pilności — które wymagają natychmiastowej interwencji.`,
    standardFocus: `Przeanalizuj kategorie problemów technicznych.

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
| Wykończenie wnętrz | N | X% | ... |

## Problemy systemowe
Czy widać powtarzające się problemy w konkretnych lokalizacjach? Czy wskazuje to na wadę systemową (np. seria okien, partia materiałów)?

## Ocena pilności
Które problemy wymagają natychmiastowej interwencji? Które mogą poczekać?`,
  },
  {
    section_key: 'case_recommendations',
    title: 'Rekomendacje',
    section_order: 6,
    inClientReport: true,
    syntheticFocus: `Zbierz TOP 5 rekomendacji ze WSZYSTKICH wymiarów analizy zgłoszeniowej.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Kategoria |
|---|---|---|---|
| 1 | Opis... | Pilne / Krótkoterminowe / Długoterminowe | Proces / Techniczny / Organizacyjny |

Po tabeli 1-2 zdania o priorytetach strategicznych.`,
    standardFocus: `Zbierz i zsyntezuj rekomendacje ze WSZYSTKICH wymiarów analizy zgłoszeniowej.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Odpowiedzialny | Kategoria |
|---|---|---|---|---|
| 1 | Opis rekomendacji... | Pilne / Krótkoterminowe / Długoterminowe | Kto odpowiada | Proces / Techniczny / Organizacyjny |

Priorytety: **Pilne** (natychmiast), **Krótkoterminowe** (1-3 mies.), **Długoterminowe** (3-12 mies.).
Grupuj: najpierw Pilne, potem Krótkoterminowe, potem Długoterminowe.

Po tabeli dodaj:
1. Akapit o najważniejszych lokalizacjach wymagających uwagi
2. Akapit o problemach systemowych (jeśli zidentyfikowane)
3. 3 najważniejsze priorytety strategiczne`,
  },
];
