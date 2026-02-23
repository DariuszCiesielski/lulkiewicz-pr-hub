# Phase 10: AI Sentiment Analysis - Research

**Researched:** 2026-02-23
**Domain:** OpenAI structured JSON output, Polish sentiment analysis, batch AI processing, prompt engineering
**Confidence:** HIGH (codebase patterns verified from source, OpenAI structured outputs verified via official docs)

## Summary

Phase 10 implements AI analysis of scraped Facebook posts. Each post gets classified with: sentiment (positive/negative/neutral), relevance_score (0-10), ai_snippet (1-2 sentences), ai_categories (from 11 predefined categories), and is_relevant flag. The architecture reuses the proven polling-based batch processing pattern from the email analyzer (`useAnalysisJob` + `/api/analysis/process`), adapted for FB posts.

Research confirmed that GPT-5.2 supports `response_format: { type: "json_schema" }` for structured outputs, guaranteeing valid JSON adherence to a defined schema. This eliminates the need for manual JSON parsing/validation and retry loops. The existing `callAI()` function needs a small extension to pass `response_format` parameter. The FB-specific pattern is simpler than email analysis: results are stored directly on `fb_posts` columns (no separate results table), and each post gets 1 AI call producing structured JSON.

For Polish sentiment analysis on social media, the prompt must explicitly handle: sarcasm (very common in Polish Facebook complaints), colloquialisms (e.g., "kicha" = terrible, "masakra" = disaster), passive-aggressive complaints disguised as polite questions, and Polish-specific abbreviations. The keyword boosting system uses a hybrid approach: pre-AI regex matching identifies keyword hits, then AI receives both the post and keyword context to produce an informed relevance score.

**Primary recommendation:** Implement 3 API routes (`/api/fb/analysis`, `/api/fb/analysis/process`, `/api/fb/analysis/pause`) with `useFbAnalysisJob` hook. Use `response_format: { type: "json_schema" }` for guaranteed structured JSON. Process 5 posts per `/process` request (parallel via `Promise.allSettled`). Store results directly on `fb_posts` columns. Reuse `prompt_templates` table with section_key `_fb_post_analysis` for editable prompt. Store keywords in `fb_settings` with key `fb_keywords` (value_plain, JSON array).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai-provider.ts` (existing) | -- | `loadAIConfig()` + `callAI()` with structured output extension | Proven, handles encryption, timeout, auth |
| `admin.ts` (existing) | -- | `verifyAdmin()` + `getAdminClient()` | Shared admin module, 21+ routes |
| `pricing.ts` (existing) | -- | `calculateCost()` for cost tracking | Per-model pricing, exact prompt/completion split |
| `prompt_templates` (existing table) | -- | Editable prompts via `/api/prompts` | Full CRUD already built, 3-tier system |
| `fb_settings` (existing table) | -- | Keywords config storage | Key-value store with upsert, proven pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useAnalysisJob.ts` pattern | -- | Polling hook template for `useFbAnalysisJob` | Adapted (simpler interface, FB-specific) |
| `fb.ts` types (existing) | -- | `FbPost`, `FbAnalysisJob`, `FbSentiment` | Already defined, matches DB schema |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `response_format: json_schema` | `response_format: json_object` + manual parsing | json_schema gives guaranteed schema adherence, json_object only guarantees valid JSON |
| 1 post per AI call | Batch N posts in 1 call | Accuracy drops with batching; 1 post = simple, reliable, matches email-analyzer pattern |
| OpenAI Batch API (50% cheaper) | Real-time Chat Completions | Batch API has 24h latency -- unacceptable for interactive UI with progress bar |
| Separate `fb_analysis_results` table | Direct UPDATE on `fb_posts` | No need for separate table -- fb_posts already has all columns, simpler queries |

**Installation:**
```bash
# ZERO new npm packages. Everything uses existing dependencies.
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/api/fb/
    analysis/
      route.ts              # POST: create analysis job, GET: list jobs
      process/
        route.ts            # POST: process batch of posts (5 per request)
      pause/
        route.ts            # POST: pause/resume analysis job
  hooks/
    useFbAnalysisJob.ts     # Client-side polling hook (adapted from useAnalysisJob)
  lib/fb/
    fb-analysis-prompt.ts   # System + user prompt, JSON schema definition
    fb-keywords.ts          # Keyword matching logic (pre-AI boost)
  components/fb/
    FbAnalysisPanel.tsx     # Analysis launch UI with progress bar
```

