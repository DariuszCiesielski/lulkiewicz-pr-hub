import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import { calculateCostBlended } from '@/lib/ai/pricing';
import {
  getScopedMailboxIds,
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/**
 * GET /api/analysis — Lista zadań analizy.
 * Query: ?mailboxId=uuid (opcjonalnie)
 * Zwraca ostatnie 10 zadań, posortowane od najnowszych.
 */
export async function GET(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const mailboxId = request.nextUrl.searchParams.get('mailboxId');
  const adminClient = getAdminClient();
  const scopedMailboxIds = await getScopedMailboxIds(adminClient, scope.isDemoUser);

  if (mailboxId) {
    const mailboxAllowed = await isMailboxInScope(adminClient, mailboxId, scope.isDemoUser);
    if (!mailboxAllowed) {
      return NextResponse.json({ jobs: [] });
    }
  }

  let query = adminClient
    .from('analysis_jobs')
    .select('id, status, total_threads, processed_threads, date_range_from, date_range_to, created_at, started_at, completed_at, error_message')
    .order('created_at', { ascending: false })
    .limit(10);

  if (mailboxId) {
    query = query.eq('mailbox_id', mailboxId);
  } else if (scopedMailboxIds.length > 0) {
    query = query.in('mailbox_id', scopedMailboxIds);
  } else {
    return NextResponse.json({ jobs: [] });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with exact cost from stored data (or blended fallback for legacy rows)
  const jobs = data || [];
  const enrichedJobs = await Promise.all(
    jobs.map(async (job) => {
      if (job.status !== 'completed' && job.status !== 'processing' && job.status !== 'paused') {
        return { ...job, estimated_cost_usd: null, total_tokens: null, model_used: null };
      }

      // Get the model from the AI config used for this job
      const { data: jobDetail } = await adminClient
        .from('analysis_jobs')
        .select('ai_config_id')
        .eq('id', job.id)
        .single();

      let modelUsed: string | null = null;
      if (jobDetail?.ai_config_id) {
        const { data: aiConfig } = await adminClient
          .from('ai_config')
          .select('model')
          .eq('id', jobDetail.ai_config_id)
          .single();
        modelUsed = aiConfig?.model || null;
      }

      const { data: tokenData } = await adminClient
        .from('analysis_results')
        .select('tokens_used, prompt_tokens, completion_tokens, cost_usd')
        .eq('analysis_job_id', job.id);

      const results = tokenData || [];
      let totalCost = 0;
      let totalTokens = 0;

      for (const r of results) {
        if ((r.cost_usd || 0) > 0) {
          // Exact cost from new data
          totalCost += r.cost_usd;
          totalTokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
        } else if ((r.tokens_used || 0) > 0) {
          // Legacy fallback: blended rate
          totalTokens += r.tokens_used;
          totalCost += calculateCostBlended(modelUsed || 'gpt-5.2', r.tokens_used);
        }
      }

      const estimatedCost = totalTokens > 0 ? +totalCost.toFixed(4) : null;

      return { ...job, estimated_cost_usd: estimatedCost, total_tokens: totalTokens, model_used: modelUsed };
    })
  );

  return NextResponse.json({ jobs: enrichedJobs });
}

/**
 * POST /api/analysis — Start a new analysis job.
 * Body: { mailboxId, dateRangeFrom?, dateRangeTo? }
 */
export async function POST(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { mailboxId?: string; dateRangeFrom?: string; dateRangeTo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  if (!body.mailboxId) {
    return NextResponse.json({ error: 'mailboxId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const mailboxAllowed = await isMailboxInScope(adminClient, body.mailboxId, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json(
      { error: 'Skrzynka nie została znaleziona' },
      { status: 404 }
    );
  }

  // Check AI config exists
  const { data: aiConfig } = await adminClient
    .from('ai_config')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!aiConfig) {
    return NextResponse.json(
      { error: 'Brak konfiguracji AI. Ustaw klucz API w Ustawieniach AI.' },
      { status: 400 }
    );
  }

  // Count threads for this mailbox
  let threadQuery = adminClient
    .from('email_threads')
    .select('id', { count: 'exact' })
    .eq('mailbox_id', body.mailboxId);

  if (body.dateRangeFrom) {
    threadQuery = threadQuery.gte('first_message_at', body.dateRangeFrom);
  }
  if (body.dateRangeTo) {
    threadQuery = threadQuery.lte('last_message_at', body.dateRangeTo);
  }

  const { count: totalThreads } = await threadQuery;

  if (!totalThreads || totalThreads === 0) {
    return NextResponse.json(
      { error: 'Brak wątków do analizy. Najpierw zbuduj wątki.' },
      { status: 400 }
    );
  }

  // Check no active analysis
  const { data: activeJobs } = await adminClient
    .from('analysis_jobs')
    .select('id')
    .eq('mailbox_id', body.mailboxId)
    .in('status', ['pending', 'processing']);

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json(
      { error: 'Analiza już trwa dla tej skrzynki' },
      { status: 409 }
    );
  }

  // Create job
  const { data: job, error: jobError } = await adminClient
    .from('analysis_jobs')
    .insert({
      mailbox_id: body.mailboxId,
      status: 'pending',
      total_threads: totalThreads,
      processed_threads: 0,
      date_range_from: body.dateRangeFrom || null,
      date_range_to: body.dateRangeTo || null,
      ai_config_id: aiConfig.id,
      started_at: new Date().toISOString(),
    })
    .select('id, status, total_threads')
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: `Błąd tworzenia zadania: ${jobError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    status: 'pending',
    totalThreads: job.total_threads,
  });
}
