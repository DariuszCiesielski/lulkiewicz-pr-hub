import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * POST /api/fb/analysis/pause — Pause, resume lub cancel joba analizy AI.
 * Body: { jobId, action: 'pause' | 'resume' | 'cancel' }
 *
 * Pause: running/pending -> paused
 * Resume: paused -> running
 * Cancel: running/pending/paused -> failed (z error_message)
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  let body: { jobId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  const { jobId, action } = body;
  if (!jobId || !action || !['pause', 'resume', 'cancel'].includes(action)) {
    return NextResponse.json(
      { error: 'jobId i action (pause/resume/cancel) sa wymagane' },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  const { data: job, error: jobError } = await adminClient
    .from('fb_analysis_jobs')
    .select('id, group_id, status, analyzed_posts, total_posts')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  if (action === 'pause') {
    if (job.status !== 'running' && job.status !== 'pending') {
      return NextResponse.json(
        { error: 'Mozna wstrzymac tylko aktywna analize' },
        { status: 400 }
      );
    }

    await adminClient
      .from('fb_analysis_jobs')
      .update({ status: 'paused' })
      .eq('id', jobId);

    return NextResponse.json({
      status: 'paused',
      analyzedPosts: job.analyzed_posts,
      totalPosts: job.total_posts,
    });
  }

  if (action === 'resume') {
    if (job.status !== 'paused') {
      return NextResponse.json(
        { error: 'Mozna wznowic tylko wstrzymana analize' },
        { status: 400 }
      );
    }

    await adminClient
      .from('fb_analysis_jobs')
      .update({ status: 'running' })
      .eq('id', jobId);

    return NextResponse.json({
      status: 'running',
      analyzedPosts: job.analyzed_posts,
      totalPosts: job.total_posts,
    });
  }

  if (action === 'cancel') {
    if (!['running', 'pending', 'paused'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Mozna anulowac tylko aktywna lub wstrzymana analize' },
        { status: 400 }
      );
    }

    await adminClient
      .from('fb_analysis_jobs')
      .update({ status: 'failed', error_message: 'Anulowano przez uzytkownika' })
      .eq('id', jobId);

    return NextResponse.json({
      status: 'failed',
      analyzedPosts: job.analyzed_posts,
      totalPosts: job.total_posts,
    });
  }

  return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
}
