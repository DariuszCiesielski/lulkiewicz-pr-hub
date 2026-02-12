import { NextRequest, NextResponse } from 'next/server';
import { loadAIConfig, callAI } from '@/lib/ai/ai-provider';
import { Anonymizer } from '@/lib/ai/anonymizer';
import { DEFAULT_PROMPTS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export const maxDuration = 60;

const BATCH_SIZE = 1; // one thread per request — sections processed in parallel

/**
 * POST /api/analysis/process — Process one batch of threads.
 * Body: { jobId }
 *
 * MAP phase: analyze each thread individually across all sections.
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

    // Get already processed thread IDs
    const { data: processedResults } = await adminClient
      .from('analysis_results')
      .select('thread_id')
      .eq('analysis_job_id', job.id);

    const processedThreadIds = new Set((processedResults || []).map((r) => r.thread_id));

    // Get next batch of unprocessed threads
    let threadQuery = adminClient
      .from('email_threads')
      .select('id, subject_normalized, mailbox_id')
      .eq('mailbox_id', job.mailbox_id);

    if (job.date_range_from) threadQuery = threadQuery.gte('first_message_at', job.date_range_from);
    if (job.date_range_to) threadQuery = threadQuery.lte('last_message_at', job.date_range_to);

    const { data: allThreads } = await threadQuery.order('last_message_at', { ascending: false });

    const unprocessedThreads = (allThreads || []).filter((t) => !processedThreadIds.has(t.id));
    const batch = unprocessedThreads.slice(0, BATCH_SIZE);

    if (batch.length === 0) {
      // All done — mark completed
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

    // Load prompts (merge defaults with DB overrides)
    const { data: dbPrompts } = await adminClient
      .from('prompt_templates')
      .select('*')
      .eq('tier', 'global')
      .eq('is_active', true);

    const globalOverrides = new Map(
      (dbPrompts || []).map((p) => [p.section_key, p])
    );

    // Process each thread in batch
    for (const thread of batch) {
      // Get emails for this thread
      const { data: emails } = await adminClient
        .from('emails')
        .select('id, from_address, from_name, to_addresses, subject, sent_at, received_at, body_text, is_incoming')
        .eq('thread_id', thread.id)
        .order('received_at', { ascending: true });

      if (!emails || emails.length === 0) continue;

      // Anonymize
      const anonymizer = new Anonymizer();
      const { anonymizedEmails, allMatches } = anonymizer.anonymizeThread(emails);

      // Save anonymization map
      if (allMatches.length > 0) {
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

      // Analyze all sections in parallel for faster processing
      await Promise.allSettled(
        DEFAULT_PROMPTS.map(async (defaultPrompt) => {
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
              thread_id: thread.id,
              section_key: defaultPrompt.section_key,
              result_data: {
                content: response.content,
                thread_subject: thread.subject_normalized,
              },
              tokens_used: response.tokensUsed,
              processing_time_ms: response.processingTimeMs,
            });
          } catch (aiError) {
            console.error(`AI error for thread ${thread.id}, section ${defaultPrompt.section_key}:`, aiError);
            await adminClient.from('analysis_results').insert({
              analysis_job_id: job.id,
              thread_id: thread.id,
              section_key: defaultPrompt.section_key,
              result_data: {
                error: aiError instanceof Error ? aiError.message : 'Błąd AI',
                thread_subject: thread.subject_normalized,
              },
            });
          }
        })
      );
    }

    // Update progress
    const newProcessed = processedThreadIds.size + batch.length;
    const progress = Math.round((newProcessed / job.total_threads) * 100);
    const hasMore = newProcessed < job.total_threads;

    await adminClient
      .from('analysis_jobs')
      .update({
        processed_threads: newProcessed,
        progress,
        status: hasMore ? 'processing' : 'completed',
        ...(hasMore ? {} : { completed_at: new Date().toISOString() }),
      })
      .eq('id', job.id);

    return NextResponse.json({
      status: hasMore ? 'processing' : 'completed',
      processedThreads: newProcessed,
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
