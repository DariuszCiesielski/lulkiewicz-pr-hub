import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { loadProfile, loadProfileSections } from '@/lib/ai/profile-loader';
import { getAdminClient } from '@/lib/api/admin';
import {
  getScopedMailboxIds,
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

export const maxDuration = 60;

/** GET /api/reports — list reports */
export async function GET(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get('mailboxId');

  const adminClient = getAdminClient();
  const scopedMailboxIds = await getScopedMailboxIds(adminClient, scope.isDemoUser);

  let query = adminClient
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (mailboxId) {
    const mailboxAllowed = await isMailboxInScope(adminClient, mailboxId, scope.isDemoUser);
    if (!mailboxAllowed) {
      return NextResponse.json({ reports: [] });
    }
    query = query.eq('mailbox_id', mailboxId);
  } else if (scopedMailboxIds.length > 0) {
    query = query.in('mailbox_id', scopedMailboxIds);
  } else {
    return NextResponse.json({ reports: [] });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data || [] });
}

/**
 * POST /api/reports — generate a report from analysis results.
 * Body: { analysisJobId, mailboxId, templateType, detailLevel, title?, includeThreadSummaries? }
 *
 * detailLevel:
 *  - 'synthetic' (default): concise 5-6 page report, max 3-4 sentences per section
 *  - 'standard': detailed 15-20 page report with sub-sections and tables
 */
export async function POST(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: {
    analysisJobId?: string;
    mailboxId?: string;
    templateType?: string;
    detailLevel?: string;
    title?: string;
    includeThreadSummaries?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const templateType = body.templateType === 'client' ? 'client' : 'internal';
  const detailLevel = body.detailLevel === 'standard' ? 'standard' : 'synthetic';
  const adminClient = getAdminClient();

  if (body.mailboxId) {
    const mailboxAllowed = await isMailboxInScope(adminClient, body.mailboxId, scope.isDemoUser);
    if (!mailboxAllowed) {
      return NextResponse.json(
        { error: 'Skrzynka nie została znaleziona' },
        { status: 404 }
      );
    }
  }

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

  const jobMailboxAllowed = await isMailboxInScope(adminClient, job.mailbox_id, scope.isDemoUser);
  if (!jobMailboxAllowed) {
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

  // Load analysis results grouped by section (explicit limit to avoid PostgREST 1000-row default)
  const { data: results } = await adminClient
    .from('analysis_results')
    .select('section_key, result_data, thread_id')
    .eq('analysis_job_id', analysisJobId)
    .order('created_at', { ascending: true })
    .limit(10000);

  if (!results || results.length === 0) {
    return NextResponse.json({ error: 'Brak wyników analizy' }, { status: 400 });
  }

  // Load analysis profile from DB
  const profileRef = job.analysis_profile_id || job.analysis_profile || 'communication_audit';
  const profile = await loadProfile(adminClient, profileRef);
  const profileSections = profile?.id
    ? await loadProfileSections(adminClient, profile.id)
    : [];

  // Build section definitions: DB-driven sections or fallback to DEFAULT_PROMPTS
  const profilePromptDefs = profileSections.length > 0
    ? profileSections.map((s) => ({
        section_key: s.sectionKey,
        title: s.title,
        section_order: s.sectionOrder,
        system_prompt: s.systemPrompt,
        user_prompt_template: s.userPromptTemplate,
      }))
    : DEFAULT_PROMPTS;

  const profileClientSections = profileSections.length > 0
    ? profileSections.filter((s) => s.inClientReport).map((s) => s.sectionKey)
    : CLIENT_REPORT_SECTIONS;

  // Load user-configured prompt overrides from DB
  const { data: dbPrompts } = await adminClient
    .from('prompt_templates')
    .select('section_key, title, section_order, system_prompt, user_prompt_template, in_internal_report, in_client_report')
    .eq('tier', 'global')
    .eq('is_active', true);

  const dbPromptMap = new Map(
    (dbPrompts || []).map((p: Record<string, unknown>) => [p.section_key as string, p])
  );

  // Build full prompt definitions: profile defaults merged with DB overrides
  const allPromptDefs = [
    ...profilePromptDefs.map((def) => {
      const override = dbPromptMap.get(def.section_key);
      return {
        ...def,
        in_internal_report: override ? (override.in_internal_report as boolean) : true,
        in_client_report: override ? (override.in_client_report as boolean) : profileClientSections.includes(def.section_key),
      };
    }),
    // Only include DB-only custom sections for profiles that use default prompts
    ...(profile?.usesDefaultPrompts
      ? (dbPrompts || [])
          .filter((p: Record<string, unknown>) =>
            !profilePromptDefs.some((d) => d.section_key === (p.section_key as string))
          )
          .map((p: Record<string, unknown>) => ({
            section_key: p.section_key as string,
            title: p.title as string,
            section_order: (p.section_order as number) || 0,
            system_prompt: p.system_prompt as string,
            user_prompt_template: p.user_prompt_template as string,
            in_internal_report: p.in_internal_report as boolean,
            in_client_report: p.in_client_report as boolean,
          }))
      : []),
  ];

  // Filter sections: respect user's in_internal_report/in_client_report flags, exclude _global_context
  const sectionsToInclude = allPromptDefs
    .filter((p) => {
      if (p.section_key === '_global_context') return false;
      return templateType === 'client' ? p.in_client_report : p.in_internal_report;
    })
    .map((p) => p.section_key);

  // Count unique threads
  const uniqueThreadIds = new Set(results.map((r) => r.thread_id));
  const threadCount = uniqueThreadIds.size;

  // Build title
  const levelLabel = detailLevel === 'synthetic' ? 'syntetyczny' : 'standardowy';
  const title = body.title ||
    `Raport ${levelLabel} ${templateType === 'client' ? 'kliencki' : 'wewnętrzny'} — ${mailboxName} (${threadCount} wątków)`;

  // Create report record — polling-driven synthesis
  const { data: report, error: reportError } = await adminClient
    .from('reports')
    .insert({
      mailbox_id: job.mailbox_id,
      analysis_job_id: analysisJobId,
      template_type: templateType,
      detail_level: detailLevel,
      title,
      date_range_from: job.date_range_from,
      date_range_to: job.date_range_to,
      status: 'generating',
    })
    .select('id')
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: `Błąd tworzenia raportu: ${reportError?.message}` }, { status: 500 });
  }

  // Return immediately — frontend polls POST /api/reports/process
  return NextResponse.json({
    reportId: report.id,
    title,
    detailLevel,
    totalSections: sectionsToInclude.length,
    threadCount,
    status: 'generating',
  });
}
