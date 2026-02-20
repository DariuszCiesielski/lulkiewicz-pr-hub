import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import {
  applyMailboxDemoScope,
  getScopedMailboxIds,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/**
 * GET /api/dashboard — aggregated dashboard data.
 */
export async function GET() {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const scopedMailboxIds = await getScopedMailboxIds(adminClient, scope.isDemoUser);

  if (scopedMailboxIds.length === 0) {
    return NextResponse.json({
      kpi: {
        totalMailboxes: 0,
        totalEmails: 0,
        totalThreads: 0,
        pendingThreads: 0,
        avgResponseTimeMinutes: null,
      },
      mailboxes: [],
      recentReports: [],
      recentJobs: [],
    });
  }

  // Mailboxes with thread/email counts
  let mailboxesQuery = adminClient
    .from('mailboxes')
    .select('id, display_name, email_address, sync_status, last_sync_at, total_emails')
    .order('display_name', { ascending: true });
  mailboxesQuery = applyMailboxDemoScope(mailboxesQuery, scope.isDemoUser);
  const { data: mailboxes } = await mailboxesQuery;

  // Thread stats
  const { count: totalThreads } = await adminClient
    .from('email_threads')
    .select('*', { count: 'exact', head: true })
    .in('mailbox_id', scopedMailboxIds);

  const { count: pendingThreads } = await adminClient
    .from('email_threads')
    .select('*', { count: 'exact', head: true })
    .in('mailbox_id', scopedMailboxIds)
    .eq('status', 'pending');

  // Average response time across all threads
  const { data: avgData } = await adminClient
    .from('email_threads')
    .select('avg_response_time_minutes')
    .in('mailbox_id', scopedMailboxIds)
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
    .in('mailbox_id', scopedMailboxIds)
    .eq('is_deleted', false);

  // Recent reports
  const { data: recentReports } = await adminClient
    .from('reports')
    .select('id, title, template_type, status, created_at')
    .in('mailbox_id', scopedMailboxIds)
    .order('created_at', { ascending: false })
    .limit(5);

  // Recent analysis jobs
  const { data: recentJobs } = await adminClient
    .from('analysis_jobs')
    .select('id, mailbox_id, status, total_threads, processed_threads, created_at, completed_at')
    .in('mailbox_id', scopedMailboxIds)
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
