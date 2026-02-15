/**
 * Default prompt templates for the 7 report sections.
 * These serve as the "default" tier — can be overridden by global or per-report.
 */

export interface DefaultPrompt {
  section_key: string;
  title: string;
  section_order: number;
  system_prompt: string;
  user_prompt_template: string;
}

export const DEFAULT_PROMPTS: DefaultPrompt[] = [
  {
    section_key: '_global_context',
    title: 'Kontekst globalny raportu',
    section_order: 0,
    system_prompt: `Jestes ekspertem ds. zarzadzania nieruchomosciami. Analizujesz korespondencje email miedzy administracja osiedla a mieszkancami. Odpowiadasz po polsku.`,
    user_prompt_template: `Kontekst dla calego raportu:
- Raport dotyczy analizy korespondencji email administracji osiedla
- Oceniamy jakosc obslugi mieszkancow, czas reakcji i zgodnosc z procedurami
- Dane sa zanonimizowane — uzywaj identyfikatorow zamiast prawdziwych danych osobowych`,
  },
  {
    section_key: 'summary',
    title: 'Podsumowanie ogólne',
    section_order: 1,
    system_prompt: `Jesteś ekspertem ds. zarządzania nieruchomościami. Analizujesz korespondencję email między administracją osiedla a mieszkańcami. Odpowiadasz po polsku. Bądź zwięzły i konkretny.`,
    user_prompt_template: `Przeanalizuj poniższe wątki email i napisz zwięzłe podsumowanie ogólne. Uwzględnij:
- Główne tematy poruszane w korespondencji
- Liczbę i rodzaj zgłoszeń (awarie, reklamacje, pytania, informacje)
- Ogólny ton komunikacji
- Kluczowe wnioski

WĄTKI:
{{threads}}

Napisz podsumowanie w formie zwięzłego raportu (3-5 akapitów).`,
  },
  {
    section_key: 'communication_quality',
    title: 'Jakość komunikacji',
    section_order: 2,
    system_prompt: `Jesteś ekspertem ds. jakości obsługi klienta w zarządzaniu nieruchomościami. Oceniasz profesjonalizm i skuteczność komunikacji administracji. Odpowiadasz po polsku.`,
    user_prompt_template: `Oceń jakość komunikacji administracji w poniższych wątkach. Uwzględnij:
- Profesjonalizm języka i tonu
- Kompletność odpowiedzi (czy pytania są w pełni adresowane)
- Proaktywność (czy administracja informuje o postępach bez pytania)
- Empatia i zrozumienie sytuacji mieszkańca
- Spójność komunikacji (czy informacje się nie wykluczają)

WĄTKI:
{{threads}}

Oceń na skali 1-10 z uzasadnieniem. Podaj mocne strony i obszary do poprawy.`,
  },
  {
    section_key: 'response_time',
    title: 'Czas reakcji',
    section_order: 3,
    system_prompt: `Jesteś analitykiem ds. efektywności obsługi klienta. Analizujesz czasy odpowiedzi w korespondencji administracji nieruchomości. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj czasy odpowiedzi administracji w poniższych wątkach. Uwzględnij:
- Średni czas odpowiedzi na wiadomości mieszkańców
- Czy sprawy pilne (awarie, zalewanie) były traktowane priorytetowo
- Czy zdarzały się nieakceptowalne opóźnienia
- Porównanie z benchmarkiem: <4h (świetnie), 1-2 dni (standardowo), >3 dni (wolno)

WĄTKI:
{{threads}}

Podaj statystyki i ocenę z rekomendacjami.`,
  },
  {
    section_key: 'case_status',
    title: 'Status spraw',
    section_order: 4,
    system_prompt: `Jesteś specjalistą ds. zarządzania zgłoszeniami w administracji nieruchomości. Śledzisz postęp spraw i identyfikujesz problemy. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj status spraw w poniższych wątkach. Dla każdego wątku określ:
- Czy sprawa została rozwiązana, jest w toku, czy oczekuje na odpowiedź
- Jeśli nierozwiązana — jaki jest blokujący problem
- Czy były eskalacje (np. przekierowanie do zarządu)
- Priorytet sprawy

WĄTKI:
{{threads}}

Przedstaw tabelę ze statusem każdej sprawy i ogólne podsumowanie.`,
  },
  {
    section_key: 'contact_info',
    title: 'Dane kontaktowe',
    section_order: 5,
    system_prompt: `Jesteś analitykiem danych. Wyodrębniasz informacje kontaktowe z korespondencji email w zarządzaniu nieruchomościami. Odpowiadasz po polsku. UWAGA: Dane powinny być zanonimizowane — używaj identyfikatorów zamiast prawdziwych danych.`,
    user_prompt_template: `Wyodrębnij informacje o uczestnikach korespondencji z poniższych wątków:
- Kim są uczestnicy (rola: mieszkaniec, administrator, firma zewnętrzna)
- Jakie sprawy poruszał każdy uczestnik
- Ile razy każdy uczestnik kontaktował się z administracją

WĄTKI:
{{threads}}

Przedstaw w formie tabeli. Nie ujawniaj prawdziwych danych osobowych — użyj zanonimizowanych identyfikatorów.`,
  },
  {
    section_key: 'gdpr_compliance',
    title: 'Zgodność z RODO',
    section_order: 6,
    system_prompt: `Jesteś ekspertem ds. ochrony danych osobowych (RODO/GDPR) w kontekście zarządzania nieruchomościami. Identyfikujesz potencjalne naruszenia. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższe wątki pod kątem zgodności z RODO. Zwróć uwagę na:
- Czy w korespondencji ujawniono niepotrzebnie dane osobowe (PESEL, numery kont, adresy)
- Czy dane osobowe mieszkańców były przesyłane w CC do osób trzecich
- Czy administracja prosiła o dane, które nie były niezbędne
- Czy przechowywanie tych danych w email jest zgodne z zasadą minimalizacji

WĄTKI:
{{threads}}

Podaj listę potencjalnych naruszeń z rekomendacjami naprawczymi.`,
  },
  {
    section_key: 'recommendations',
    title: 'Rekomendacje',
    section_order: 7,
    system_prompt: `Jesteś konsultantem ds. poprawy jakości zarządzania nieruchomościami. Na podstawie analizy korespondencji email formułujesz konkretne rekomendacje. Odpowiadasz po polsku.`,
    user_prompt_template: `Na podstawie analizy poniższych wątków, sformułuj konkretne rekomendacje dla administracji:
- Jak poprawić czas reakcji
- Jak podnieść jakość komunikacji
- Jakie procesy warto usprawnić
- Jakie szkolenia mogą być potrzebne
- Jak zapobiec powtarzaniu się problemów

WĄTKI:
{{threads}}

Podziel rekomendacje na: pilne (do wdrożenia natychmiast), krótkoterminowe (1-3 miesiące), długoterminowe (3-12 miesięcy).`,
  },
];

/** Sections included in client-facing report */
export const CLIENT_REPORT_SECTIONS = ['summary', 'communication_quality', 'response_time', 'recommendations'];

/** All sections for internal report */
export const INTERNAL_REPORT_SECTIONS = DEFAULT_PROMPTS.map((p) => p.section_key);
