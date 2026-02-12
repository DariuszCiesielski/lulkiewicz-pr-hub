import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import type { SyncJobType } from '@/types/email';

// Vercel function timeout
export const maxDuration = 30;

/**
 * POST /api/sync — Start a new sync job for a mailbox.
 *
 * Body: { mailboxId: string, type?: 'full' | 'delta' }
 * Returns: { jobId: string, status: 'pending' }
 */
export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { mailboxId?: string; type?: SyncJobType };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Nieprawidłowy format danych' },
      { status: 400 }
    );
  }

  const { mailboxId, type = 'full' } = body;

  if (!mailboxId) {
    return NextResponse.json(
      { error: 'mailboxId jest wymagany' },
      { status: 400 }
    );
  }

  if (type !== 'full' && type !== 'delta') {
    return NextResponse.json(
      { error: 'Nieprawidłowy typ synchronizacji. Dozwolone: full, delta' },
      { status: 400 }
    );
  }

  // Check mailbox exists
  const { data: mailbox, error: mailboxError } = await adminClient
    .from('mailboxes')
    .select('id, sync_status, delta_link')
    .eq('id', mailboxId)
    .single();

  if (mailboxError || !mailbox) {
    return NextResponse.json(
      { error: 'Skrzynka nie została znaleziona' },
      { status: 404 }
    );
  }

  // Delta sync requires existing delta_link (at least one full sync completed)
  if (type === 'delta' && !mailbox.delta_link) {
    return NextResponse.json(
      { error: 'Delta sync wymaga wykonania pełnej synchronizacji najpierw' },
      { status: 400 }
    );
  }

  // Check no active sync job for this mailbox
  const { data: activeJobs } = await adminClient
    .from('sync_jobs')
    .select('id, status')
    .eq('mailbox_id', mailboxId)
    .in('status', ['pending', 'processing', 'has_more']);

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json(
      { error: 'Synchronizacja już trwa dla tej skrzynki' },
      { status: 409 }
    );
  }

  // Create sync job
  const { data: job, error: jobError } = await adminClient
    .from('sync_jobs')
    .insert({
      mailbox_id: mailboxId,
      status: 'pending',
      job_type: type,
      started_at: new Date().toISOString(),
      emails_fetched: 0,
    })
    .select('id, status')
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: `Błąd tworzenia zadania synchronizacji: ${jobError?.message}` },
      { status: 500 }
    );
  }

  // Update mailbox sync_status
  await adminClient
    .from('mailboxes')
    .update({ sync_status: 'syncing' })
    .eq('id', mailboxId);

  return NextResponse.json({
    jobId: job.id,
    status: 'pending',
  });
}
