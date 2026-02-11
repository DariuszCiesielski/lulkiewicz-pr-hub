import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';

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

/** GET /api/reports — list reports */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get('mailboxId');

  let query = getAdminClient()
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (mailboxId) query = query.eq('mailbox_id', mailboxId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data || [] });
}

/**
 * POST /api/reports — generate a report from analysis results.
 * Body: { analysisJobId, templateType: 'internal' | 'client', title? }
 *
 * REDUCE phase: aggregates per-thread analysis results into report sections.
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { analysisJobId?: string; mailboxId?: string; templateType?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const templateType = body.templateType === 'client' ? 'client' : 'internal';
  const adminClient = getAdminClient();

  // Resolve analysisJobId — accept directly or find latest completed job for mailbox
  let analysisJobId = body.analysisJobId;

  if (!analysisJobId && body.mailboxId) {
    const { data: latestJob } = await adminClient
      .from('analysis_jobs')
      .select('id')
      .eq('mailbox_id', body.mailboxId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestJob) {
      analysisJobId = latestJob.id;
    }
  }

  if (!analysisJobId) {
    return NextResponse.json(
      { error: 'Wymagany analysisJobId lub mailboxId z ukończoną analizą' },
      { status: 400 }
    );
  }

  // Load analysis job
  const { data: job, error: jobError } = await adminClient
    .from('analysis_jobs')
    .select('*')
    .eq('id', analysisJobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Zadanie analizy nie znalezione' }, { status: 404 });
  }

  if (job.status !== 'completed') {
    return NextResponse.json({ error: 'Analiza nie jest zakończona' }, { status: 400 });
  }

  // Get mailbox name for title
  const { data: mailbox } = await adminClient
    .from('mailboxes')
    .select('display_name, email_address')
    .eq('id', job.mailbox_id)
    .single();

  const mailboxName = mailbox?.display_name || mailbox?.email_address || 'Nieznana';

  // Load analysis results grouped by section
  const { data: results } = await adminClient
    .from('analysis_results')
    .select('section_key, result_data, thread_id')
    .eq('analysis_job_id', analysisJobId)
    .order('created_at', { ascending: true });

  if (!results || results.length === 0) {
    return NextResponse.json({ error: 'Brak wyników analizy' }, { status: 400 });
  }

  // Group by section
  const sectionResults = new Map<string, string[]>();
  for (const r of results) {
    const content = r.result_data?.content;
    if (!content) continue;
    const existing = sectionResults.get(r.section_key) || [];
    existing.push(content);
    sectionResults.set(r.section_key, existing);
  }

  // Filter sections based on template type
  const sectionsToInclude = templateType === 'client'
    ? CLIENT_REPORT_SECTIONS
    : DEFAULT_PROMPTS.map((p) => p.section_key);

  // Create report
  const title = body.title ||
    `Raport ${templateType === 'client' ? 'kliencki' : 'wewnętrzny'} — ${mailboxName}`;

  const { data: report, error: reportError } = await adminClient
    .from('reports')
    .insert({
      mailbox_id: job.mailbox_id,
      analysis_job_id: analysisJobId,
      template_type: templateType,
      title,
      date_range_from: job.date_range_from,
      date_range_to: job.date_range_to,
      status: 'draft',
    })
    .select('id')
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: `Błąd tworzenia raportu: ${reportError?.message}` }, { status: 500 });
  }

  // Create sections — aggregate per-thread results into one section
  const sections = [];
  for (const sectionKey of sectionsToInclude) {
    const promptDef = DEFAULT_PROMPTS.find((p) => p.section_key === sectionKey);
    if (!promptDef) continue;

    const contents = sectionResults.get(sectionKey) || [];
    // Merge per-thread results into a single markdown block
    const markdown = contents.length === 1
      ? contents[0]
      : contents.map((c, i) => `### Wątek ${i + 1}\n\n${c}`).join('\n\n---\n\n');

    sections.push({
      report_id: report.id,
      section_key: sectionKey,
      section_order: promptDef.section_order,
      title: promptDef.title,
      content_markdown: markdown || '*Brak danych dla tej sekcji.*',
      is_edited: false,
    });
  }

  if (sections.length > 0) {
    const { error: sectionsError } = await adminClient
      .from('report_sections')
      .insert(sections);

    if (sectionsError) {
      return NextResponse.json({ error: `Błąd tworzenia sekcji: ${sectionsError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({
    reportId: report.id,
    title,
    sectionsCount: sections.length,
  });
}
