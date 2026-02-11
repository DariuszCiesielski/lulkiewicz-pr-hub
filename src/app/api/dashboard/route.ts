import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
 * GET /api/dashboard — aggregated dashboard data.
 */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  // Mailboxes with thread/email counts
  const { data: mailboxes } = await adminClient
    .from('mailboxes')
    .select('id, display_name, email_address, sync_status, last_sync_at, total_emails')
    .order('display_name', { ascending: true });

  // Thread stats
  const { count: totalThreads } = await adminClient
    .from('email_threads')
    .select('*', { count: 'exact', head: true });

  const { count: pendingThreads } = await adminClient
    .from('email_threads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Average response time across all threads
  const { data: avgData } = await adminClient
    .from('email_threads')
    .select('avg_response_time_minutes')
    .not('avg_response_time_minutes', 'is', null);

  let avgResponseTime: number | null = null;
  if (avgData && avgData.length > 0) {
    const sum = avgData.reduce((a, b) => a + (b.avg_response_time_minutes || 0), 0);
    avgResponseTime = sum / avgData.length;
  }

  // Email count
  const { count: totalEmails } = await adminClient
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false);

  // Recent reports
  const { data: recentReports } = await adminClient
    .from('reports')
    .select('id, title, template_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // Recent analysis jobs
  const { data: recentJobs } = await adminClient
    .from('analysis_jobs')
    .select('id, mailbox_id, status, total_threads, processed_threads, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    kpi: {
      totalMailboxes: mailboxes?.length || 0,
      totalEmails: totalEmails || 0,
      totalThreads: totalThreads || 0,
      pendingThreads: pendingThreads || 0,
      avgResponseTimeMinutes: avgResponseTime,
    },
    mailboxes: mailboxes || [],
    recentReports: recentReports || [],
    recentJobs: recentJobs || [],
  });
}
