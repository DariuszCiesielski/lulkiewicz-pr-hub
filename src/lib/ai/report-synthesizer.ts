/**
 * Report Synthesizer — AI-driven REDUCE phase.
 *
 * Aggregates per-thread analysis results into a concise executive report.
 * Each section is synthesized independently via a callAI request.
 * Target: entire report = 5-6 pages, so each section ≈ 0.3-0.5 page.
 *
 * For >100 threads: batches of 30 → synthesize each → meta-synthesis.
 */

import { callAI, loadAIConfig } from '@/lib/ai/ai-provider';
import type { AIConfig } from '@/lib/ai/ai-provider';
import type { SupabaseClient } from '@supabase/supabase-js';

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
// System prompt
// ---------------------------------------------------------------------------

const SYNTHESIS_SYSTEM_PROMPT = `Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz profesjonalny raport audytowy z analizy korespondencji email.

ZASADY FORMATOWANIA:
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. STRUKTURA KAŻDEJ SEKCJI:
   a) Krótki akapit wprowadzający (2-3 zdania z kluczowym wnioskiem i ogólną oceną)
   b) Kluczowe obserwacje jako zwięzłe punkty (po 1-2 zdania, max 5-8 punktów)
   c) 1-2 rekomendacje na końcu sekcji (jako osobne akapity z pogrubionym **Rekomendacja:**)
3. NIE opisuj każdego wątku z osobna — wyciągaj OGÓLNE wnioski i wzorce.
4. Podawaj konkretne przykłady TYLKO przy ekstremalnych przypadkach (1-2 per sekcja, jako krótkie wzmianki w nawiasie).
5. Jeśli FOKUS SEKCJI wymaga podsekcji, użyj nagłówków ## i ### — NIGDY nagłówka #.
6. NIE powtarzaj obserwacji opisanych w innych sekcjach — odwołaj się do nich krótko jeśli trzeba.
7. Cały raport (wszystkie sekcje razem) powinien zmieścić się w 7-10 stronach A4.
8. Twórz tabele markdown TYLKO gdy wyraźnie wymagane w FOKUSIE SEKCJI.
9. Zamiast „w wątku X zaobserwowano Y" pisz „Zaobserwowano trend Y (np. wątki X, Z)".`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerThreadResult {
  threadId: string;
  threadSubject: string;
  content: string;
}

