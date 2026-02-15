import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/analysis — Lista zadań analizy.
 * Query: ?mailboxId=uuid (opcjonalnie)
 * Zwraca ostatnie 10 zadań, posortowane od najnowszych.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const mailboxId = request.nextUrl.searchParams.get('mailboxId');
  const adminClient = getAdminClient();

  let query = adminClient
    .from('analysis_jobs')
    .select('id, status, total_threads, processed_threads, date_range_from, date_range_to, created_at, completed_at, error_message')
    .order('created_at', { ascending: false })
    .limit(10);

  if (mailboxId) {
    query = query.eq('mailbox_id', mailboxId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data || [] });
}

/**
 * POST /api/analysis — Start a new analysis job.
 * Body: { mailboxId, dateRangeFrom?, dateRangeTo? }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
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