### Pattern 1: Polling-Based Batch Processing (Reuse from Email Analyzer)

**What:** Client hook polls `/api/fb/analysis/process` with jobId. Each call processes N posts and returns `{ hasMore, analyzedPosts, totalPosts }`.
**When to use:** Always -- this is the core analysis pattern.

```
UI: Click "Analizuj" on group
  |
  v
POST /api/fb/analysis { groupId }
  - verifyAdmin()
  - Check no active analysis job for this group
  - Count unanalyzed posts: WHERE group_id = X AND sentiment IS NULL
  - Create fb_analysis_jobs row (status: 'pending', total_posts: count)
  - Return { jobId, totalPosts }
  |
  v
useFbAnalysisJob hook starts polling:
  POST /api/fb/analysis/process { jobId }
    - Load job, verify status
    - Load AI config
    - Load prompt (from prompt_templates or default)
    - Load keywords (from fb_settings)
    - Get next POSTS_PER_REQUEST=5 unanalyzed posts
    - Process all 5 in parallel (Promise.allSettled)
    - For each post:
      1. Pre-check keyword matches (regex)
      2. Build user prompt with post content + keyword context
      3. Call AI with response_format: json_schema
      4. Parse structured response (guaranteed valid)
      5. UPDATE fb_posts SET sentiment, relevance_score, ai_snippet, ai_categories
    - Update fb_analysis_jobs (analyzed_posts, progress)
    - Return { hasMore, analyzedPosts, totalPosts, status }
  |
  v (repeat every 800ms until hasMore=false)
  |
  v
Completed: fb_analysis_jobs status = 'completed'
```

### Pattern 2: Structured JSON Output via response_format

**What:** GPT-5.2 receives a JSON schema and returns guaranteed-valid structured output.
**When to use:** Every AI call for post analysis.

```typescript
// Extension to callAI() -- add optional response_format parameter
export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  responseFormat?: { type: string; json_schema?: object }
): Promise<AIResponse> {
  // ... existing code ...
  body: JSON.stringify({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: config.temperature,
    max_completion_tokens: config.maxTokens,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  }),
}
```

**JSON Schema for post analysis:**
```typescript
const FB_POST_ANALYSIS_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "fb_post_analysis",
    strict: true,
    schema: {
      type: "object",
      properties: {
        is_relevant: { type: "boolean" },
        sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
        relevance_score: { type: "integer", minimum: 0, maximum: 10 },
        categories: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "oplaty", "naprawy", "czystosc", "bezpieczenstwo",
              "zielen", "komunikacja", "finanse", "prawo",
              "sasiedzi", "pochwaly", "inne"
            ]
          }
        },
        ai_snippet: { type: "string" }
      },
      required: ["is_relevant", "sentiment", "relevance_score", "categories", "ai_snippet"],
      additionalProperties: false
    }
  }
};
```

### Pattern 3: Keyword Boosting (Hybrid Pre-AI + AI-Instructed)

**What:** Keywords are checked via regex before AI call. Matches are passed to AI as context, influencing the relevance score.
**When to use:** When keywords are configured (per-group or global).

```typescript
// Pre-AI keyword matching
function matchKeywords(content: string, keywords: string[]): string[] {
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => lowerContent.includes(kw.toLowerCase()));
}

// Include in user prompt:
// "Znalezione slowa kluczowe w tresci: [winda, awaria]. Uwzglednij to przy ocenie relevance_score."
```

### Pattern 4: Prompt Resolution (3-level hierarchy)

**What:** AI prompt comes from a 3-level hierarchy: per-group `ai_instruction` > per-developer `developer_instruction:{name}` > default/edited prompt from `prompt_templates`.
**When to use:** Every analysis job start.