export interface SynthesisInput {
  sectionKey: string;
  sectionTitle: string;
  perThreadResults: PerThreadResult[];
  templateType: 'internal' | 'client';
  mailboxName: string;
  dateRange?: { from: string; to: string };
  globalContext?: string;
  includeThreadSummaries?: boolean;
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

/**
 * Maps section_key to a focus instruction for the synthesizer.
 * Tells AI which dimension to extract from comprehensive thread summaries.
 */
function getSectionFocusPrompt(sectionKey: string): string | null {
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

    'response_speed': `Skup się na wymiarze "2. SZYBKOŚĆ REAKCJI I OBSŁUGA ZGŁOSZEŃ".

WYMAGANA STRUKTURA Z PODSEKCJAMI:

## 2.1. Czas reakcji
Opisz: średni czas od zgłoszenia do pierwszej odpowiedzi, szybkość przekazania spraw do odpowiedniego działu. Podaj statystyki (% w <4h, % 1-3 dni, % >3 dni). Wspomnij o skrajnych przypadkach.

## 2.2. Potwierdzenie odbioru wiadomości

### a) Forma potwierdzenia
Czy wiadomości zawierają jednoznaczne potwierdzenie odbioru? Styl: uprzejmy/profesjonalny vs. zdawkowy? Elementy budujące relację?

### b) Konsekwencja stosowania
Czy pracownicy stosują potwierdzenia konsekwentnie? Różnice między pracownikami/działami?`,

    'service_effectiveness': 'Skup się na wymiarze "3. EFEKTYWNOŚĆ OBSŁUGI" — zamknięcie tematu, kompletność informacji w pierwszej odpowiedzi, proaktywność. Unikaj powtórzeń z sekcji o szybkości reakcji.',

    'client_relationship': 'Skup się na wymiarze "4. JAKOŚĆ RELACJI Z KLIENTEM" — ton komunikacji, empatia, budowanie zaufania, indywidualne podejście. Unikaj powtórzeń z sekcji o formie wypowiedzi.',

    'communication_cycle': 'Skup się na wymiarze "5. CYKL KOMUNIKACJI" — liczba wymian potrzebnych do rozwiązania, ciągłość prowadzenia sprawy (ten sam pracownik?), status rozwiązania. Unikaj powtórzeń z sekcji o efektywności.',

    'client_feedback': 'Skup się na wymiarze "6. SATYSFAKCJA KLIENTA" — sygnały zadowolenia/niezadowolenia, zmiana tonu w kolejnych wiadomościach, ponaglenia. Bazuj WYŁĄCZNIE na treści emaili.',

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

    'recipient_clarity': 'Skup się na wymiarze "8. JASNOŚĆ KOMUNIKACJI" — przejrzystość, czytelność struktury, profesjonalizm, brak elementów negatywnych. Unikaj powtórzeń z sekcji o formie wypowiedzi.',

    'organization_consistency': 'Skup się na wymiarze "9. SPÓJNOŚĆ ORGANIZACYJNA" — jednolite standardy między pracownikami, spójne podpisy, format wiadomości, różnice między działami.',

    'proactive_actions': 'Skup się na wymiarze "10. PROAKTYWNOŚĆ" — inicjatywa własna, przypominanie o procedurach, monitorowanie postępów, zapobieganie problemom. Unikaj powtórzeń z sekcji o efektywności.',

    'internal_communication': 'Skup się na wymiarze "11. KOMUNIKACJA WEWNĘTRZNA" — przepływ informacji, współpraca między działami, delegowanie zadań, RODO w komunikacji wewnętrznej (CC/UDW).',

    'data_security': 'Skup się na wymiarze "12. BEZPIECZEŃSTWO DANYCH (RODO)" — stosowanie UDW, ochrona danych osobowych, właściwa forma odpowiedzi, procedury wewnętrzne. Podaj przykłady dobrych i złych praktyk.',

    'recommendations': `Zbierz i zsyntezuj rekomendacje ze WSZYSTKICH wymiarów analizy.

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

/**
 * Build the user prompt for synthesis — enforces brevity.
 */
function buildUserPrompt(input: SynthesisInput, resultsBlock: string): string {
  const parts: string[] = [];

  parts.push(
    `Napisz ZWIĘZŁE podsumowanie sekcji "${input.sectionTitle}" na podstawie kompleksowych analiz ${input.perThreadResults.length} wątków email.`
  );

  const focusPrompt = getSectionFocusPrompt(input.sectionKey);
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

  parts.push(
    `\nINSTRUKCJA: Napisz sekcję raportu zgodnie z FOKUSEM SEKCJI powyżej. Jeśli FOKUS wymaga podsekcji (## / ###), ZASTOSUJ JE. NIE używaj nagłówków # (tylko ## i ###). Przytaczaj wątki TYLKO jako krótkie wzmianki (np. „wątek: Awaria windy"). NIE opisuj każdego wątku z osobna — wyciągaj ogólne wnioski.`
  );

  return parts.join('\n');
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
  const resultsBlock = formatResultsForPrompt(input.perThreadResults);
  const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);
  const userPrompt = buildUserPrompt(input, truncatedBlock);

  const response = await callAI(aiConfig, SYNTHESIS_SYSTEM_PROMPT, userPrompt);

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
  // Use full aiConfig.maxTokens — reasoning models need ample token budget
  const { perThreadResults, sectionTitle } = input;
  const startTime = Date.now();
  let totalTokens = 0;

  // Split into sub-batches
  const batches: PerThreadResult[][] = [];
  for (let i = 0; i < perThreadResults.length; i += SUB_BATCH_SIZE) {
    batches.push(perThreadResults.slice(i, i + SUB_BATCH_SIZE));
  }

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

    const response = await callAI(aiConfig, SYNTHESIS_SYSTEM_PROMPT, userPrompt);
    batchSummaries.push(
      `## Grupa ${i + 1} (wątki ${i * SUB_BATCH_SIZE + 1}-${Math.min((i + 1) * SUB_BATCH_SIZE, perThreadResults.length)})\n\n${response.content}`
    );
    totalTokens += response.tokensUsed;
  }

  // Meta-synthesis: combine batch summaries into brief final output
  const metaPrompt = `Masz ${batches.length} częściowych syntez sekcji "${sectionTitle}" z łącznie ${perThreadResults.length} wątków email.

Skrzynka: ${input.mailboxName}
${input.dateRange ? `Okres: ${input.dateRange.from} — ${input.dateRange.to}` : ''}

CZĘŚCIOWE SYNTEZY:

${batchSummaries.join('\n---\n')}

INSTRUKCJA: Napisz KOŃCOWĄ syntezę w MAX 8-12 zdaniach. Połącz wnioski, usuń redundancje. Podaj ogólną ocenę i główne wzorce. Przykłady wątków TYLKO przy ekstremalnych przypadkach.`;

  const metaResponse = await callAI(
    aiConfig,
    SYNTHESIS_SYSTEM_PROMPT,
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
