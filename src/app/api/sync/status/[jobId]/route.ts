import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/**
 * GET /api/sync/status/[jobId] — Get sync job status.
 *
 * Returns: { id, status, job_type, emails_fetched, emails_total_estimate, error_message, started_at, completed_at }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { jobId } = await params;
  const adminClient = getAdminClient();

  const { data: job, error } = await adminClient
    .from('sync_jobs')
    .select('id, mailbox_id, status, job_type, emails_fetched, emails_total_estimate, error_message, started_at, completed_at, created_at')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: 'Zadanie synchronizacji nie zostało znalezione' },
      { status: 404 }
    );
  }

  const mailboxAllowed = await isMailboxInScope(adminClient, job.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json(
      { error: 'Zadanie synchronizacji nie zostało znalezione' },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