```typescript
async function resolvePrompt(
  adminClient: SupabaseClient,
  group: FbGroup
): Promise<{ systemPrompt: string; userPromptTemplate: string }> {
  // 1. Check prompt_templates for section_key '_fb_post_analysis'
  const { data: dbPrompt } = await adminClient
    .from('prompt_templates')
    .select('system_prompt, user_prompt_template')
    .eq('section_key', '_fb_post_analysis')
    .eq('is_active', true)
    .eq('tier', 'global')
    .single();

  const baseSystemPrompt = dbPrompt?.system_prompt || DEFAULT_FB_SYSTEM_PROMPT;
  const baseUserTemplate = dbPrompt?.user_prompt_template || DEFAULT_FB_USER_PROMPT;

  // 2. Append per-developer instruction (if exists)
  let extraInstruction = '';
  if (group.developer) {
    const { data: devSetting } = await adminClient
      .from('fb_settings')
      .select('value_plain')
      .eq('key', `developer_instruction:${group.developer}`)
      .single();
    if (devSetting?.value_plain) {
      extraInstruction += `\nInstrukcja per deweloper (${group.developer}): ${devSetting.value_plain}`;
    }
  }

  // 3. Append per-group instruction (if exists)
  if (group.ai_instruction) {
    extraInstruction += `\nInstrukcja per grupe: ${group.ai_instruction}`;
  }

  return {
    systemPrompt: baseSystemPrompt + extraInstruction,
    userPromptTemplate: baseUserTemplate,
  };
}
```

### Anti-Patterns to Avoid

- **Batching multiple posts in one AI call:** Accuracy drops significantly when AI must classify 5+ posts simultaneously. Each post deserves individual attention, especially for nuanced Polish sarcasm detection.
- **Using `response_format: json_object` instead of `json_schema`:** json_object mode only guarantees valid JSON, not schema adherence. With json_schema + strict:true, the output structure is enforced during token generation.
- **Storing analysis results in a separate table:** fb_posts already has all columns. A JOIN would add unnecessary complexity.
- **Setting low `max_completion_tokens`:** GPT-5.2 is a reasoning model. Low token limits cause empty responses (lesson from v1.0.6). Use full `aiConfig.maxTokens` (16384).
- **Parsing AI response manually with regex:** Never parse JSON from AI with regex. Use `JSON.parse()` on the guaranteed-valid structured output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON output validation | Custom JSON parser + retry | `response_format: json_schema` with strict:true | OpenAI guarantees schema adherence at token generation level |
| Prompt CRUD UI | New prompt editor for FB | Existing `/api/prompts` + PromptsPage pattern | Full editor already exists with save/reset/copy/delete |
| Cost tracking | Custom token counter | Existing `calculateCost()` from `pricing.ts` | Already handles GPT-5.2 pricing ($1.75/M in, $14/M out) |
| Polling hook | Build from scratch | Adapt `useAnalysisJob.ts` pattern | Proven: pause/resume, progress, error handling, auto-reconnect |
| Admin verification | New auth check | `verifyAdmin()` from `admin.ts` | Shared module, 21+ routes use it |
| Settings storage | New keywords table | `fb_settings` with key `fb_keywords` | Key-value store already exists, upsert API built |

**Key insight:** Phase 10 is 80% reuse of existing patterns. The only truly new code is: (1) the AI prompt for Polish social media analysis, (2) the JSON schema definition, and (3) the keyword matching logic. Everything else follows established patterns.

## Common Pitfalls

### Pitfall 1: GPT-5.2 Reasoning Token Budget

**What goes wrong:** Setting `max_completion_tokens` too low causes empty AI responses because reasoning tokens consume the budget before visible output tokens.
**Why it happens:** GPT-5.2 is a reasoning model that uses "thinking tokens" internally. A limit of 600 tokens = all budget on reasoning, 0 on response.
**How to avoid:** Use full `aiConfig.maxTokens` (16384). For structured output with ~200 bytes of JSON, the model still needs 2000+ tokens for reasoning.
**Warning signs:** Empty `content` field in AI response, or partial JSON. Already encountered in v1.0.6 (report synthesis fix).

### Pitfall 2: Schema Validation with additionalProperties

