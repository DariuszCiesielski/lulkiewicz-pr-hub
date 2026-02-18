import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { THREAD_SUMMARY_SECTION_KEY } from '@/lib/ai/thread-summary-prompt';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { synthesizeReportSection } from '@/lib/ai/report-synthesizer';
import { loadAIConfig } from '@/lib/ai/ai-provider';
import type { PerThreadResult, SynthesisInput } from '@/lib/ai/report-synthesizer';

export const maxDuration = 60;

/** Max sections to synthesize per request.
 *  With thread-summary format each section processes ALL summaries at once,
 *  so keep at 1 to give full 60s budget per synthesis call. */
const SECTIONS_PER_REQUEST = 1;

/**
 * POST /api/reports/process — Synthesize a batch of report sections.
 * Body: { reportId, includeThreadSummaries? }
 *
 * Each request processes up to SECTIONS_PER_REQUEST sections.
 * The polling loop in the frontend keeps calling until all sections are done.
 *
 * Returns: { status, processedSections, totalSections, hasMore }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { reportId?: string; includeThreadSummaries?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  if (!body.reportId) {
    return NextResponse.json({ error: 'reportId jest wymagany' }, { status: 400 });
  }

  const includeThreadSummaries = body.includeThreadSummaries ?? false;
  const adminClient = getAdminClient();

  // Load report
  const { data: report, error: reportError } = await adminClient
    .from('reports')
    .select('*')
    .eq('id', body.reportId)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  if (report.status === 'draft') {
    return NextResponse.json({ status: 'completed', processedSections: 0, totalSections: 0, hasMore: false });
  }

  if (report.status !== 'generating') {
    return NextResponse.json({ error: `Raport w nieprawidłowym stanie: ${report.status}` }, { status: 400 });
  }

  try {
    // Load AI config
    const aiConfig = await loadAIConfig(adminClient);

    // Load analysis results grouped by section (explicit limit to avoid PostgREST 1000-row default)
    const { data: results } = await adminClient
      .from('analysis_results')
      .select('section_key, result_data, thread_id')
      .eq('analysis_job_id', report.analysis_job_id)
      .order('created_at', { ascending: true })
      .limit(10000);

    if (!results || results.length === 0) {
      await adminClient.from('reports').update({ status: 'draft' }).eq('id', report.id);
      return NextResponse.json({ status: 'completed', processedSections: 0, totalSections: 0, hasMore: false });
    }

    // Build per-thread results — try new format first, fall back to old
    let threadSummaries: PerThreadResult[] | null = null;
    const sectionResultsMap = new Map<string, PerThreadResult[]>();
    const sectionErrorsMap = new Map<string, number>();
    let totalWithContent = 0;
    let totalWithError = 0;

    // Try NEW FORMAT: load _thread_summary entries with actual content
    const summariesWithContent: PerThreadResult[] = [];
    let summaryErrors = 0;

    for (const r of results) {
      if (r.section_key !== THREAD_SUMMARY_SECTION_KEY) continue;
      const content = r.result_data?.content;
      if (!content) {
        if (r.result_data?.error) summaryErrors++;
        continue;
      }
      summariesWithContent.push({
        threadId: r.thread_id,
        threadSubject: r.result_data?.thread_subject || '',
        content,
      });
    }

    if (summariesWithContent.length > 0) {
      // NEW FORMAT: use thread summaries (has actual content)
      threadSummaries = summariesWithContent;
      totalWithContent = summariesWithContent.length;
      totalWithError = summaryErrors;
      console.log(`Report ${report.id}: NEW format — ${threadSummaries.length} thread summaries, ${totalWithError} errors`);
    } else {
      // OLD FORMAT (or new format with no content): group by section_key
      for (const r of results) {
        if (r.section_key === THREAD_SUMMARY_SECTION_KEY) continue; // skip empty summaries
        const content = r.result_data?.content;
        if (!content) {
          if (r.result_data?.error) {
            sectionErrorsMap.set(r.section_key, (sectionErrorsMap.get(r.section_key) || 0) + 1);
            totalWithError++;
          }
          continue;
        }
        totalWithContent++;
        const existing = sectionResultsMap.get(r.section_key) || [];
        existing.push({
          threadId: r.thread_id,
          threadSubject: r.result_data?.thread_subject || '',
          content,
        });
        sectionResultsMap.set(r.section_key, existing);
      }
      console.log(`Report ${report.id}: OLD format — ${totalWithContent} results, ${totalWithError} errors. Sections: [${[...sectionResultsMap.keys()].join(', ')}]`);
    }

    // Load prompt definitions (same merge logic as POST /api/reports)
    const { data: dbPrompts } = await adminClient
      .from('prompt_templates')
      .select('section_key, title, section_order, system_prompt, user_prompt_template, in_internal_report, in_client_report')
      .eq('tier', 'global')
      .eq('is_active', true);

    const dbPromptMap = new Map(
      (dbPrompts || []).map((p: Record<string, unknown>) => [p.section_key as string, p])
    );

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

    const templateType = report.template_type === 'client' ? 'client' : 'internal';

    // Filter sections to include
    const sectionsToInclude = allPromptDefs
      .filter((p) => {
        if (p.section_key === '_global_context') return false;
        return templateType === 'client' ? p.in_client_report : p.in_internal_report;
      })
      .map((p) => p.section_key);

    const totalSections = sectionsToInclude.length;

    // Check which sections already exist for this report
    const { data: existingSections } = await adminClient
      .from('report_sections')
      .select('section_key')
      .eq('report_id', report.id);

    const completedKeys = new Set((existingSections || []).map((s) => s.section_key));

    // Find sections still needing synthesis
    const missingSections = sectionsToInclude.filter((key) => !completedKeys.has(key));

    if (missingSections.length === 0) {
      // All done
      await adminClient.from('reports').update({ status: 'draft' }).eq('id', report.id);
      return NextResponse.json({
        status: 'completed',
        processedSections: totalSections,
        totalSections,
        hasMore: false,
      });
    }

    // Take next batch
    const batchKeys = missingSections.slice(0, SECTIONS_PER_REQUEST);

    // Load global context
    const globalContextOverride = dbPromptMap.get('_global_context');
    const globalContext = (globalContextOverride?.user_prompt_template as string) ||
      DEFAULT_PROMPTS.find((p) => p.section_key === '_global_context')?.user_prompt_template ||
      undefined;

    // Mailbox name for synthesis prompt
    const { data: mailbox } = await adminClient
      .from('mailboxes')
      .select('display_name, email_address')
      .eq('id', report.mailbox_id)
      .single();

    const mailboxName = mailbox?.display_name || mailbox?.email_address || 'Nieznana';

    const dateRange = report.date_range_from && report.date_range_to
      ? { from: report.date_range_from, to: report.date_range_to }
      : undefined;

    // Process batch in parallel
    const batchPromises = batchKeys.map(async (sectionKey) => {
      const promptDef = promptDefMap.get(sectionKey);
      if (!promptDef) return null;

      // New format: all sections get the same thread summaries
      // Old format: each section gets its own per-section results
      const perThreadResults = threadSummaries ?? (sectionResultsMap.get(sectionKey) || []);

      if (perThreadResults.length === 0) {
        const errorCount = threadSummaries
          ? totalWithError
          : (sectionErrorsMap.get(sectionKey) || 0);
        const message = errorCount > 0
          ? `*Analiza AI nie powiodła się dla tej sekcji (${errorCount} błędów). Uruchom analizę ponownie, aby uzupełnić dane.*`
          : '*Brak danych analizy dla tej sekcji. Upewnij się, że analiza AI została ukończona przed generowaniem raportu.*';
        return {
          report_id: report.id,
          section_key: sectionKey,
          section_order: promptDef.section_order,
          title: promptDef.title,
          content_markdown: message,
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
        const errorMsg = err instanceof Error ? err.message : 'Nieznany błąd';

        return {
          report_id: report.id,
          section_key: sectionKey,
          section_order: promptDef.section_order,
          title: promptDef.title,
          content_markdown: `*Synteza tej sekcji nie powiodła się (${errorMsg}). Spróbuj wygenerować raport ponownie.*`,
          is_edited: false,
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    const newSections: {
      report_id: string;
      section_key: string;
      section_order: number;
      title: string;
      content_markdown: string;
      is_edited: boolean;
    }[] = [];

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        newSections.push(result.value);
      }
    }

    if (newSections.length > 0) {
      const { error: insertError } = await adminClient
        .from('report_sections')
        .insert(newSections);

      if (insertError) {
        console.error('Error inserting report sections:', insertError);
      }
    }

    const processedSections = completedKeys.size + newSections.length;
    const hasMore = processedSections < totalSections;

    if (!hasMore) {
      await adminClient.from('reports').update({ status: 'draft' }).eq('id', report.id);
    }

    return NextResponse.json({
      status: hasMore ? 'processing' : 'completed',
      processedSections,
      totalSections,
      hasMore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('Report process error:', error);

    return NextResponse.json({
      status: 'failed',
      error: message,
      processedSections: 0,
      totalSections: 0,
    });
  }
}
