import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const { data } = await getAdminClient()
    .from('app_allowed_users')
    .select('role')
    .eq('email', user.email)
    .single();

  return data?.role === 'admin';
}

/**
 * GET /api/sync/status/[jobId] — Get sync job status.
 *
 * Returns: { id, status, job_type, emails_fetched, emails_total_estimate, error_message, started_at, completed_at }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!(await verifyAdmin())) {
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

  return NextResponse.json(job);
}