**What goes wrong:** Structured outputs silently ignore extra properties without `additionalProperties: false`, leading to inconsistent responses.
**Why it happens:** OpenAI's strict mode requires `additionalProperties: false` on every object in the schema.
**How to avoid:** Always set `additionalProperties: false` on all objects in the JSON schema. Always set `strict: true` on the json_schema config.
**Warning signs:** AI returns extra fields not in schema, or fields in unexpected format.

### Pitfall 3: Polish Sarcasm and Passive-Aggressive Tone

**What goes wrong:** AI classifies sarcastic negative posts as "positive" because surface text uses polite/positive words.
**Why it happens:** Polish social media users often express complaints sarcastically: "Och, jak cudownie ze winda znowu nie dziala" (Oh, how wonderful the elevator isn't working again).
**How to avoid:** System prompt must explicitly list Polish sarcasm patterns and instruct AI to look beyond surface sentiment. Include examples in the prompt.
**Warning signs:** Many "positive" posts with negative content when manually reviewed.

### Pitfall 4: Empty/Short Posts

**What goes wrong:** Posts with only emojis, images, or 1-2 word content waste AI calls and produce meaningless analysis.
**Why it happens:** Facebook groups have many low-content posts (reactions, shares, image-only).
**How to avoid:** Pre-filter: skip posts where `content` is NULL or length < 20 characters. Mark them as `is_relevant = false` without AI call.
**Warning signs:** High cost with many `is_relevant = false` results on very short posts.

### Pitfall 5: Re-Analysis Overwriting Previous Results

**What goes wrong:** Running analysis twice on the same group overwrites previous AI results without warning.
**Why it happens:** Analysis UPDATE directly modifies fb_posts columns.
**How to avoid:** Default behavior: skip posts that already have `sentiment IS NOT NULL`. Add a "force re-analyze" flag for when the user explicitly wants to re-run with a new prompt. Show warning in UI before re-analysis.
**Warning signs:** User edits prompt, runs analysis, and previous good results for unchanged posts get overwritten.

### Pitfall 6: Vercel 60s Timeout with 5 Parallel AI Calls

**What goes wrong:** If OpenAI is slow (cold start, high load), 5 parallel AI calls might each take 15s = 75s total, exceeding 60s limit.
**Why it happens:** GPT-5.2 reasoning models can take 5-20s per response depending on complexity and load.
**How to avoid:** The existing `callAI()` already has a 50s timeout (AbortController). With 5 parallel calls, the worst case is 50s (parallel, not sequential). Add a safety timeout check after Promise.allSettled to gracefully save progress.
**Warning signs:** Intermittent 504 errors on `/api/fb/analysis/process`.

## Code Examples

### Example 1: FB Post Analysis Prompt (Default)

```typescript
// Source: Codebase pattern from thread-summary-prompt.ts + FB domain expertise
export const FB_POST_ANALYSIS_SECTION_KEY = '_fb_post_analysis';

export const FB_POST_ANALYSIS_SYSTEM_PROMPT = `Jestes ekspertem ds. zarzadzania nieruchomosciami, specjalizujesz sie w analizie opinii mieszkancow z mediow spolecznosciowych.

Analizujesz posty z grup Facebook dotyczacych osiedli mieszkaniowych. Szukasz opinii waznych dla zarzadcy nieruchomosci: skargi, pochwaly, pytania, informacje o usterkach, problemy z oplaty, bezpieczenstwo, czystosc.

WAZNE — cechy polskiego jezyka w mediach spolecznosciowych:
- Sarkazm: "Och, jak cudownie ze winda znowu nie dziala" = NEGATYWNY, nie pozytywny
- Grzeczne skargi: "Czy ktos moze mi wytlumaczyc dlaczego..." = NEGATYWNY (ukryta skarga)
- Kolokwializmy: "kicha", "masakra", "dramat", "zenada" = NEGATYWNY
- Emocjonalne wielkie litery: "UWAGA!", "SKANDAL!" = NEGATYWNY, wysokie relevance
- Ironia: "Super zarzadzanie, gratulacje" w kontekscie skargi = NEGATYWNY
- Pasywno-agresywny ton: "Milo by bylo gdyby ktos wreszcie..." = NEGATYWNY

Odpowiadasz WYLACZNIE w formacie JSON zgodnym z podanym schematem.`;

export const FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE = `Przeanalizuj ponizszy post z grupy mieszkancow na Facebooku.

POST:
{{post_content}}

METADATA:
- Grupa: {{group_name}}
- Autor: {{author_name}}
- Data: {{posted_at}}
- Reakcje: {{likes_count}} polubien, {{comments_count}} komentarzy
{{keyword_context}}
{{extra_instructions}}

ZADANIE:
1. Okresil czy post jest ISTOTNY dla zarzadcy nieruchomosci (is_relevant)
2. Okresil sentyment: positive (pochwala/zadowolenie), negative (skarga/problem/niezadowolenie), neutral (pytanie/informacja neutralna)
3. Przypisz relevance_score od 0 do 10:
   - 0-2: nieistotne (sprzedaz/kupno, offtopic, reklamy)
   - 3-4: malo istotne (ogolne pytania, organizacja imprez)
   - 5-6: srednia istotnosc (pytania o procedury, informacje ogolne)
   - 7-8: istotne (problemy wymagajace uwagi zarzadcy)
   - 9-10: pilne (bezpieczenstwo, powazne awarie, powtarzajace sie skargi)
4. Przypisz 1-3 kategorie tematyczne
5. Napisz krotkie streszczenie AI (1-2 zdania, po polsku)

Jesli post zawiera znalezione slowa kluczowe, podwyzsz relevance_score o 1-2 punkty.`;
```

### Example 2: Extended callAI with response_format

```typescript
// Source: Existing ai-provider.ts + OpenAI structured outputs docs
export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  responseFormat?: { type: string; json_schema?: { name: string; strict: boolean; schema: object } }
): Promise<AIResponse> {
  const startTime = Date.now();
  const baseUrl = config.provider === 'azure'
    ? process.env.AZURE_OPENAI_ENDPOINT
    : 'https://api.openai.com/v1';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: config.temperature,
    max_completion_tokens: config.maxTokens,
  };

  if (responseFormat) {
    requestBody.response_format = responseFormat;
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Przekroczono limit czasu wywolania AI (50s). Sprobuj ponownie.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      `Blad API AI (${res.status}): ${errData.error?.message || 'Nieznany blad'}`
    );
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    processingTimeMs: Date.now() - startTime,
  };
}
```

### Example 3: Process Route Core Logic

```typescript
// Source: Adapted from /api/analysis/process/route.ts
export const maxDuration = 60;

const POSTS_PER_REQUEST = 5; // 5 parallel AI calls fit in 50s timeout
const MAX_RETRIES = 2;
const MIN_CONTENT_LENGTH = 20; // Skip very short posts

// Inside POST handler:
// 1. Load unanalyzed posts
const { data: pendingPosts } = await adminClient
  .from('fb_posts')
  .select('id, content, author_name, posted_at, likes_count, comments_count, group_id')
  .eq('group_id', job.group_id)
  .is('sentiment', null)
  .not('content', 'is', null)
  .order('posted_at', { ascending: false })
  .limit(POSTS_PER_REQUEST);

// 2. Pre-filter short posts (mark as irrelevant without AI call)
const toAnalyze = [];
const toSkip = [];
for (const post of pendingPosts || []) {
  if (!post.content || post.content.length < MIN_CONTENT_LENGTH) {
    toSkip.push(post.id);
  } else {
    toAnalyze.push(post);
  }
}

// Mark short posts as irrelevant
if (toSkip.length > 0) {
  await adminClient
    .from('fb_posts')
    .update({
      sentiment: 'neutral',
      relevance_score: 0,
      ai_snippet: '(Post zbyt krotki do analizy)',
      ai_categories: ['inne'],
    })
    .in('id', toSkip);
}

// 3. Process in parallel
await Promise.allSettled(
  toAnalyze.map(async (post) => {
    const keywordMatches = matchKeywords(post.content, keywords);
    const userPrompt = buildUserPrompt(post, group, keywordMatches, extraInstructions);

    const response = await callAI(aiConfig, systemPrompt, userPrompt, FB_POST_ANALYSIS_SCHEMA);
    const result = JSON.parse(response.content); // Guaranteed valid by structured output

    // Apply keyword boost
    let adjustedScore = result.relevance_score;
    if (keywordMatches.length > 0 && adjustedScore < 10) {
      adjustedScore = Math.min(10, adjustedScore + Math.min(keywordMatches.length, 2));
    }

    await adminClient
      .from('fb_posts')
      .update({
        sentiment: result.sentiment,
        relevance_score: adjustedScore,
        ai_snippet: result.ai_snippet,
        ai_categories: result.categories,
      })
      .eq('id', post.id);
  })
);
```

### Example 4: useFbAnalysisJob Hook (Simplified from useAnalysisJob)

```typescript
// Source: Adapted from hooks/useAnalysisJob.ts
'use client';

export type FbAnalysisUIStatus = 'idle' | 'starting' | 'processing' | 'paused' | 'completed' | 'error';

export interface FbAnalysisProgress {
  analyzedPosts: number;
  totalPosts: number;
  percentage: number;
}

export interface UseFbAnalysisJobReturn {
  startAnalysis: (groupId: string) => Promise<void>;
  pauseJob: () => Promise<void>;
  resumeJob: (jobId: string, analyzedPosts: number, totalPosts: number) => void;
  status: FbAnalysisUIStatus;
  progress: FbAnalysisProgress;
  error: string | null;
  jobId: string | null;
  reset: () => void;
}

const BATCH_DELAY_MS = 800; // Same as email analyzer

// Hook follows exact same pattern as useAnalysisJob:
// 1. startAnalysis() -> POST /api/fb/analysis -> processBatch()
// 2. processBatch() -> POST /api/fb/analysis/process -> update progress -> setTimeout(processBatch, 800ms)
// 3. pauseJob() -> POST /api/fb/analysis/pause -> stop polling
// 4. resumeJob() -> POST /api/fb/analysis/pause (action: resume) -> processBatch()
```

### Example 5: Keywords Storage in fb_settings

```typescript
// Key: 'fb_keywords' in fb_settings table
// Value: JSON array stored as value_plain
// Example: ["winda","awaria","przeciek","smrod","halasie","ochrona","monitoring","oplaty","czynsz"]

// Per-group keywords: 'fb_keywords:{groupId}' (optional override)
// Global keywords: 'fb_keywords'

// Loading keywords:
async function loadKeywords(
  adminClient: SupabaseClient,
  groupId: string
): Promise<string[]> {
  // Try per-group first
  const { data: perGroup } = await adminClient
    .from('fb_settings')
    .select('value_plain')
    .eq('key', `fb_keywords:${groupId}`)
    .single();

  if (perGroup?.value_plain) {
    return JSON.parse(perGroup.value_plain);
  }

  // Fall back to global
  const { data: global } = await adminClient
    .from('fb_settings')
    .select('value_plain')
    .eq('key', 'fb_keywords')
    .single();

  return global?.value_plain ? JSON.parse(global.value_plain) : [];
}
```

### Example 6: Adding FB Prompt to prompt_templates

```typescript
// Insert default FB analysis prompt into prompt_templates
// section_key: '_fb_post_analysis' (underscore prefix = system section, like _thread_summary)
// This allows admin to edit via existing /api/prompts API

export const FB_DEFAULT_PROMPT: DefaultPrompt = {
  section_key: '_fb_post_analysis',
  title: 'Analiza postu FB',
  section_order: 100, // After all email sections
  system_prompt: FB_POST_ANALYSIS_SYSTEM_PROMPT,
  user_prompt_template: FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE,
};

// Register in DEFAULT_PROMPTS array or load from code if not in DB
// The prompt editor page already handles merge of defaults + DB overrides
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `response_format: json_object` | `response_format: json_schema` with strict | GPT-4o (Aug 2024) | 100% schema adherence vs only valid JSON |
| `max_tokens` parameter | `max_completion_tokens` | GPT-5 family (2025) | Required for reasoning models, includes thinking tokens |
| 14 AI calls per thread (email) | 1 AI call per item (FB) | v1.0.5 (2026-02-17) | Already proven: 1 call per item is optimal |
| Manual JSON parse + retry | Structured output guaranteed | GPT-5 + json_schema | No retries needed, no validation logic |

**Deprecated/outdated:**
- `max_tokens`: GPT-5.x requires `max_completion_tokens` (already fixed in codebase since v1.0.6)
- `response_format: { type: "json_object" }`: Superseded by `json_schema` for guaranteed schema adherence
- Multiple AI calls per item: Proven less effective than single comprehensive call (v1.0.5 optimization)

## Open Questions

1. **Exact `additionalProperties` requirements for nested arrays in json_schema**
   - What we know: Top-level objects need `additionalProperties: false`. Array items with enum constraints should work.
   - What's unclear: Whether GPT-5.2 handles the `minimum`/`maximum` constraints on integers within strict mode, or if these are silently ignored.
   - Recommendation: Test with a simple API call during implementation. If int constraints are ignored, validate in code after parse.

2. **Prompt template separation for FB vs Email**
   - What we know: Both share `prompt_templates` table. Email uses section keys like `_thread_summary`, `metadata_analysis`, etc.
   - What's unclear: Whether the existing PromptsPage UI should show FB prompts alongside email prompts, or need a tab/filter.
   - Recommendation: Use `section_key` prefix convention: `_fb_*` for FB prompts. Filter in PromptsPage by tool context. Simplest: just add FB prompt to the list, admin sees both email and FB prompts in one editor.

3. **Re-analysis behavior (analyze already-analyzed posts)**
   - What we know: Default behavior should skip posts with `sentiment IS NOT NULL`.
   - What's unclear: UX for "re-analyze with updated prompt" -- checkbox? Separate button?
   - Recommendation: Add `forceReanalyze: boolean` parameter to the analysis API. Default: false (skip analyzed). UI: checkbox "Analizuj ponownie juz przetworzone posty".

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/ai/ai-provider.ts` -- existing callAI() implementation, 50s timeout, max_completion_tokens
- Codebase: `src/hooks/useAnalysisJob.ts` -- proven polling pattern with pause/resume
- Codebase: `src/app/api/analysis/process/route.ts` -- batch processing with Promise.allSettled
- Codebase: `src/types/fb.ts` -- FbPost, FbAnalysisJob types with all AI columns
- Codebase: `src/app/api/prompts/route.ts` -- prompt CRUD API
- Codebase: `supabase/migrations/20260212_07_01_fb_analyzer.sql` -- fb_posts, fb_analysis_jobs schema
- Codebase: `supabase/migrations/20260212_08_01_fb_groups_settings.sql` -- fb_settings, ai_instruction
- OpenAI Structured Outputs docs -- https://developers.openai.com/api/docs/guides/structured-outputs/
- OpenAI Cookbook -- https://developers.openai.com/cookbook/examples/structured_outputs_intro

### Secondary (MEDIUM confidence)
- OpenAI GPT-5 for developers -- confirmed GPT-5 supports structured outputs, streaming, custom tools
- OpenAI community forum -- GPT-5 JSON consistency tips, json_schema recommended over json_object
- AI/ML API docs -- GPT-5 supports response_format json_schema, max_completion_tokens, reasoning_effort

### Tertiary (LOW confidence)
- Polish NLP resources (awesome-nlp-polish GitHub) -- sarcasm detection patterns
- Social media sentiment analysis papers -- sarcasm reduces accuracy by ~50% without explicit handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 100% reuse of existing codebase libraries, zero new deps
- Architecture: HIGH -- direct adaptation of proven email-analyzer pattern
- Structured outputs: HIGH -- verified via OpenAI official docs + community confirmation for GPT-5.2
- Polish sentiment prompt: MEDIUM -- based on domain knowledge + general NLP research, needs real-world validation
- Pitfalls: HIGH -- most pitfalls are already-encountered issues (v1.0.6 token budget, v1.0.5 batching)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days -- stable domain, no fast-moving dependencies)
