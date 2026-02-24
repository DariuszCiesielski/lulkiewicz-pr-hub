import { NextRequest, NextResponse } from 'next/server';
import { loadAIConfig, callAI } from '@/lib/ai/ai-provider';
import { calculateCost } from '@/lib/ai/pricing';
import { Anonymizer } from '@/lib/ai/anonymizer';
import { loadProfile } from '@/lib/ai/profile-loader';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

export const maxDuration = 60;

/** Max threads to process per HTTP request — 2 concurrent AI calls fit under 60s. */
const THREADS_PER_REQUEST = 2;

/** Max retry attempts per thread before treating as permanent failure. */
const MAX_RETRIES = 3;

/**
 * POST /api/analysis/process — Process a batch of thread summaries.
 * Body: { jobId }
 *
 * Each request processes up to THREADS_PER_REQUEST threads (1 AI call each).
 * The polling loop in the frontend keeps calling until all threads are done.
 *
 * Returns: { status, processedThreads, totalThreads, hasMore }
 */
export async function POST(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
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

  const mailboxAllowed = await isMailboxInScope(adminClient, job.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  // Load mailbox cc_filter_mode
  const { data: mailboxData } = await adminClient
    .from('mailboxes')
    .select('cc_filter_mode')
    .eq('id', job.mailbox_id)
    .single();

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

    // Load analysis profile from DB (UUID preferred, slug fallback)
    const profileRef = job.analysis_profile_id || job.analysis_profile || 'communication_audit';
    const profile = await loadProfile(adminClient, profileRef);
    if (!profile) {
      throw new Error(`Profil analizy nie znaleziony: ${profileRef}`);
    }
    const threadSectionKey = profile.threadSectionKey;

    // Get ALL existing results for this job (only thread summary entries for this profile)
    const { data: existingResults } = await adminClient
      .from('analysis_results')
      .select('id, thread_id, section_key, result_data')
      .eq('analysis_job_id', job.id)
      .eq('section_key', threadSectionKey)
      .limit(10000);

    // Build sets: completed threads and retryable errors
    const completedThreads = new Set<string>();
    const errorEntries = new Map<string, { id: string; retryCount: number }>();

    for (const r of existingResults || []) {
      if (r.result_data?.content) {
        completedThreads.add(r.thread_id);
      } else if (r.result_data?.error) {
        const retryCount: number = r.result_data.retry_count || 1;
        if (retryCount >= MAX_RETRIES) {
          completedThreads.add(r.thread_id); // permanent failure
        } else {
          errorEntries.set(r.thread_id, { id: r.id, retryCount });
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

    // Apply CC filter
    if (mailboxData?.cc_filter_mode === 'never_in_to') {
      threadQuery = threadQuery.neq('cc_filter_status', 'cc_always');
    } else if (mailboxData?.cc_filter_mode === 'first_email_cc') {
      threadQuery = threadQuery.eq('cc_filter_status', 'direct');
    }

    const { data: allThreads } = await threadQuery.order('last_message_at', { ascending: false });
    const threads = allThreads || [];

    // Find threads still needing processing
    const pendingThreads = threads.filter((t) => !completedThreads.has(t.id));
    const fullyCompleted = threads.length - pendingThreads.length;

    if (pendingThreads.length === 0) {
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

    // Take next batch of threads
    const threadBatch = pendingThreads.slice(0, THREADS_PER_REQUEST);

    // Process threads in parallel
    await Promise.allSettled(
      threadBatch.map(async (thread) => {
        const existingError = errorEntries.get(thread.id);

        // Delete existing error entry before retry
        if (existingError) {
          console.log(`Retrying thread ${thread.id} (attempt ${existingError.retryCount + 1}/${MAX_RETRIES})`);
          await adminClient.from('analysis_results').delete().eq('id', existingError.id);
        }

        // Get emails for this thread
        const { data: emails } = await adminClient
          .from('emails')
          .select('id, from_address, from_name, to_addresses, subject, sent_at, received_at, body_text, is_incoming')
          .eq('thread_id', thread.id)
          .order('received_at', { ascending: true });

        if (!emails || emails.length === 0) {
          await adminClient.from('analysis_results').insert({
            analysis_job_id: job.id,
            thread_id: thread.id,
            section_key: threadSectionKey,
            result_data: {
              content: '(brak wiadomości w wątku)',
              thread_subject: thread.subject_normalized,
            },
          });
          return;
        }

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

        // Build thread text
        const threadText = emails
          .map((e, i) => {
            const direction = e.is_incoming ? '[PRZYCHODZĄCY]' : '[WYCHODZĄCY]';
            const date = new Date(e.sent_at || e.received_at).toLocaleString('pl-PL');
            const body = anonymizedEmails.get(e.id) || '';
            return `--- Email ${i + 1} ${direction} ---\nOd: ${e.from_name || e.from_address}\nData: ${date}\nTemat: ${e.subject || '(brak)'}\n\n${body}`;
          })
          .join('\n\n');

        const userPrompt = profile.threadUserPromptTemplate.replace('{{threads}}', threadText);

        try {
          const response = await callAI(aiConfig, profile.threadSystemPrompt, userPrompt);

          await adminClient.from('analysis_results').insert({
            analysis_job_id: job.id,
            thread_id: thread.id,
            section_key: threadSectionKey,
            result_data: {
              content: response.content,
              thread_subject: thread.subject_normalized,
            },
            tokens_used: response.tokensUsed,
            prompt_tokens: response.promptTokens,
            completion_tokens: response.completionTokens,
            cost_usd: calculateCost(aiConfig.model, response.promptTokens, response.completionTokens),
            processing_time_ms: response.processingTimeMs,
          });
        } catch (aiError) {
          const newRetryCount = (existingError?.retryCount || 0) + 1;
          console.error(`AI error for thread ${thread.id} (attempt ${newRetryCount}/${MAX_RETRIES}):`, aiError);
          await adminClient.from('analysis_results').insert({
            analysis_job_id: job.id,
            thread_id: thread.id,
            section_key: threadSectionKey,
            result_data: {
              error: aiError instanceof Error ? aiError.message : 'Błąd AI',
              thread_subject: thread.subject_normalized,
              retry_count: newRetryCount,
            },
          });
        }
      })
    );

    // Recalculate completed threads
    const newCompleted = fullyCompleted + threadBatch.length;
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
