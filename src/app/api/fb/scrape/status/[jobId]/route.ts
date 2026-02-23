import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

// Vercel function timeout
export const maxDuration = 10;

/**
 * GET /api/fb/scrape/status/[jobId] — Odczyt statusu zadania scrapowania.
 *
 * Uzywany do recovery/reconnect — jesli klient utraci polaczenie,
 * moze odczytac status i wznowic polling.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { jobId } = await params;
  const adminClient = getAdminClient();

  const { data: job, error } = await adminClient
    .from('fb_scrape_jobs')
    .select(
      'id, group_id, status, posts_found, posts_new, posts_updated, apify_run_id, error_message, started_at, completed_at, created_at'
    )
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: 'Zadanie scrapowania nie zostalo znalezione' },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
