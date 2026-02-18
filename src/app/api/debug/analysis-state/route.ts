import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/debug/analysis-state?mailboxId=X
 *
 * Diagnostic endpoint — shows the state of analysis jobs and their results.
 * Helps debug empty report issues.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get('mailboxId');

  const adminClient = getAdminClient();

  // 1. Get all analysis jobs (latest first)
  let jobQuery = adminClient
    .from('analysis_jobs')
    .select('id, mailbox_id, status, total_threads, processed_threads, progress, created_at, completed_at, error_message, date_range_from, date_range_to')
    .order('created_at', { ascending: false })
    .limit(5);

  if (mailboxId) jobQuery = jobQuery.eq('mailbox_id', mailboxId);

  const { data: jobs, error: jobsError } = await jobQuery;

  if (jobsError) {
    return NextResponse.json({ error: `Jobs query error: ${jobsError.message}` }, { status: 500 });
  }

  // 2. For each job, count results and show section_key breakdown
  const jobDetails = [];

  for (const job of jobs || []) {
    // Count total results
    const { count: totalResults } = await adminClient
      .from('analysis_results')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_job_id', job.id);

    // Get section_key breakdown
    const { data: results } = await adminClient
      .from('analysis_results')
      .select('section_key, result_data, thread_id')
      .eq('analysis_job_id', job.id)
      .limit(500);

    const sectionBreakdown: Record<string, { total: number; withContent: number; withError: number; sampleContent: string | null }> = {};

    for (const r of results || []) {
      const key = r.section_key;
      if (!sectionBreakdown[key]) {
        sectionBreakdown[key] = { total: 0, withContent: 0, withError: 0, sampleContent: null };
      }
      sectionBreakdown[key].total++;

      const content = r.result_data?.content;
      if (content && typeof content === 'string' && content.length > 0) {
        sectionBreakdown[key].withContent++;
        // Save first sample (truncated)
        if (!sectionBreakdown[key].sampleContent) {
          sectionBreakdown[key].sampleContent = content.slice(0, 200) + (content.length > 200 ? '...' : '');
        }
      } else if (r.result_data?.error) {
        sectionBreakdown[key].withError++;
      }
    }

    // 3. Get latest report for this job
    const { data: reports } = await adminClient
      .from('reports')
      .select('id, status, title, created_at, analysis_job_id')
      .eq('analysis_job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(3);

    // 4. For latest report, check report_sections
    let reportSections: { section_key: string; title: string; contentLength: number; contentPreview: string }[] = [];

    if (reports && reports.length > 0) {
      const { data: sections } = await adminClient
        .from('report_sections')
        .select('section_key, title, content_markdown')
        .eq('report_id', reports[0].id);

      reportSections = (sections || []).map((s) => ({
        section_key: s.section_key,
        title: s.title,
        contentLength: s.content_markdown?.length || 0,
        contentPreview: s.content_markdown
          ? s.content_markdown.slice(0, 150) + (s.content_markdown.length > 150 ? '...' : '')
          : '(null)',
      }));
    }

    jobDetails.push({
      job: {
        id: job.id,
        status: job.status,
        totalThreads: job.total_threads,
        processedThreads: job.processed_threads,
        progress: job.progress,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
        dateRange: job.date_range_from ? `${job.date_range_from} — ${job.date_range_to}` : null,
      },
      totalResultRows: totalResults,
      sectionBreakdown,
      reports: (reports || []).map((r) => ({
        id: r.id,
        status: r.status,
        title: r.title,
        createdAt: r.created_at,
      })),
      latestReportSections: reportSections,
    });
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    jobCount: (jobs || []).length,
    jobs: jobDetails,
  });
}
