import { NextRequest, NextResponse } from 'next/server';
import { loadAIConfig, callAI } from '@/lib/ai/ai-provider';
import { calculateCost } from '@/lib/ai/pricing';
import { Anonymizer } from '@/lib/ai/anonymizer';
import { DEFAULT_PROMPTS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export const maxDuration = 60;

/** Max sections to process per request — keeps each request well under 60s. */
const SECTIONS_PER_REQUEST = 3;

/** All section keys that need to be analyzed per thread. */
const ALL_SECTION_KEYS = DEFAULT_PROMPTS.map((p) => p.section_key);

/** Max retry attempts per section before treating as permanent failure. */
const MAX_RETRIES = 3;

/**
 * POST /api/analysis/process — Process a small batch of sections.
 * Body: { jobId }
 *
 * Each request processes up to SECTIONS_PER_REQUEST sections for ONE thread.
 * The polling loop in the frontend keeps calling until all threads × sections are done.
 *
 * Returns: { status, processedThreads, totalThreads, hasMore }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  if (!body.jobId) {
    return NextResponse.json({ error: 'jobId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Load job
  const { data: job, error: jobError } = await adminClient
    .from('analysis_jobs')
    .select('*')
    .eq('id', body.jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  if (job.status === 'completed' || job.status === 'failed') {
    return NextResponse.json({ status: job.status, processedThreads: job.processed_threads, totalThreads: job.total_threads });
  }

  if (job.status === 'paused') {
    return NextResponse.json({ status: 'paused', processedThreads: job.processed_threads, totalThreads: job.total_threads, hasMore: false });
  }

  // Update status to processing
  if (job.status === 'pending') {
    await adminClient
      .from('analysis_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);
  }

  try {
    // Load AI config
    const aiConfig = await loadAIConfig(adminClient);

    // Get ALL existing results for this job — include result_data to distinguish success vs error
    const { data: existingResults } = await adminClient
      .from('analysis_results')
      .select('id, thread_id, section_key, result_data')
      .eq('analysis_job_id', job.id)
      .limit(10000);

    // Build set of "thread_id::section_key" for fast lookup
    // Only count entries WITH content as completed (errors can be retried)
    // Permanently failed entries (retry_count >= MAX_RETRIES) also count as completed
    const completedPairs = new Set<string>();
    const errorEntries = new Map<string, { id: string; retryCount: number }>();

    for (const r of (existingResults || [])) {
      const key = `${r.thread_id}::${r.section_key}`;
      if (r.result_data?.content) {
        completedPairs.add(key);
      } else if (r.result_data?.error) {
        const retryCount: number = r.result_data.retry_count || 1;
        if (retryCount >= MAX_RETRIES) {
          completedPairs.add(key); // permanent failure — stop retrying
        } else {
          errorEntries.set(key, { id: r.id, retryCount });
        }
      }
    }

    // Get all threads in scope
    let threadQuery = adminClient
      .from('email_threads')
      .select('id, subject_normalized, mailbox_id')
      .eq('mailbox_id', job.mailbox_id);

    if (job.date_range_from) threadQuery = threadQuery.gte('first_message_at', job.date_range_from);
    if (job.date_range_to) threadQuery = threadQuery.lte('last_message_at', job.date_range_to);

    const { data: allThreads } = await threadQuery.order('last_message_at', { ascending: false });
    const threads = allThreads || [];

    // Find first thread with missing sections
    let targetThread: typeof threads[0] | null = null;
    let missingSections: typeof DEFAULT_PROMPTS = [];

    for (const thread of threads) {
      const missing = DEFAULT_PROMPTS.filter(
        (p) => !completedPairs.has(`${thread.id}::${p.section_key}`)
      );
      if (missing.length > 0) {
        targetThread = thread;
        missingSections = missing;
        break;
      }
    }

    // Count fully completed threads (all section_keys present — success or permanent failure)
    const fullyCompletedThreads = threads.filter((thread) =>
      ALL_SECTION_KEYS.every((sk) => completedPairs.has(`${thread.id}::${sk}`))
    ).length;

    if (!targetThread || missingSections.length === 0) {
      // All done
      await adminClient
        .from('analysis_jobs')
        .update({
          status: 'completed',
          processed_threads: job.total_threads,
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json({
        status: 'completed',
        processedThreads: job.total_threads,
        totalThreads: job.total_threads,
        hasMore: false,
      });
    }

    // Take up to SECTIONS_PER_REQUEST sections for this thread
    const sectionBatch = missingSections.slice(0, SECTIONS_PER_REQUEST);

    // Load prompts (merge defaults with DB overrides)
    const { data: dbPrompts } = await adminClient
      .from('prompt_templates')
      .select('*')
      .eq('tier', 'global')
      .eq('is_active', true);

    const globalOverrides = new Map(
      (dbPrompts || []).map((p) => [p.section_key, p])
    );

    // Get emails for this thread
    const { data: emails } = await adminClient
      .from('emails')
      .select('id, from_address, from_name, to_addresses, subject, sent_at, received_at, body_text, is_incoming')
      .eq('thread_id', targetThread.id)
      .order('received_at', { ascending: true });

    if (emails && emails.length > 0) {
      // Anonymize
      const anonymizer = new Anonymizer();
      const { anonymizedEmails, allMatches } = anonymizer.anonymizeThread(emails);

      // Save anonymization map (only on first batch for this thread)
      const isFirstBatchForThread = missingSections.length === DEFAULT_PROMPTS.length;
      if (isFirstBatchForThread && allMatches.length > 0) {
        await adminClient.from('anonymization_map').insert(
          allMatches.map((m) => ({
            analysis_job_id: job.id,
            original_value: m.original,
            anonymized_value: m.anonymized,
            pii_type: m.type,
            context: m.context,
          }))
        );
      }

      // Build thread text for prompts
      const threadText = emails
        .map((e, i) => {
          const direction = e.is_incoming ? '[PRZYCHODZĄCY]' : '[WYCHODZĄCY]';
          const date = new Date(e.sent_at || e.received_at).toLocaleString('pl-PL');
          const body = anonymizedEmails.get(e.id) || '';
          return `--- Email ${i + 1} ${direction} ---\nOd: ${e.from_name || e.from_address}\nData: ${date}\nTemat: ${e.subject || '(brak)'}\n\n${body}`;
        })
        .join('\n\n');

      // Process section batch in parallel (with retry support for previously failed sections)
      await Promise.allSettled(
        sectionBatch.map(async (defaultPrompt) => {
          const pairKey = `${targetThread!.id}::${defaultPrompt.section_key}`;
          const existingError = errorEntries.get(pairKey);

          // Delete existing error entry before retry
          if (existingError) {
            console.log(`Retrying section ${defaultPrompt.section_key} for thread ${targetThread!.id} (attempt ${existingError.retryCount + 1}/${MAX_RETRIES})`);
            await adminClient.from('analysis_results').delete().eq('id', existingError.id);
          }

          const prompt = globalOverrides.get(defaultPrompt.section_key) || defaultPrompt;
          const userPrompt = (prompt.user_prompt_template || defaultPrompt.user_prompt_template)
            .replace('{{threads}}', threadText);

          try {
            const response = await callAI(
              aiConfig,
              prompt.system_prompt || defaultPrompt.system_prompt,
              userPrompt
            );

            await adminClient.from('analysis_results').insert({
              analysis_job_id: job.id,
              thread_id: targetThread!.id,
              section_key: defaultPrompt.section_key,
              result_data: {
                content: response.content,
                thread_subject: targetThread!.subject_normalized,
              },
              tokens_used: response.tokensUsed,
              prompt_tokens: response.promptTokens,
              completion_tokens: response.completionTokens,
              cost_usd: calculateCost(aiConfig.model, response.promptTokens, response.completionTokens),
              processing_time_ms: response.processingTimeMs,
            });
          } catch (aiError) {
            const newRetryCount = (existingError?.retryCount || 0) + 1;
            console.error(`AI error for thread ${targetThread!.id}, section ${defaultPrompt.section_key} (attempt ${newRetryCount}/${MAX_RETRIES}):`, aiError);
            await adminClient.from('analysis_results').insert({
              analysis_job_id: job.id,
              thread_id: targetThread!.id,
              section_key: defaultPrompt.section_key,
              result_data: {
                error: aiError instanceof Error ? aiError.message : 'Błąd AI',
                thread_subject: targetThread!.subject_normalized,
                retry_count: newRetryCount,
              },
            });
          }
        })
      );
    }

    // Recalculate completed threads after this batch
    // If this thread just finished all sections, increment count
    const remainingAfter = missingSections.length - sectionBatch.length;
    const newCompleted = remainingAfter === 0 ? fullyCompletedThreads + 1 : fullyCompletedThreads;
    const progress = Math.round((newCompleted / job.total_threads) * 100);
    const hasMore = newCompleted < job.total_threads;

    await adminClient
      .from('analysis_jobs')
      .update({
        processed_threads: newCompleted,
        progress,
        status: hasMore ? 'processing' : 'completed',
        ...(hasMore ? {} : { completed_at: new Date().toISOString() }),
      })
      .eq('id', job.id);

    return NextResponse.json({
      status: hasMore ? 'processing' : 'completed',
      processedThreads: newCompleted,
      totalThreads: job.total_threads,
      hasMore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';

    await adminClient
      .from('analysis_jobs')
      .update({ status: 'failed', error_message: message })
      .eq('id', job.id);

    return NextResponse.json({
      status: 'failed',
      error: message,
      processedThreads: job.processed_threads,
      totalThreads: job.total_threads,
    });
  }
}
