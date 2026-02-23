import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { loadAIConfig, callAI } from '@/lib/ai/ai-provider';
import {
  FB_POST_ANALYSIS_SECTION_KEY,
  FB_POST_ANALYSIS_SYSTEM_PROMPT,
  FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE,
  FB_POST_ANALYSIS_SCHEMA,
  buildFbUserPrompt,
} from '@/lib/fb/fb-analysis-prompt';
import { loadKeywords, matchKeywords } from '@/lib/fb/fb-keywords';
import type { FbPostAnalysisResult } from '@/types/fb';

export const maxDuration = 60;

/** Max posts to process per HTTP request — 5 concurrent AI calls fit under 60s. */
const POSTS_PER_REQUEST = 5;

/** Posts shorter than this are marked irrelevant without AI call. */
const MIN_CONTENT_LENGTH = 20;

/**
 * POST /api/fb/analysis/process — Przetwarza batch postow FB z AI.
 * Body: { jobId }
 *
 * Kazdy request przetwarza do POSTS_PER_REQUEST postow rownolegle.
 * Polling loop w frontendzie wywoluje ten endpoint wielokrotnie az do ukonczenia.
 *
 * forceReanalyze jest odczytywany z job.metadata (persisted w DB, NIE z request body).
 * Pattern identyczny jak sync_jobs.metadata w email-analyzer.
 *
 * Returns: { status, analyzedPosts, totalPosts, hasMore }
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  if (!body.jobId) {
    return NextResponse.json({ error: 'jobId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Load job (WAZNE: SELECT musi zawierac metadata)
  const { data: job, error: jobError } = await adminClient
    .from('fb_analysis_jobs')
    .select('id, group_id, status, total_posts, analyzed_posts, progress, metadata')
    .eq('id', body.jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  // Terminal states — return current status
  if (job.status === 'completed' || job.status === 'failed') {
    return NextResponse.json({
      status: job.status,
      analyzedPosts: job.analyzed_posts,
      totalPosts: job.total_posts,
    });
  }

  // Paused — return without processing
  if (job.status === 'paused') {
    return NextResponse.json({
      status: 'paused',
      analyzedPosts: job.analyzed_posts,
      totalPosts: job.total_posts,
      hasMore: false,
    });
  }

  // Transition pending -> running
  if (job.status === 'pending') {
    await adminClient
      .from('fb_analysis_jobs')
      .update({ status: 'running' })
      .eq('id', job.id);
  }

  // Read forceReanalyze from job.metadata (persisted in DB)
  const forceReanalyze = (job.metadata as Record<string, unknown>)?.forceReanalyze === true;

  try {
    // Load AI config
    const aiConfig = await loadAIConfig(adminClient);

    // Load group
    const { data: group, error: groupError } = await adminClient
      .from('fb_groups')
      .select('id, name, developer, ai_instruction')
      .eq('id', job.group_id)
      .single();

    if (groupError || !group) {
      throw new Error(`Grupa ${job.group_id} nie znaleziona`);
    }

    // Resolve prompt — check for override in prompt_templates
    let systemPrompt = FB_POST_ANALYSIS_SYSTEM_PROMPT;
    let _userPromptTemplate = FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE;

    const { data: promptOverride } = await adminClient
      .from('prompt_templates')
      .select('system_prompt, user_prompt_template')
      .eq('section_key', FB_POST_ANALYSIS_SECTION_KEY)
      .eq('is_active', true)
      .eq('tier', 'global')
      .single();

    if (promptOverride) {
      if (promptOverride.system_prompt) {
        systemPrompt = promptOverride.system_prompt;
      }
      if (promptOverride.user_prompt_template) {
        _userPromptTemplate = promptOverride.user_prompt_template;
      }
    }

    // Collect extra instructions (developer + group level)
    const extraParts: string[] = [];

    if (group.developer) {
      const { data: devInstruction } = await adminClient
        .from('fb_settings')
        .select('value_plain')
        .eq('key', `developer_instruction:${group.developer}`)
        .single();

      if (devInstruction?.value_plain) {
        extraParts.push(`Instrukcja dewelopera (${group.developer}): ${devInstruction.value_plain}`);
      }
    }

    if (group.ai_instruction) {
      extraParts.push(`Instrukcja grupy: ${group.ai_instruction}`);
    }

    const extraInstructions = extraParts.join('\n');

    // Load keywords
    const keywords = await loadKeywords(adminClient, job.group_id);

    // Get next batch of unanalyzed posts
    let postsQuery = adminClient
      .from('fb_posts')
      .select('id, content, author_name, posted_at, likes_count, comments_count')
      .eq('group_id', job.group_id)
      .not('content', 'is', null)
      .order('posted_at', { ascending: false });

    if (forceReanalyze) {
      // With forceReanalyze: use offset-based pagination (skip already processed in this job)
      postsQuery = postsQuery
        .range(job.analyzed_posts, job.analyzed_posts + POSTS_PER_REQUEST - 1);
    } else {
      // Default: only posts without sentiment
      postsQuery = postsQuery
        .is('sentiment', null)
        .limit(POSTS_PER_REQUEST);
    }

    const { data: posts, error: postsError } = await postsQuery;

    if (postsError) {
      throw new Error(`Blad pobierania postow: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      // No more posts — job completed
      await adminClient
        .from('fb_analysis_jobs')
        .update({
          status: 'completed',
          analyzed_posts: job.total_posts,
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json({
        status: 'completed',
        analyzedPosts: job.total_posts,
        totalPosts: job.total_posts,
        hasMore: false,
      });
    }

    // Pre-filter: short posts marked as irrelevant without AI call
    const shortPosts = posts.filter((p) => (p.content?.length || 0) < MIN_CONTENT_LENGTH);
    const toAnalyze = posts.filter((p) => (p.content?.length || 0) >= MIN_CONTENT_LENGTH);

    // Mark short posts as irrelevant
    if (shortPosts.length > 0) {
      const shortPostIds = shortPosts.map((p) => p.id);
      await adminClient
        .from('fb_posts')
        .update({
          sentiment: 'neutral',
          relevance_score: 0,
          ai_snippet: '(Post zbyt krotki do analizy)',
          ai_categories: ['inne'],
        })
        .in('id', shortPostIds);
    }

    // Process remaining posts in parallel via Promise.allSettled
    const results = await Promise.allSettled(
      toAnalyze.map(async (post) => {
        const keywordMatches = matchKeywords(post.content || '', keywords);
        const userPrompt = buildFbUserPrompt(post, group.name, keywordMatches, extraInstructions);

        try {
          const response = await callAI(aiConfig, systemPrompt, userPrompt, FB_POST_ANALYSIS_SCHEMA);
          const result: FbPostAnalysisResult = JSON.parse(response.content);

          // Keyword boost: +1-2 points for keyword matches
          let adjustedScore = result.relevance_score;
          if (keywordMatches.length > 0 && adjustedScore < 10) {
            adjustedScore = Math.min(10, adjustedScore + Math.min(keywordMatches.length, 2));
          }

          // Clamp relevance_score 0-10 (safety — strict mode may not enforce min/max)
          adjustedScore = Math.max(0, Math.min(10, adjustedScore));

          await adminClient
            .from('fb_posts')
            .update({
              sentiment: result.sentiment,
              relevance_score: adjustedScore,
              ai_snippet: result.ai_snippet,
              ai_categories: result.categories,
            })
            .eq('id', post.id);
        } catch (aiError) {
          // Log error per post but do NOT fail the entire job
          console.error(
            `[fb-analysis] AI error for post ${post.id}:`,
            aiError instanceof Error ? aiError.message : aiError
          );

          // Mark post with neutral/0 so it doesn't block next batch
          await adminClient
            .from('fb_posts')
            .update({
              sentiment: 'neutral',
              relevance_score: 0,
              ai_snippet: `(Blad analizy AI: ${aiError instanceof Error ? aiError.message : 'Nieznany blad'})`,
              ai_categories: ['inne'],
            })
            .eq('id', post.id);
        }
      })
    );

    // Count processed (all posts in batch — both pre-filtered and AI-analyzed)
    const batchSize = posts.length;
    const newAnalyzedPosts = job.analyzed_posts + batchSize;
    const progress = Math.round((newAnalyzedPosts / job.total_posts) * 100);
    const hasMore = newAnalyzedPosts < job.total_posts;

    // Log any rejected promises
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) {
      console.error(`[fb-analysis] ${rejected.length}/${toAnalyze.length} posts failed in batch`);
    }

    await adminClient
      .from('fb_analysis_jobs')
      .update({
        analyzed_posts: newAnalyzedPosts,
        progress: Math.min(progress, 100),
        status: hasMore ? 'running' : 'completed',
        ...(hasMore ? {} : { completed_at: new Date().toISOString() }),
      })
      .eq('id', job.id);

    return NextResponse.json({
      status: hasMore ? 'running' : 'completed',
      analyzedPosts: newAnalyzedPosts,
      totalPosts: job.total_posts,
      hasMore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany blad';
    console.error(`[fb-analysis] Job ${job.id} failed:`, message);

    await adminClient
      .from('fb_analysis_jobs')
      .update({ status: 'failed', error_message: message })
      .eq('id', job.id);

    return NextResponse.json({
      status: 'failed',
      error: message,
      analyzedPosts: job.analyzed_posts,
      totalPosts: job.total_posts,
    });
  }
}
