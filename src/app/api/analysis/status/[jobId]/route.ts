import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/** GET /api/analysis/status/[jobId] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { jobId } = await params;

  const { data: job, error } = await getAdminClient()
    .from('analysis_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  const mailboxAllowed = await isMailboxInScope(getAdminClient(), job.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json({ error: 'Zadanie nie znalezione' }, { status: 404 });
  }

  return NextResponse.json({ job });
}
