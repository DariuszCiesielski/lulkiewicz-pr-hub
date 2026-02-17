import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * POST /api/analysis/pause — Pause or resume an analysis job.
 * Body: { jobId, action: 'pause' | 'resume' }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { jobId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { jobId, action } = body;
  if (!jobId || !action || !['pause', 'resume', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'jobId i action (pause/resume/cancel) są wymagane' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  const { data: job, error: jobError } = await adminClient
    .from('analysis_jobs')
    .select('id, status, processed_threads, total_threads')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  if (action === 'pause') {
    if (job.status !== 'processing' && job.status !== 'pending') {
      return NextResponse.json({ error: 'Można wstrzymać tylko aktywną analizę' }, { status: 400 });
    }

    await adminClient
      .from('analysis_jobs')
      .update({ status: 'paused' })
      .eq('id', jobId);

    return NextResponse.json({ status: 'paused', processedThreads: job.processed_threads, totalThreads: job.total_threads });
  }

  if (action === 'resume') {
    if (job.status !== 'paused') {
      return NextResponse.json({ error: 'Można wznowić tylko wstrzymaną analizę' }, { status: 400 });
    }

    await adminClient
      .from('analysis_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    return NextResponse.json({ status: 'processing', processedThreads: job.processed_threads, totalThreads: job.total_threads });
  }

  if (action === 'cancel') {
    if (!['processing', 'pending', 'paused'].includes(job.status)) {
      return NextResponse.json({ error: 'Można anulować tylko aktywną lub wstrzymaną analizę' }, { status: 400 });
    }

    await adminClient
      .from('analysis_jobs')
      .update({ status: 'failed', error_message: 'Anulowano przez użytkownika' })
      .eq('id', jobId);

    return NextResponse.json({ status: 'failed', processedThreads: job.processed_threads, totalThreads: job.total_threads });
  }

  return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
}
