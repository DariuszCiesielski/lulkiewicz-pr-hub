/**
 * Report Synthesizer — AI-driven REDUCE phase.
 *
 * Aggregates per-thread analysis results into a concise synthetic report.
 * Each section is synthesized independently via a callAI request.
 *
 * For >100 threads: batches of 30 → synthesize each → meta-synthesis.
 */

import { callAI, loadAIConfig } from '@/lib/ai/ai-provider';
import type { AIConfig } from '@/lib/ai/ai-provider';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max characters sent per synthesis request (guard against token overflow). */
const MAX_INPUT_CHARS = 100_000;

/** Batch size for large thread sets — synthesize in sub-batches then merge. */
const SUB_BATCH_SIZE = 30;

/** Threshold: if more per-thread results than this, use two-level synthesis. */
const TWO_LEVEL_THRESHOLD = 100;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYNTHESIS_SYSTEM_PROMPT = `Jesteś ekspertem ds. zarządzania nieruchomościami, tworzącym profesjonalny raport syntetyczny.

ZASADY:
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Dla każdej sekcji raportu napisz 1-3 strony — zwięźle, ale treściwie.
3. Wyciągaj KLUCZOWE wnioski, nie przepisuj surowych danych.
4. Odwołuj się do konkretnych wątków (podaj tematy lub numery referencyjne).
5. Identyfikuj wzorce i trendy powtarzające się w wielu wątkach.
6. Używaj nagłówków, list i tabel markdown dla czytelności.
7. Unikaj redundancji — jeśli temat pojawia się w wielu wątkach, opisz go RAZ z listą źródeł.
8. Priorytetyzuj — najważniejsze wnioski na początku sekcji.`;

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
 * Format per-thread results into a single prompt block.
 */
function formatResultsForPrompt(results: PerThreadResult[]): string {
  return results
    .map(
      (r, i) =>
        `### Wątek ${i + 1}: ${r.threadSubject || '(brak tematu)'}\n\n${r.content}`
    )
    .join('\n\n---\n\n');
}

/**
 * Build the user prompt for synthesis.
 */
function buildUserPrompt(input: SynthesisInput, resultsBlock: string): string {
  const parts: string[] = [];

  parts.push(
    `Zsyntetyzuj wyniki analizy sekcji "${input.sectionTitle}" z ${input.perThreadResults.length} wątków email.`
  );
  parts.push(`Skrzynka: ${input.mailboxName}`);

  if (input.dateRange) {
    parts.push(`Okres: ${input.dateRange.from} — ${input.dateRange.to}`);
  }

  parts.push(`Typ raportu: ${input.templateType === 'client' ? 'kliencki (zewnętrzny)' : 'wewnętrzny (pełny)'}`);

  if (input.globalContext) {
    parts.push(`\nKONTEKST RAPORTU (instrukcja użytkownika):\n${input.globalContext}`);
  }

  parts.push(`\nWYNIKI ANALIZY PER WĄTEK:\n\n${resultsBlock}`);

  parts.push(
    `\nNapisz syntetyczne podsumowanie tej sekcji. Odwołuj się do konkretnych wątków (podaj ich temat). Wyciągnij kluczowe wnioski i wzorce.`
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
  const { perThreadResults, sectionKey, sectionTitle } = input;

  // Single-thread: return as-is (no synthesis needed)
  if (perThreadResults.length === 1) {
    return {
      sectionKey,
      markdown: perThreadResults[0].content,
      tokensUsed: 0,
      processingTimeMs: 0,
    };
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
  const { perThreadResults, sectionKey, sectionTitle } = input;
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

  // Meta-synthesis: combine batch summaries
  const metaPrompt = `Masz ${batches.length} częściowych syntez sekcji "${sectionTitle}" z łącznie ${perThreadResults.length} wątków email.

Skrzynka: ${input.mailboxName}
${input.dateRange ? `Okres: ${input.dateRange.from} — ${input.dateRange.to}` : ''}
${input.globalContext ? `\nKONTEKST RAPORTU:\n${input.globalContext}` : ''}

CZĘŚCIOWE SYNTEZY:

${batchSummaries.join('\n\n---\n\n')}

Napisz KOŃCOWĄ syntezę tej sekcji. Połącz wnioski z wszystkich grup, usuń redundancje, wyciągnij kluczowe wzorce i trendy. Odwołuj się do konkretnych wątków.`;

  const metaResponse = await callAI(
    aiConfig,
    SYNTHESIS_SYSTEM_PROMPT,
    truncateToLimit(metaPrompt, MAX_INPUT_CHARS)
  );

  totalTokens += metaResponse.tokensUsed;

  return {
    sectionKey,
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
