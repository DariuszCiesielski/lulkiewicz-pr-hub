/**
 * Report Synthesizer — AI-driven REDUCE phase.
 *
 * Aggregates per-thread analysis results into a concise executive report.
 * Each section is synthesized independently via a callAI request.
 *
 * Two detail levels:
 *  - synthetic: 5-6 pages, max 3-4 sentences per section, no sub-headers
 *  - standard: 15-20 pages, full structure with sub-sections
 *
 * For >100 threads: batches of 50 → synthesize each → meta-synthesis.
 */

import { callAI, loadAIConfig } from '@/lib/ai/ai-provider';
import type { AIConfig } from '@/lib/ai/ai-provider';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnalysisProfile } from '@/lib/ai/analysis-profiles';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max characters sent per synthesis request.
 *  60K chars ≈ 15K tokens input — thread summaries are longer than per-section results. */
const MAX_INPUT_CHARS = 60_000;

/** Batch size for large thread sets — synthesize in sub-batches then merge. */
const SUB_BATCH_SIZE = 50;

/** Max completion tokens per section.
 *  GPT-5.x reasoning models count reasoning tokens toward this limit,
 *  so a hard cap here starves the model of reasoning budget.
 *  We no longer cap — aiConfig.maxTokens (from DB, default 16384) is used.
 *  Brevity is enforced by the prompt itself (MAX 8-12 sentences). */

/** Threshold: if more per-thread results than this, use two-level synthesis. */
const TWO_LEVEL_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// System prompts — per detail level
// ---------------------------------------------------------------------------

const SYNTHETIC_SYSTEM_PROMPT = `Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz ZWIĘZŁY raport syntetyczny z analizy korespondencji email.

ZASADY FORMATOWANIA — RAPORT SYNTETYCZNY (5-6 stron A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Każda sekcja: MAX 3-4 zdania zwartej prozy. NIGDY więcej.
3. BEZ podsekcji (## / ###), BEZ list punktowanych, BEZ tabel (poza sekcją rekomendacji).
4. NIE opisuj wątków — podawaj WYŁĄCZNIE ogólne wnioski i wzorce.
5. NIE powtarzaj obserwacji z innych sekcji.
6. Styl: managerski brief — zwięzły, konkretny, z liczbami.
7. NIE używaj nagłówków # — tekst sekcji zaczyna się od razu od treści.
8. Zamiast „w wątku X zaobserwowano Y" pisz „Zaobserwowano trend Y".`;

const STANDARD_SYSTEM_PROMPT = `Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz profesjonalny raport audytowy z analizy korespondencji email.

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
10. Zamiast „w wątku X zaobserwowano Y" pisz „Zaobserwowano trend Y (np. wątki X, Z)".`;

