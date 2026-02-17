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

/** Max completion tokens per section — ~0.4 page.
 *  13 sections × 600 tokens ≈ 7800 tokens ≈ 5-6 pages total. */
const SYNTHESIS_MAX_TOKENS = 600;

/** Threshold: if more per-thread results than this, use two-level synthesis. */
const TWO_LEVEL_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYNTHESIS_SYSTEM_PROMPT = `Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz ZWIĘZŁY raport kierowniczy.

KRYTYCZNE ZASADY ZWIĘZŁOŚCI:
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Każda sekcja raportu to MAKSYMALNIE 8-12 zdań (pół strony A4).
3. NIE opisuj każdego wątku z osobna — wyciągaj OGÓLNE wnioski i wzorce.
4. Podawaj konkretne przykłady TYLKO w przypadkach ekstremalnych (rażące naruszenia, wyjątkowe osiągnięcia).
5. Przykłady: max 1-2 per sekcja, jako krótkie wzmianki w nawiasie (np. „wątek: Awaria windy").
6. Używaj wypunktowań zamiast rozbudowanej prozy.
7. NIE twórz tabel, NIE wymieniaj każdego wątku z osobna.
8. Zamiast „w wątku X zaobserwowano Y, w wątku Z zaobserwowano W" napisz „Zaobserwowano trend Y (np. wątki X, Z)".
9. Skup się na: (a) ogólna ocena, (b) główne wzorce/trendy, (c) kluczowe rekomendacje.
10. Cały raport (wszystkie sekcje razem) ma zmieścić się w 5-6 stronach A4.`;

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
    'metadata_analysis': 'Wyodrębnij informacje o typach spraw, uczestnikach, zakresie dat i ograniczeniach analizy. Szukaj wzorców w wymiarze "1. METADANE".',
    'response_speed': 'Skup się na wymiarze "2. SZYBKOŚĆ REAKCJI" — czasy odpowiedzi, potwierdzenia odbioru, benchmarki. Podaj statystyki (% poniżej 4h, % powyżej 3 dni).',
    'service_effectiveness': 'Skup się na wymiarze "3. EFEKTYWNOŚĆ OBSŁUGI" — zamknięcie tematu, kompletność informacji, proaktywność w odpowiedziach.',
    'client_relationship': 'Skup się na wymiarze "4. JAKOŚĆ RELACJI Z KLIENTEM" — ton komunikacji, budowanie zaufania, indywidualne podejście.',
    'communication_cycle': 'Skup się na wymiarze "5. CYKL KOMUNIKACJI" — liczba wymian, ciągłość, spójność, status rozwiązania.',
    'client_feedback': 'Skup się na wymiarze "6. SATYSFAKCJA KLIENTA" — sygnały pozytywne/negatywne, zmiana tonu.',
    'expression_form': 'Skup się na wymiarze "7. FORMA WYPOWIEDZI" — styl językowy, powitania, personalizacja, konsekwencja.',
    'recipient_clarity': 'Skup się na wymiarze "8. JASNOŚĆ KOMUNIKACJI" — przejrzystość, czytelność, profesjonalizm.',
    'organization_consistency': 'Skup się na wymiarze "9. SPÓJNOŚĆ ORGANIZACYJNA" — standardy, podpisy, jednolitość stylu.',
    'proactive_actions': 'Skup się na wymiarze "10. PROAKTYWNOŚĆ" — inicjatywa własna, monitorowanie, zapobieganie.',
    'internal_communication': 'Skup się na wymiarze "11. KOMUNIKACJA WEWNĘTRZNA" — przepływ informacji, współpraca, RODO.',
    'data_security': 'Skup się na wymiarze "12. BEZPIECZEŃSTWO DANYCH" — UDW, ochrona danych osobowych, procedury.',
    'recommendations': 'Skup się na wymiarze "13. REKOMENDACJE" — zbierz rekomendacje ze wszystkich wątków, pogrupuj, ustal priorytety.',
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
    `\nINSTRUKCJA: Napisz MAX 8-12 zdań. Podaj ogólną ocenę, główne wzorce i 1-2 kluczowe rekomendacje. Przytaczaj konkretne wątki TYLKO jako krótkie wzmianki przy ekstremalnych przypadkach. NIE opisuj każdego wątku z osobna.`
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
  const synthConfig = { ...aiConfig, maxTokens: Math.min(aiConfig.maxTokens, SYNTHESIS_MAX_TOKENS) };
  const resultsBlock = formatResultsForPrompt(input.perThreadResults);
  const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);
  const userPrompt = buildUserPrompt(input, truncatedBlock);

  const response = await callAI(synthConfig, SYNTHESIS_SYSTEM_PROMPT, userPrompt);

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
  const synthConfig = { ...aiConfig, maxTokens: Math.min(aiConfig.maxTokens, SYNTHESIS_MAX_TOKENS) };
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

    const response = await callAI(synthConfig, SYNTHESIS_SYSTEM_PROMPT, userPrompt);
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
    synthConfig,
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
