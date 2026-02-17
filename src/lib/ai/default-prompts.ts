/**
 * Default prompt templates for the 13 report sections.
 * Based on client requirements (Struktura_2in1 + All_bez_struktury).
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
  // ── 0. Global context (not rendered in report, used as synthesis context) ──
  {
    section_key: '_global_context',
    title: 'Kontekst globalny raportu',
    section_order: 0,
    system_prompt: `Jesteś ekspertem ds. zarządzania nieruchomościami i audytu jakości komunikacji. Analizujesz korespondencję email między administracją osiedla a mieszkańcami, deweloperem (Robyg) i firmami zewnętrznymi. Odpowiadasz po polsku.`,
    user_prompt_template: `Kontekst dla całego raportu:
- Raport dotyczy kompleksowej analizy korespondencji email administracji osiedla
- Oceniamy: szybkość reakcji, jakość obsługi, formę komunikacji, bezpieczeństwo danych (RODO), proaktywność, komunikację wewnętrzną i spójność organizacyjną
- Źródło danych: wyłącznie korespondencja email — brak danych z rozmów telefonicznych, spotkań czy ankiet
- Dane są zanonimizowane — używaj identyfikatorów zamiast prawdziwych danych osobowych
- Raport kierowany jest do zarządcy nieruchomości w celu podniesienia jakości obsługi mieszkańców`,
  },

  // ── 1. Metadane analizy ──
  {
    section_key: 'metadata_analysis',
    title: 'Metadane analizy',
    section_order: 1,
    system_prompt: `Jesteś analitykiem danych specjalizującym się w audytach korespondencji w zarządzaniu nieruchomościami. Odpowiadasz po polsku, zwięźle i rzeczowo.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email i wyodrębnij kluczowe metadane. Uwzględnij:
- Zakres i źródło danych: temat wątku, typ sprawy (awaria, reklamacja, pytanie, informacja, procedura)
- Daty: najstarsza i najnowsza wiadomość w wątku
- Liczba wiadomości w wątku
- Uczestnicy: role (mieszkaniec, administrator, firma zewnętrzna, deweloper)
- Ograniczenia analizy: czego nie można ocenić z samego emaila (np. rozmowy telefoniczne, ustalenia ustne, które mogły mieć miejsce)

WĄTEK:
{{threads}}

Przedstaw metadane w formie zwięzłej listy.`,
  },

  // ── 2. Szybkość reakcji i obsługi zgłoszeń ──
  {
    section_key: 'response_speed',
    title: 'Szybkość reakcji i obsługi zgłoszeń',
    section_order: 2,
    system_prompt: `Jesteś analitykiem ds. efektywności obsługi klienta w administracji nieruchomości. Oceniasz terminowość reakcji i jakość potwierdzeń. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem szybkości reakcji. Oceń:

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

Podaj konkretne czasy reakcji (jeśli możliwe do ustalenia z dat wiadomości) i oceń jakość potwierdzeń.`,
  },

  // ── 3. Efektywność obsługi klienta ──
  {
    section_key: 'service_effectiveness',
    title: 'Efektywność obsługi klienta',
    section_order: 3,
    system_prompt: `Jesteś ekspertem ds. jakości obsługi klienta w zarządzaniu nieruchomościami. Oceniasz kompletność i przydatność odpowiedzi administracji. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem efektywności obsługi. Oceń:

- **Zamknięcie tematu**: Czy odpowiedź administracji kończy temat, czy wymaga dalszych wyjaśnień od mieszkańca?
- **Kompletność informacji**: Czy wszystkie potrzebne dane zostały przekazane w pierwszej odpowiedzi? Czy mieszkaniec musiał dopytywać?
- **Przydatność treści**: Czy odpowiedź zawiera konkretne wskazówki i informacje, czy ogranicza się do ogólników?
- **Proaktywność**: Czy pracownik proponuje kolejne kroki, oferuje dodatkową pomoc, informuje o przewidywanym czasie realizacji?

WĄTEK:
{{threads}}

Oceń efektywność obsługi i podaj konkretne przykłady z wątku.`,
  },

  // ── 4. Jakość relacji z klientem ──
  {
    section_key: 'client_relationship',
    title: 'Jakość relacji z klientem',
    section_order: 4,
    system_prompt: `Jesteś specjalistą ds. zarządzania relacjami z klientami w branży nieruchomości. Oceniasz jakość budowania relacji przez administrację. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem jakości relacji z klientem. Oceń:

- **Ton komunikacji**: Czy jest empatyczny, uprzejmy, neutralny czy chłodny/obcesowy?
- **Budowanie zaufania**: Czy administracja wyjaśnia swoje decyzje i procedury? Czy uzasadnia dlaczego coś trwa dłużej?
- **Wzmacnianie relacji**: Czy pojawiają się elementy troski o mieszkańca, podziękowania, zwroty grzecznościowe budujące więź?
- **Indywidualne podejście**: Czy mieszkaniec czuje się traktowany indywidualnie, a nie jak „kolejny numer w kolejce"?

WĄTEK:
{{threads}}

Oceń jakość relacji i podaj konkretne cytaty lub zachowania z wątku.`,
  },

  // ── 5. Skuteczność komunikacji w cyklu sprawy ──
  {
    section_key: 'communication_cycle',
    title: 'Skuteczność komunikacji w cyklu sprawy',
    section_order: 5,
    system_prompt: `Jesteś analitykiem procesów obsługi w administracji nieruchomości. Oceniasz efektywność całego cyklu komunikacji od zgłoszenia do rozwiązania. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem skuteczności całego cyklu komunikacji. Oceń:

- **Liczba wymian**: Ile wiadomości było potrzebnych do rozwiązania/obsługi sprawy? Czy można było załatwić to mniejszą liczbą wymian?
- **Ciągłość prowadzenia sprawy**: Czy ten sam pracownik prowadzi temat od początku do końca, czy sprawa jest „przerzucana" między osobami?
- **Spójność informacji**: Czy w kolejnych wiadomościach nie ma sprzeczności, powtórzeń lub luk informacyjnych?
- **Status rozwiązania**: Czy sprawa została zamknięta? Jeśli nie — na jakim etapie utknęła?

WĄTEK:
{{threads}}

Opisz przebieg cyklu sprawy i oceń jego efektywność.`,
  },

  // ── 6. Satysfakcja i feedback klientów ──
  {
    section_key: 'client_feedback',
    title: 'Satysfakcja i feedback klientów',
    section_order: 6,
    system_prompt: `Jesteś analitykiem satysfakcji klienta w zarządzaniu nieruchomościami. Analizujesz sygnały zadowolenia lub niezadowolenia mieszkańców. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem sygnałów satysfakcji lub niezadowolenia mieszkańca. Szukaj:

- **Pozytywny feedback**: Podziękowania, wyrazy uznania, zadowolenie z obsługi
- **Negatywny feedback**: Skargi, frustracja, niezadowolenie, groźby eskalacji
- **Ton emocjonalny mieszkańca**: Jak zmienia się ton w kolejnych wiadomościach — poprawia się czy pogarsza?
- **Sygnały pośrednie**: Zwięzłe odpowiedzi mogące świadczyć o zniecierpliwieniu, wielokrotne ponaglenia, brak odpowiedzi na propozycje

UWAGA: Bazuj wyłącznie na treści emaili — nie mamy dostępu do ankiet satysfakcji ani rozmów telefonicznych.

WĄTEK:
{{threads}}

Opisz zaobserwowane sygnały satysfakcji/niezadowolenia z konkretnymi przykładami.`,
  },

  // ── 7. Użyta forma wypowiedzi ──
  {
    section_key: 'expression_form',
    title: 'Użyta forma wypowiedzi',
    section_order: 7,
    system_prompt: `Jesteś lingwistą i ekspertem ds. komunikacji biznesowej. Analizujesz formę językową korespondencji administracji nieruchomości. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj formę wypowiedzi administracji w poniższym wątku. Oceń szczegółowo:

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

Oceń każdy z powyższych aspektów z konkretnymi przykładami z wątku.`,
  },

  // ── 8. Jasność i komfort odbiorcy ──
  {
    section_key: 'recipient_clarity',
    title: 'Jasność i komfort odbiorcy',
    section_order: 8,
    system_prompt: `Jesteś ekspertem ds. UX komunikacji pisemnej. Oceniasz, jak odbiorca (mieszkaniec) postrzega komunikację administracji. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem jasności i komfortu odbiorcy. Oceń:

- **Przejrzystość**: Czy komunikacja jest zrozumiała, logicznie uporządkowana i łatwa do śledzenia?
- **Profesjonalizm**: Czy forma wiadomości buduje zaufanie i poczucie kompetencji?
- **Indywidualne traktowanie**: Czy mieszkaniec czuje, że jego sprawa jest ważna i traktowana poważnie?
- **Brak elementów negatywnych**: Czy nie ma elementów, które mogłyby być odebrane jako lekceważące, chaotyczne, mało profesjonalne lub zniechęcające?
- **Czytelność struktury**: Czy wiadomości są odpowiednio sformatowane (akapity, punkty), czy są „ścianą tekstu"?

WĄTEK:
{{threads}}

Oceń jasność komunikacji z perspektywy mieszkańca i podaj konkretne przykłady.`,
  },

  // ── 9. Spójność komunikacji w organizacji ──
  {
    section_key: 'organization_consistency',
    title: 'Spójność komunikacji w organizacji',
    section_order: 9,
    system_prompt: `Jesteś konsultantem ds. standardów komunikacji organizacyjnej w zarządzaniu nieruchomościami. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem spójności komunikacji organizacyjnej. Oceń:

- **Styl pracowników**: Jeśli w wątku występuje więcej niż jeden pracownik administracji — czy stosują podobny poziom formalności i strukturę wiadomości?
- **Standardy organizacyjne**: Czy widoczne są jednolite standardy (np. stały format powitania, podpis, struktura odpowiedzi)?
- **Różnice**: Czy występują różnice, które mogą być odebrane jako brak standardów w organizacji?
- **Podpisy i stopki**: Czy wiadomości zawierają spójne podpisy z danymi kontaktowymi?

WĄTEK:
{{threads}}

Opisz zaobserwowane wzorce i różnice w komunikacji pracowników.`,
  },

  // ── 10. Proaktywne działania administracji ──
  {
    section_key: 'proactive_actions',
    title: 'Proaktywne działania administracji',
    section_order: 10,
    system_prompt: `Jesteś ekspertem ds. zarządzania proaktywnego w administracji nieruchomości. Oceniasz inicjatywność zespołu. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem proaktywności administracji. Oceń:

- **Inicjatywa własna**: Czy administracja sama wychodzi z inicjatywą (np. informuje o planowanych pracach, zmianach, terminach)?
- **Przypominanie o procedurach**: Czy zespół przypomina mieszkańcom o ważnych procedurach i terminach?
- **Dbanie o bezpieczeństwo danych**: Czy proaktywnie zwraca uwagę na kwestie ochrony danych?
- **Monitorowanie postępów**: Czy administracja monitoruje postępy zgłoszeń (np. u Robyg) i informuje mieszkańców o statusie bez czekania na pytanie?
- **Zapobieganie problemom**: Czy widoczne są działania prewencyjne, a nie tylko reaktywne?

WĄTEK:
{{threads}}

Opisz zaobserwowane przejawy proaktywności lub ich brak z konkretnymi przykładami.`,
  },

  // ── 11. Komunikacja wewnętrzna ──
  {
    section_key: 'internal_communication',
    title: 'Komunikacja wewnętrzna',
    section_order: 11,
    system_prompt: `Jesteś ekspertem ds. komunikacji wewnętrznej w organizacjach zarządzających nieruchomościami. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem komunikacji wewnętrznej w organizacji. Oceń:

- **Przepływ informacji**: Jak wygląda przekazywanie informacji wewnątrz firmy? Czy widać sprawny obieg informacji między pracownikami?
- **Współpraca między działami**: Jak przebiega współpraca (np. administracja ↔ dział techniczny, administracja ↔ deweloper)?
- **Delegowanie zadań**: Czy zadania są jasno delegowane? Czy widać kto za co odpowiada?
- **RODO w komunikacji wewnętrznej**: Czy w wewnętrznej korespondencji (CC, przekazywanie) przestrzegane są zasady ochrony danych (UDW, brak ujawniania danych mieszkańców niepotrzebnym osobom)?

UWAGA: Oceniaj na podstawie widocznych w wątku śladów komunikacji wewnętrznej (np. CC do współpracowników, przekazywanie wiadomości, odwoływanie się do ustaleń wewnętrznych).

WĄTEK:
{{threads}}

Opisz zaobserwowane wzorce komunikacji wewnętrznej.`,
  },

  // ── 12. Bezpieczeństwo danych (RODO) ──
  {
    section_key: 'data_security',
    title: 'Bezpieczeństwo danych (RODO)',
    section_order: 12,
    system_prompt: `Jesteś ekspertem ds. ochrony danych osobowych (RODO/GDPR) w kontekście zarządzania nieruchomościami. Identyfikujesz dobre i złe praktyki. Odpowiadasz po polsku.`,
    user_prompt_template: `Przeanalizuj poniższy wątek email pod kątem bezpieczeństwa danych i zgodności z RODO. Oceń:

- **Stosowanie UDW**: Czy przy korespondencji do wielu odbiorców użyto UDW (ukrytej kopii) zamiast jawnych list adresowych?
- **Ochrona danych osobowych**: Czy w korespondencji nie ujawniono niepotrzebnie danych osobowych (PESEL, numery kont, adresy, numery lokali) osobom trzecim?
- **Właściwa forma odpowiedzi**: Czy dane osobowe mieszkańca nie trafiły do niewłaściwych odbiorców przez CC/odpowiedź do wszystkich?
- **Powoływanie się na przepisy**: Czy w razie potrzeby administracja powołuje się na przepisy o ochronie danych osobowych?
- **Procedury wewnętrzne**: Czy widać przestrzeganie wewnętrznych procedur ochrony danych?

Podaj konkretne **przykłady poprawnych praktyk** (co zrobiono dobrze) oraz **niepoprawnych praktyk** (co wymaga korekty).

WĄTEK:
{{threads}}

Opisz zaobserwowane praktyki z oceną i rekomendacjami.`,
  },

  // ── 13. Rekomendacje i działania usprawniające ──
  {
    section_key: 'recommendations',
    title: 'Rekomendacje i działania usprawniające',
    section_order: 13,
    system_prompt: `Jesteś konsultantem ds. poprawy jakości zarządzania nieruchomościami. Formułujesz konkretne, wykonalne rekomendacje. Odpowiadasz po polsku.`,
    user_prompt_template: `Na podstawie analizy poniższego wątku, sformułuj konkretne rekomendacje. Uwzględnij:

- **Procesy**: Jakie procedury warto wdrożyć lub usprawnić?
- **Szkolenia**: Jakie szkolenia mogą być potrzebne (komunikacja, RODO, obsługa klienta)?
- **Narzędzia**: Jakie narzędzia mogłyby pomóc (szablony odpowiedzi, system ticketowy, checklisty)?
- **Odpowiedzialność**: Kto powinien być odpowiedzialny za wdrożenie (administracja, zarządca, dział IT)?
- **Priorytety**: Oznacz każdą rekomendację priorytetem:
  - 🔴 Pilne (do wdrożenia natychmiast)
  - 🟡 Krótkoterminowe (1-3 miesiące)
  - 🟢 Długoterminowe (3-12 miesięcy)

WĄTEK:
{{threads}}

Sformułuj 3-5 rekomendacji z uzasadnieniem i priorytetem. Bądź konkretny — unikaj ogólników.`,
  },
];

/** Sections included in client-facing report (all except internal_communication) */
export const CLIENT_REPORT_SECTIONS = [
  'metadata_analysis',
  'response_speed',
  'service_effectiveness',
  'client_relationship',
  'communication_cycle',
  'client_feedback',
  'expression_form',
  'recipient_clarity',
  'organization_consistency',
  'proactive_actions',
  'data_security',
  'recommendations',
];

/** All sections for internal report */
export const INTERNAL_REPORT_SECTIONS = DEFAULT_PROMPTS.map((p) => p.section_key);