function getSystemPrompt(input: SynthesisInput): string {
  // DB-driven override takes priority
  const override = input.detailLevel === 'synthetic'
    ? input.syntheticSystemPromptOverride
    : input.standardSystemPromptOverride;
  if (override) return override;

  // Fallback to hardcoded for non-default profiles
  if (input.profileSlug && input.profileSlug !== 'communication_audit') {
    const profile = getAnalysisProfile(input.profileSlug as 'communication_audit' | 'case_analytics');
    const profilePrompt = input.detailLevel === 'synthetic'
      ? profile.syntheticSystemPrompt
      : profile.standardSystemPrompt;
    if (profilePrompt) return profilePrompt;
  }
  return input.detailLevel === 'synthetic' ? SYNTHETIC_SYSTEM_PROMPT : STANDARD_SYSTEM_PROMPT;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerThreadResult {
  threadId: string;
  threadSubject: string;
  content: string;
}

export type DetailLevel = 'synthetic' | 'standard';

export interface SynthesisInput {
  sectionKey: string;
  sectionTitle: string;
  perThreadResults: PerThreadResult[];
  templateType: 'internal' | 'client';
  mailboxName: string;
  dateRange?: { from: string; to: string };
  globalContext?: string;
  includeThreadSummaries?: boolean;
  detailLevel: DetailLevel;
  profileId?: string;
  profileSlug?: string;
  /** DB-driven override for system prompt (synthetic detail level) */
  syntheticSystemPromptOverride?: string;
  /** DB-driven override for system prompt (standard detail level) */
  standardSystemPromptOverride?: string;
  /** DB-driven override for section focus prompt */
  focusPromptOverride?: string;
  /** Per-section model override (from prompt_templates.model) */
  modelOverride?: string;
  /** Per-section temperature override (from prompt_templates.temperature) */
  temperatureOverride?: number;
  /** Per-section max_tokens override (from prompt_templates.max_tokens) */
  maxTokensOverride?: number;
}

export interface SynthesisOutput {
  sectionKey: string;
  markdown: string;
  tokensUsed: number;
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate text to fit within character limit, preserving complete entries.
 */
function truncateToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  // Cut at last complete entry separator
  const lastSep = truncated.lastIndexOf('\n---\n');
  if (lastSep > limit * 0.5) {
    return truncated.slice(0, lastSep) + '\n\n[...dane obcięte ze względu na limit...]';
  }
  return truncated + '\n\n[...dane obcięte ze względu na limit...]';
}

/**
 * Format per-thread results into a compact prompt block.
 * Uses minimal formatting to save tokens — no markdown headers, just separators.
 */
function formatResultsForPrompt(results: PerThreadResult[]): string {
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.threadSubject || '(brak tematu)'}: ${r.content}`
    )
    .join('\n---\n');
}

// ---------------------------------------------------------------------------
// Focus prompts — SYNTHETIC (zwięzłe, 1-2 linijki per sekcja)
// ---------------------------------------------------------------------------

function getSyntheticFocusPrompt(sectionKey: string): string | null {
  const focusMap: Record<string, string> = {
    'metadata_analysis': 'Wymiar "1. METADANE". Podaj: zakres dat, liczbę wątków i wiadomości, główne typy spraw (% lub liczbowo), kluczowych uczestników. Max 3-4 zdania.',

    'response_speed': 'Wymiar "2. SZYBKOŚĆ REAKCJI". Oceń średni czas reakcji, % odpowiedzi w <4h / 1-3 dni / >3 dni, konsekwencję potwierdzeń odbioru. Max 3-4 zdania.',

    'service_effectiveness': 'Wymiar "3. EFEKTYWNOŚĆ OBSŁUGI". Oceń kompletność pierwszej odpowiedzi, zamknięcie tematów, proaktywność. Max 3-4 zdania.',

    'client_relationship': 'Wymiar "4. JAKOŚĆ RELACJI Z KLIENTEM". Oceń ton, empatię, budowanie zaufania. Max 3-4 zdania.',

    'communication_cycle': 'Wymiar "5. CYKL KOMUNIKACJI". Oceń liczbę wymian do rozwiązania, ciągłość prowadzenia sprawy, status zamknięcia. Max 3-4 zdania.',

    'client_feedback': 'Wymiar "6. SATYSFAKCJA KLIENTA". Oceń sygnały zadowolenia/niezadowolenia, zmiany tonu, ponaglenia. Max 3-4 zdania.',

    'expression_form': 'Wymiar "7. FORMA WYPOWIEDZI". Oceń styl (formalność), powitania, personalizację, zwroty końcowe, spójność. Max 3-4 zdania.',

    'recipient_clarity': 'Wymiar "8. JASNOŚĆ KOMUNIKACJI". Oceń przejrzystość, czytelność struktury, profesjonalizm. Max 3-4 zdania.',

    'organization_consistency': 'Wymiar "9. SPÓJNOŚĆ ORGANIZACYJNA". Oceń jednolitość standardów, podpisów, formatów między pracownikami/działami. Max 3-4 zdania.',

    'proactive_actions': 'Wymiar "10. PROAKTYWNOŚĆ". Oceń inicjatywę własną, przypominanie o procedurach, monitorowanie postępów. Max 3-4 zdania.',

    'internal_communication': 'Wymiar "11. KOMUNIKACJA WEWNĘTRZNA". Oceń przepływ informacji, współpracę między działami, stosowanie CC/UDW. Max 3-4 zdania.',

    'data_security': 'Wymiar "12. BEZPIECZEŃSTWO DANYCH (RODO)". Oceń stosowanie UDW, ochronę danych osobowych, procedury wewnętrzne. Max 3-4 zdania.',

    'recommendations': `Zbierz i skonsoliduj TOP 5-7 rekomendacji ze WSZYSTKICH wymiarów analizy.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Kategoria |
|---|---|---|---|
| 1 | Opis... | Pilne / Krótkoterminowe / Długoterminowe | Procesy / Szkolenia / Narzędzia |

NIE powtarzaj tych samych rekomendacji (SLA/CRM/ticketing) wielokrotnie — skonsoliduj podobne.
Po tabeli dodaj 1-2 zdania o najważniejszych priorytetach strategicznych.`,
  };
  return focusMap[sectionKey] || null;
}

// ---------------------------------------------------------------------------
// Focus prompts — STANDARD (szczegółowe, z podsekcjami)
// ---------------------------------------------------------------------------

function getStandardFocusPrompt(sectionKey: string): string | null {
  const NO_REDUNDANT_H2 = 'NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. ';
  const RECO_ONLY_IN_13 = 'WAŻNE: Rekomendacje podaj WYŁĄCZNIE w sekcji 13. Tutaj skup się na obserwacjach. ';

  const focusMap: Record<string, string> = {
    'metadata_analysis': `Wyodrębnij metadane analizy (wymiar "1. METADANE").

WYMAGANE ELEMENTY (podaj konkrety, nie ogólniki):
- **Zakres i źródło danych**: e-maile, ograniczenia (brak danych z telefonów/spotkań)
- **Najstarsza wiadomość**: KONKRETNA DATA (np. 15 lipca 2025)
- **Najnowsza wiadomość**: KONKRETNA DATA
- **Łączna liczba wiadomości** wykorzystanych w analizie (nie wątków)
- **Liczba wątków**: N
- **Typy spraw**: podział procentowy lub liczbowy (reklamacje, awarie, pytania, itp.)
- **Uczestnicy**: kluczowe role po obu stronach

Napisz w formie listy z pogrubionymi etykietami.`,

    'response_speed': `${RECO_ONLY_IN_13}Skup się na wymiarze "2. SZYBKOŚĆ REAKCJI I OBSŁUGA ZGŁOSZEŃ".

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
Czy pracownicy stosują potwierdzenia konsekwentnie? Różnice między pracownikami/działami?`,

    'service_effectiveness': `${NO_REDUNDANT_H2}${RECO_ONLY_IN_13}Skup się na wymiarze "3. EFEKTYWNOŚĆ OBSŁUGI" — zamknięcie tematu, kompletność informacji w pierwszej odpowiedzi, proaktywność. Unikaj powtórzeń z sekcji o szybkości reakcji.`,

    'client_relationship': `${NO_REDUNDANT_H2}Skup się na wymiarze "4. JAKOŚĆ RELACJI Z KLIENTEM" — ton komunikacji, empatia, budowanie zaufania, indywidualne podejście. Unikaj powtórzeń z sekcji o formie wypowiedzi.`,

    'communication_cycle': `${NO_REDUNDANT_H2}${RECO_ONLY_IN_13}Skup się na wymiarze "5. CYKL KOMUNIKACJI" — liczba wymian potrzebnych do rozwiązania, ciągłość prowadzenia sprawy (ten sam pracownik?), status rozwiązania. Unikaj powtórzeń z sekcji o efektywności.`,

    'client_feedback': `${NO_REDUNDANT_H2}Skup się na wymiarze "6. SATYSFAKCJA KLIENTA" — sygnały zadowolenia/niezadowolenia, zmiana tonu w kolejnych wiadomościach, ponaglenia. Bazuj WYŁĄCZNIE na treści emaili.`,

    'expression_form': `Skup się na wymiarze "7. FORMA WYPOWIEDZI".

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
Obecność i jakość. Spójność z tonem rozpoczęcia.`,

    'recipient_clarity': `${NO_REDUNDANT_H2}Skup się na wymiarze "8. JASNOŚĆ KOMUNIKACJI" — przejrzystość, czytelność struktury, profesjonalizm, brak elementów negatywnych. Unikaj powtórzeń z sekcji o formie wypowiedzi.`,

    'organization_consistency': `${NO_REDUNDANT_H2}Skup się na wymiarze "9. SPÓJNOŚĆ ORGANIZACYJNA" — jednolite standardy między pracownikami, spójne podpisy, format wiadomości, różnice między działami.`,

    'proactive_actions': `${NO_REDUNDANT_H2}${RECO_ONLY_IN_13}Skup się na wymiarze "10. PROAKTYWNOŚĆ" — inicjatywa własna, przypominanie o procedurach, monitorowanie postępów, zapobieganie problemom. Unikaj powtórzeń z sekcji o efektywności.`,

    'internal_communication': `${NO_REDUNDANT_H2}Skup się na wymiarze "11. KOMUNIKACJA WEWNĘTRZNA" — przepływ informacji, współpraca między działami, delegowanie zadań, RODO w komunikacji wewnętrznej (CC/UDW).`,

    'data_security': `${NO_REDUNDANT_H2}Skup się na wymiarze "12. BEZPIECZEŃSTWO DANYCH (RODO)" — stosowanie UDW, ochrona danych osobowych, właściwa forma odpowiedzi, procedury wewnętrzne. Podaj przykłady dobrych i złych praktyk.`,

    'recommendations': `Zbierz i zsyntezuj rekomendacje ze WSZYSTKICH wymiarów analizy. Skonsoliduj podobne rekomendacje — NIE powtarzaj tych samych (SLA/CRM/ticketing) wielokrotnie.

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Odpowiedzialny | Kategoria |
|---|---|---|---|---|
| 1 | Opis rekomendacji... | Pilne / Krótkoterminowe / Długoterminowe | Kto odpowiada | Procesy / Szkolenia / Narzędzia |

Priorytety: **Pilne** (natychmiast), **Krótkoterminowe** (1-3 mies.), **Długoterminowe** (3-12 mies.).
Grupuj: najpierw Pilne, potem Krótkoterminowe, potem Długoterminowe.

Po tabeli dodaj krótki akapit z 3 najważniejszymi priorytetami strategicznymi.`,
  };
  return focusMap[sectionKey] || null;
}

// ---------------------------------------------------------------------------
// Focus prompt router
// ---------------------------------------------------------------------------

function getSectionFocusPrompt(input: SynthesisInput): string | null {
  // DB-driven override takes priority
  if (input.focusPromptOverride) return input.focusPromptOverride;

  // Fallback to hardcoded for non-default profiles
  if (input.profileSlug && input.profileSlug !== 'communication_audit') {
    const profile = getAnalysisProfile(input.profileSlug as 'communication_audit' | 'case_analytics');
    const section = profile.reportSections.find((s) => s.section_key === input.sectionKey);
    if (section) {
      return input.detailLevel === 'synthetic' ? section.syntheticFocus : section.standardFocus;
    }
  }
  return input.detailLevel === 'synthetic'
    ? getSyntheticFocusPrompt(input.sectionKey)
    : getStandardFocusPrompt(input.sectionKey);
}

/**
 * Build the user prompt for synthesis — enforces brevity.
 */
function buildUserPrompt(input: SynthesisInput, resultsBlock: string): string {
  const parts: string[] = [];

  parts.push(
    `Napisz ZWIĘZŁE podsumowanie sekcji "${input.sectionTitle}" na podstawie kompleksowych analiz ${input.perThreadResults.length} wątków email.`
  );

  const focusPrompt = getSectionFocusPrompt(input);
  if (focusPrompt) {
    parts.push(`\nFOKUS SEKCJI: ${focusPrompt}`);
  }

  parts.push(`Skrzynka: ${input.mailboxName}`);

  if (input.dateRange) {
    parts.push(`Okres: ${input.dateRange.from} — ${input.dateRange.to}`);
  }

  parts.push(`Typ raportu: ${input.templateType === 'client' ? 'kliencki (zewnętrzny)' : 'wewnętrzny (pełny)'}`);

  if (input.globalContext) {
    parts.push(`\nKONTEKST:\n${input.globalContext}`);
  }

  parts.push(`\nDANE ŹRÓDŁOWE (podsumowania wątków):\n${resultsBlock}`);

  if (input.detailLevel === 'synthetic') {
    const isDefaultProfile = !input.profileSlug || input.profileSlug === 'communication_audit';
    if (isDefaultProfile) {
      parts.push(
        `\nINSTRUKCJA: Napisz max 3-4 zdania zwartej prozy. BEZ nagłówków (##/###), BEZ list punktowanych, BEZ tabel (chyba że FOKUS jawnie wymaga tabeli). NIE opisuj wątków z osobna — wyciągaj ogólne wnioski.`
      );
    } else {
      parts.push(
        `\nINSTRUKCJA: Postępuj DOKŁADNIE wg FOKUS SEKCJI powyżej — użyj wymaganego formatu (tabela, lista lub proza). Po tabelach/listach dodaj akapit analityczny z wnioskami (2-3 zdania). NIE opisuj wątków z osobna — wyciągaj ogólne wnioski.`
      );
    }
  } else {
    parts.push(
      `\nINSTRUKCJA: Napisz sekcję raportu zgodnie z FOKUSEM SEKCJI powyżej. Jeśli FOKUS wymaga podsekcji (## / ###), ZASTOSUJ JE. NIE zaczynaj od nagłówka ## powtarzającego tytuł sekcji. NIE używaj nagłówków # (tylko ## i ###). Przytaczaj wątki TYLKO jako krótkie wzmianki (np. „wątek: Awaria windy"). NIE opisuj każdego wątku z osobna — wyciągaj ogólne wnioski.`
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Per-section AI config override
// ---------------------------------------------------------------------------

function applyConfigOverrides(aiConfig: AIConfig, input: SynthesisInput): AIConfig {
  if (!input.modelOverride && input.temperatureOverride === undefined && input.maxTokensOverride === undefined) {
    return aiConfig;
  }
  return {
    ...aiConfig,
    ...(input.modelOverride && { model: input.modelOverride }),
    ...(input.temperatureOverride !== undefined && { temperature: input.temperatureOverride }),
    ...(input.maxTokensOverride !== undefined && { maxTokens: input.maxTokensOverride }),
  };
}

// ---------------------------------------------------------------------------
// Main synthesis function
// ---------------------------------------------------------------------------

/**
 * Synthesize a single report section from per-thread analysis results.
 *
 * For <=100 threads: single synthesis pass.
 * For >100 threads: batch into sub-groups, synthesize each, then meta-synthesize.
 */
export async function synthesizeReportSection(
  aiConfig: AIConfig,
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const { perThreadResults } = input;

  // Single-thread: still synthesize to enforce brevity
  if (perThreadResults.length === 1) {
    return singlePassSynthesis(aiConfig, input);
  }

  // Small set (<=100): single-pass synthesis
  if (perThreadResults.length <= TWO_LEVEL_THRESHOLD) {
    return singlePassSynthesis(aiConfig, input);
  }

  // Large set (>100): two-level synthesis (batch → meta)
  return twoLevelSynthesis(aiConfig, input);
}

/**
 * Single-pass synthesis for <=100 threads.
 */
async function singlePassSynthesis(
  aiConfig: AIConfig,
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const effectiveConfig = applyConfigOverrides(aiConfig, input);
  const resultsBlock = formatResultsForPrompt(input.perThreadResults);
  const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);
  const userPrompt = buildUserPrompt(input, truncatedBlock);
  const systemPrompt = getSystemPrompt(input);

  const response = await callAI(effectiveConfig, systemPrompt, userPrompt);

  return {
    sectionKey: input.sectionKey,
    markdown: response.content,
    tokensUsed: response.tokensUsed,
    processingTimeMs: response.processingTimeMs,
  };
}

/**
 * Two-level synthesis for >100 threads.
 * 1. Batch results into groups of SUB_BATCH_SIZE
 * 2. Synthesize each batch independently
 * 3. Meta-synthesize batch summaries into final output
 */
async function twoLevelSynthesis(
  aiConfig: AIConfig,
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const effectiveConfig = applyConfigOverrides(aiConfig, input);
  const { perThreadResults, sectionTitle } = input;
  const startTime = Date.now();
  let totalTokens = 0;

  // Split into sub-batches
  const batches: PerThreadResult[][] = [];
  for (let i = 0; i < perThreadResults.length; i += SUB_BATCH_SIZE) {
    batches.push(perThreadResults.slice(i, i + SUB_BATCH_SIZE));
  }

  const systemPrompt = getSystemPrompt(input);

  // Synthesize each sub-batch (sequential to respect rate limits)
  const batchSummaries: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchInput: SynthesisInput = {
      ...input,
      perThreadResults: batch,
    };

    const resultsBlock = formatResultsForPrompt(batch);
    const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);
    const userPrompt = buildUserPrompt(batchInput, truncatedBlock);

    const response = await callAI(effectiveConfig, systemPrompt, userPrompt);
    batchSummaries.push(
      `## Grupa ${i + 1} (wątki ${i * SUB_BATCH_SIZE + 1}-${Math.min((i + 1) * SUB_BATCH_SIZE, perThreadResults.length)})\n\n${response.content}`
    );
    totalTokens += response.tokensUsed;
  }

  // Meta-synthesis: combine batch summaries into brief final output
  const metaInstruction = input.detailLevel === 'synthetic'
    ? 'Napisz KOŃCOWĄ syntezę w MAX 3-4 zdaniach zwartej prozy. BEZ nagłówków, BEZ list.'
    : 'Napisz KOŃCOWĄ syntezę w MAX 8-12 zdaniach. Połącz wnioski, usuń redundancje. Podaj ogólną ocenę i główne wzorce. Przykłady wątków TYLKO przy ekstremalnych przypadkach.';

  const metaPrompt = `Masz ${batches.length} częściowych syntez sekcji "${sectionTitle}" z łącznie ${perThreadResults.length} wątków email.

Skrzynka: ${input.mailboxName}
${input.dateRange ? `Okres: ${input.dateRange.from} — ${input.dateRange.to}` : ''}

CZĘŚCIOWE SYNTEZY:

${batchSummaries.join('\n---\n')}

INSTRUKCJA: ${metaInstruction}`;

  const metaResponse = await callAI(
    effectiveConfig,
    systemPrompt,
    truncateToLimit(metaPrompt, MAX_INPUT_CHARS)
  );

  totalTokens += metaResponse.tokensUsed;

  return {
    sectionKey: input.sectionKey,
    markdown: metaResponse.content,
    tokensUsed: totalTokens,
    processingTimeMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Convenience: load AI config and synthesize
// ---------------------------------------------------------------------------

/**
 * Load AI config from DB and synthesize a section.
 * Convenience wrapper for use in API routes.
 */
export async function synthesizeWithConfig(
  supabase: SupabaseClient,
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const aiConfig = await loadAIConfig(supabase);
  return synthesizeReportSection(aiConfig, input);
}
