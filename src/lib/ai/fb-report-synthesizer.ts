/**
 * FB Report Synthesizer — AI-driven synthesis for Facebook monitoring reports.
 *
 * Generates report sections from analyzed FB posts:
 *  - Group analysis (sentiment breakdown, categories, trends)
 *  - Risk assessment (negative posts, PR risks)
 *  - Recommendations (actionable table per group)
 *  - Developer summary (cross-group executive overview)
 *
 * Separate from email report-synthesizer.ts — FB posts have different
 * data shape (sentiment, relevance, categories vs email threads).
 */

import { callAI } from '@/lib/ai/ai-provider';
import type { AIConfig } from '@/lib/ai/ai-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FbPostForSynthesis {
  content: string;
  sentiment: string | null;
  relevance_score: number | null;
  ai_snippet: string | null;
  ai_categories: string[] | null;
  post_url: string | null;
  posted_at: string | null;
  author_name: string | null;
  group_name: string;
}

export interface FbSynthesisOutput {
  markdown: string;
  tokensUsed: number;
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max characters sent per synthesis request.
 *  60K chars ~ 15K tokens input — keeps within model context window. */
const MAX_INPUT_CHARS = 60_000;

// ---------------------------------------------------------------------------
// System prompt (shared by all FB synthesis functions)
// ---------------------------------------------------------------------------

const FB_REPORT_SYSTEM_PROMPT = `Jesteś ekspertem ds. monitoringu mediów społecznościowych i zarządzania reputacją deweloperów mieszkaniowych. Analizujesz posty z grup mieszkańców na Facebooku.

ZASADY:
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Wyciągaj OGÓLNE wnioski i wzorce — NIE opisuj każdego postu z osobna.
3. Cytuj posty TYLKO przy ekstremalnych/ważnych przypadkach (max 2-3 cytaty per sekcja).
4. Przy cytowaniu podawaj link do postu w formacie markdown: [link](url)
5. Styl: managerski brief — zwięzły, konkretny, z liczbami.`;

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

/**
 * Format posts into a compact numbered block for the AI prompt.
 */
function formatPostsForPrompt(posts: FbPostForSynthesis[]): string {
  return posts
    .map(
      (p, i) =>
        `[${i + 1}] ${p.author_name || '(anonimowy)'} (${p.posted_at || 'brak daty'}) — sentyment: ${p.sentiment || 'brak'}, score: ${p.relevance_score ?? 'brak'}
Treść: ${p.content}
AI: ${p.ai_snippet || '(brak)'}
Kategorie: ${p.ai_categories?.join(', ') || '(brak)'}
Link: ${p.post_url || '(brak)'}`
    )
    .join('\n---\n');
}

/**
 * Truncate text to fit within character limit, preserving complete entries.
 * Cuts at last `\n---\n` separator if over limit.
 */
function truncateToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  const lastSep = truncated.lastIndexOf('\n---\n');
  if (lastSep > limit * 0.5) {
    return truncated.slice(0, lastSep) + '\n\n[...dane obcięte ze względu na limit...]';
  }
  return truncated + '\n\n[...dane obcięte ze względu na limit...]';
}

/**
 * Format date range string for prompts.
 */
function formatDateRange(dateRange?: { from: string; to: string }): string {
  return dateRange ? `${dateRange.from} — ${dateRange.to}` : '(cały dostępny okres)';
}

// ---------------------------------------------------------------------------
// User prompt builders (private)
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(
  groupName: string,
  postsBlock: string,
  totalPosts: number,
  dateRange?: { from: string; to: string }
): string {
  return `Napisz podsumowanie analizy grupy "${groupName}" za okres ${formatDateRange(dateRange)}.

WYMAGANE ELEMENTY:
- Ogólna ocena sytuacji w grupie (1-2 zdania)
- Rozkład sentymentu: ile postów pozytywnych/negatywnych/neutralnych (podaj liczby i %)
- Top 3-5 kategorii tematycznych z liczbą postów
- Trendy i wzorce (czy jest eskalacja problemów? poprawa?)
- Kluczowe tematy wymagające uwagi zarządcy

Format: zwięzła proza z listami punktowanymi gdzie potrzebne. Max 300 słów.

DANE ŹRÓDŁOWE (${totalPosts} postów):
${postsBlock}`;
}

function buildRiskPrompt(
  groupName: string,
  postsBlock: string,
  totalPosts: number,
  dateRange?: { from: string; to: string }
): string {
  return `Zidentyfikuj ryzyka PR dla zarządcy/dewelopera na podstawie negatywnych postów z grupy "${groupName}".

WYMAGANE ELEMENTY:
- Lista ryzyk PR (max 5) z oceną powagi (niskie/średnie/wysokie/krytyczne)
- Dla każdego ryzyka: krótki opis + cytaty z postów z linkami [link](url)
- Powtarzające się skargi (ile osób zgłasza ten sam problem?)
- Posty z największym zasięgiem (dużo reakcji/komentarzy) — potencjalne virale
- Tematy mogące eskalować do mediów tradycyjnych

Format: lista ryzyk z podpunktami. Max 400 słów.

Okres: ${formatDateRange(dateRange)}

DANE ŹRÓDŁOWE (${totalPosts} negatywnych postów z relevance >= 7):
${postsBlock}`;
}

