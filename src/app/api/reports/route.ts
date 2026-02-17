import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { synthesizeReportSection } from '@/lib/ai/report-synthesizer';
import { loadAIConfig } from '@/lib/ai/ai-provider';
import type { PerThreadResult, SynthesisInput } from '@/lib/ai/report-synthesizer';

export const maxDuration = 60;

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
 * Body: { analysisJobId, mailboxId, templateType, detailLevel, title?, includeThreadSummaries? }
 *
 * detailLevel:
 *  - 'synthetic' (default): AI REDUCE — synthesizes per-thread results into ~5-15 page report
 *  - 'detailed': Original behavior — concatenates per-thread results (thread by thread)
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
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
  const detailLevel = body.detailLevel === 'detailed' ? 'detailed' : 'synthetic';
  const includeThreadSummaries = body.includeThreadSummaries ?? false;
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

  // Group by section — collect content + thread metadata
  const sectionResultsMap = new Map<string, PerThreadResult[]>();
  for (const r of results) {
    const content = r.result_data?.content;
    if (!content) continue;
    const existing = sectionResultsMap.get(r.section_key) || [];
    existing.push({
      threadId: r.thread_id,
      threadSubject: r.result_data?.thread_subject || '',
      content,
    });
    sectionResultsMap.set(r.section_key, existing);
  }

  // Load user-configured prompt overrides from DB
  const { data: dbPrompts } = await adminClient
    .from('prompt_templates')
    .select('section_key, title, section_order, system_prompt, user_prompt_template, in_internal_report, in_client_report')
    .eq('tier', 'global')
    .eq('is_active', true);

  const dbPromptMap = new Map(
    (dbPrompts || []).map((p: Record<string, unknown>) => [p.section_key as string, p])
  );

  // Build full prompt definitions: defaults merged with DB overrides + custom sections
  const allPromptDefs = [
    ...DEFAULT_PROMPTS.map((def) => {
      const override = dbPromptMap.get(def.section_key);
      return {
        ...def,
        in_internal_report: override ? (override.in_internal_report as boolean) : true,
        in_client_report: override ? (override.in_client_report as boolean) : CLIENT_REPORT_SECTIONS.includes(def.section_key),
      };
    }),
    ...(dbPrompts || [])
      .filter((p: Record<string, unknown>) =>
        !DEFAULT_PROMPTS.some((d) => d.section_key === (p.section_key as string))
      )
      .map((p: Record<string, unknown>) => ({
        section_key: p.section_key as string,
        title: p.title as string,
        section_order: (p.section_order as number) || 0,
        system_prompt: p.system_prompt as string,
        user_prompt_template: p.user_prompt_template as string,
        in_internal_report: p.in_internal_report as boolean,
        in_client_report: p.in_client_report as boolean,
      })),
  ];

  const promptDefMap = new Map(allPromptDefs.map((p) => [p.section_key, p]));

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
  const detailLabel = detailLevel === 'synthetic' ? 'syntetyczny' : 'szczegółowy';
  const title = body.title ||
    `Raport ${detailLabel} ${templateType === 'client' ? 'kliencki' : 'wewnętrzny'} — ${mailboxName} (${threadCount} wątków)`;

  // Create report record
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

  // Load global context from _global_context prompt (DB override or default)
  const globalContextOverride = dbPromptMap.get('_global_context');
  const globalContext = (globalContextOverride?.user_prompt_template as string) ||
    DEFAULT_PROMPTS.find((p) => p.section_key === '_global_context')?.user_prompt_template ||
    undefined;

  // Date range for synthesis context
  const dateRange = job.date_range_from && job.date_range_to
    ? { from: job.date_range_from, to: job.date_range_to }
    : undefined;

  // ----- REDUCE PHASE -----
  let sections: {
    report_id: string;
    section_key: string;
    section_order: number;
    title: string;
    content_markdown: string;
    is_edited: boolean;
  }[] = [];

  if (detailLevel === 'synthetic') {
    // ---- AI SYNTHESIS: parallel per section ----
    let aiConfig;
    try {
      aiConfig = await loadAIConfig(adminClient);
    } catch (err) {
      // Fallback to detailed if AI not configured
      return NextResponse.json(
        { error: `Konfiguracja AI wymagana dla raportu syntetycznego: ${err instanceof Error ? err.message : 'Błąd'}` },
        { status: 400 }
      );
    }

    // Batch sections to avoid rate limiting and stay within Vercel 60s timeout.
    // 13 sections / 4 per batch = 3-4 batches × ~10s each ≈ 35s total.
    const SECTION_BATCH_SIZE = 4;

    for (let batchIdx = 0; batchIdx < sectionsToInclude.length; batchIdx += SECTION_BATCH_SIZE) {
      const batchKeys = sectionsToInclude.slice(batchIdx, batchIdx + SECTION_BATCH_SIZE);

      const batchPromises = batchKeys.map(async (sectionKey) => {
        const promptDef = promptDefMap.get(sectionKey);
        if (!promptDef) return null;

        const perThreadResults = sectionResultsMap.get(sectionKey) || [];

        if (perThreadResults.length === 0) {
          return {
            report_id: report.id,
            section_key: sectionKey,
            section_order: promptDef.section_order,
            title: promptDef.title,
            content_markdown: '*Brak danych dla tej sekcji.*',
            is_edited: false,
          };
        }

        const input: SynthesisInput = {
          sectionKey,
          sectionTitle: promptDef.title,
          perThreadResults,
          templateType,
          mailboxName,
          dateRange,
          globalContext,
          includeThreadSummaries,
        };

        try {
          const output = await synthesizeReportSection(aiConfig, input);
          return {
            report_id: report.id,
            section_key: sectionKey,
            section_order: promptDef.section_order,
            title: promptDef.title,
            content_markdown: output.markdown || '*Brak danych dla tej sekcji.*',
            is_edited: false,
          };
        } catch (err) {
          console.error(`Synthesis error for section ${sectionKey}:`, err);
          const contents = perThreadResults.map((r) => r.content);
          const markdown = contents.length === 1
            ? contents[0]
            : contents.map((c, i) => `### Wątek ${i + 1}\n\n${c}`).join('\n\n---\n\n');

          return {
            report_id: report.id,
            section_key: sectionKey,
            section_order: promptDef.section_order,
            title: `${promptDef.title} (synteza nieudana — dane surowe)`,
            content_markdown: markdown,
            is_edited: false,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          sections.push(result.value);
        }
      }
    }
  } else {
    // ---- DETAILED: original thread-by-thread concatenation ----
    for (const sectionKey of sectionsToInclude) {
      const promptDef = promptDefMap.get(sectionKey);
      if (!promptDef) continue;

      const perThreadResults = sectionResultsMap.get(sectionKey) || [];
      const contents = perThreadResults.map((r) => r.content);

      const markdown = contents.length === 0
        ? '*Brak danych dla tej sekcji.*'
        : contents.length === 1
          ? contents[0]
          : contents.map((c, i) => {
              const subject = perThreadResults[i]?.threadSubject;
              const header = subject ? `### Wątek ${i + 1}: ${subject}` : `### Wątek ${i + 1}`;
              return `${header}\n\n${c}`;
            }).join('\n\n---\n\n');

      sections.push({
        report_id: report.id,
        section_key: sectionKey,
        section_order: promptDef.section_order,
        title: promptDef.title,
        content_markdown: markdown,
        is_edited: false,
      });
    }
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
    detailLevel,
    threadCount,
  });
}