function buildRecommendationsPrompt(
  groupName: string,
  postsBlock: string,
  totalPosts: number,
  previousSections: string,
  dateRange?: { from: string; to: string }
): string {
  return `Na podstawie analizy grupy "${groupName}" zaproponuj rekomendacje dla zarządcy nieruchomości.

KONTEKST WCZEŚNIEJSZEJ ANALIZY:
${previousSections}

WYMAGANY FORMAT — tabela markdown:

| # | Rekomendacja | Priorytet | Kategoria |
|---|---|---|---|
| 1 | Opis... | Pilne / Krótkoterminowe / Długoterminowe | Komunikacja / Naprawy / Procesy / Bezpieczeństwo |

Po tabeli dodaj 1-2 zdania o najważniejszych priorytetach dla tej grupy.
Max 5-7 rekomendacji.

Okres: ${formatDateRange(dateRange)}

DANE ŹRÓDŁOWE (${totalPosts} postów):
${postsBlock}`;
}

function buildDeveloperSummaryPrompt(
  groupSections: { groupName: string; content: string }[],
  developerName: string,
  dateRange?: { from: string; to: string }
): string {
  const groupBlocks = groupSections
    .map((g) => `=== GRUPA: ${g.groupName} ===\n${g.content}`)
    .join('\n\n---\n\n');

  return `Napisz podsumowanie cross-group dla dewelopera "${developerName}" na podstawie raportów z ${groupSections.length} grup.

WYMAGANE ELEMENTY:
- Ogólna ocena reputacji dewelopera (1-3 zdania)
- Wzorce powtarzające się w wielu grupach (jakie problemy pojawiają się często?)
- Top 3 ryzyk PR — cross-group (które problemy mogą eskalować?)
- Grupy wymagające szczególnej uwagi (wymień z uzasadnieniem)
- Strategiczne rekomendacje (max 3-5, tabela markdown jak w sekcji rekomendacji per grupa)

Format: zwięzły raport executive summary. Max 500 słów.

Okres: ${formatDateRange(dateRange)}

RAPORTY Z GRUP:
${groupBlocks}`;
}

// ---------------------------------------------------------------------------
// Exported synthesis functions
// ---------------------------------------------------------------------------

/**
 * Synthesize a group analysis section — sentiment breakdown, categories, trends.
 */
export async function synthesizeGroupAnalysis(
  aiConfig: AIConfig,
  posts: FbPostForSynthesis[],
  groupName: string,
  dateRange?: { from: string; to: string }
): Promise<FbSynthesisOutput> {
  const startTime = Date.now();
  const resultsBlock = formatPostsForPrompt(posts);
  const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);

  const userPrompt = buildAnalysisPrompt(groupName, truncatedBlock, posts.length, dateRange);

  const response = await callAI(aiConfig, FB_REPORT_SYSTEM_PROMPT, userPrompt);

  return {
    markdown: response.content,
    tokensUsed: response.tokensUsed,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Synthesize PR risk assessment — filters to negative posts with high relevance.
 */
export async function synthesizeGroupRisk(
  aiConfig: AIConfig,
  posts: FbPostForSynthesis[],
  groupName: string,
  dateRange?: { from: string; to: string }
): Promise<FbSynthesisOutput> {
  const startTime = Date.now();

  // Filter to negative posts with relevance >= 7
  const negativePosts = posts.filter(
    (p) =>
      p.sentiment === 'negative' &&
      (p.relevance_score ?? 0) >= 7
  );

  // If no negative posts match filter, return early with a note
  if (negativePosts.length === 0) {
    return {
      markdown: `Brak negatywnych postów o wysokiej istotności (relevance >= 7) w grupie "${groupName}" w analizowanym okresie. Nie zidentyfikowano bezpośrednich ryzyk PR.`,
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }

  const resultsBlock = formatPostsForPrompt(negativePosts);
  const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);

  const userPrompt = buildRiskPrompt(groupName, truncatedBlock, negativePosts.length, dateRange);

  const response = await callAI(aiConfig, FB_REPORT_SYSTEM_PROMPT, userPrompt);

  return {
    markdown: response.content,
    tokensUsed: response.tokensUsed,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Synthesize recommendations — uses previous analysis + risk sections as context.
 */
export async function synthesizeGroupRecommendations(
  aiConfig: AIConfig,
  posts: FbPostForSynthesis[],
  groupName: string,
  previousSections: string,
  dateRange?: { from: string; to: string }
): Promise<FbSynthesisOutput> {
  const startTime = Date.now();
  const resultsBlock = formatPostsForPrompt(posts);
  const truncatedBlock = truncateToLimit(resultsBlock, MAX_INPUT_CHARS);

  const userPrompt = buildRecommendationsPrompt(
    groupName,
    truncatedBlock,
    posts.length,
    previousSections,
    dateRange
  );

  const response = await callAI(aiConfig, FB_REPORT_SYSTEM_PROMPT, userPrompt);

  return {
    markdown: response.content,
    tokensUsed: response.tokensUsed,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Synthesize cross-group developer summary from per-group report sections.
 */
export async function synthesizeDeveloperSummary(
  aiConfig: AIConfig,
  groupSections: { groupName: string; content: string }[],
  developerName: string,
  dateRange?: { from: string; to: string }
): Promise<FbSynthesisOutput> {
  const startTime = Date.now();

  const userPrompt = buildDeveloperSummaryPrompt(groupSections, developerName, dateRange);
  const truncatedPrompt = truncateToLimit(userPrompt, MAX_INPUT_CHARS);

  const response = await callAI(aiConfig, FB_REPORT_SYSTEM_PROMPT, truncatedPrompt);

  return {
    markdown: response.content,
    tokensUsed: response.tokensUsed,
    processingTimeMs: Date.now() - startTime,
  };
}
