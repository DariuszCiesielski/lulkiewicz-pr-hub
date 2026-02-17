import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/analysis/coverage?mailboxId=X
 *
 * Returns which report sections have analysis results and which are missing.
 * Used by the report generation form to warn the user before generating.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const mailboxId = request.nextUrl.searchParams.get('mailboxId');
  if (!mailboxId) {
    return NextResponse.json({ error: 'Wymagany mailboxId' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Find latest completed analysis job for this mailbox
  const { data: latestJob } = await adminClient
    .from('analysis_jobs')
    .select('id, created_at')
    .eq('mailbox_id', mailboxId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!latestJob) {
    return NextResponse.json({
      hasAnalysis: false,
      message: 'Brak ukończonej analizy dla tej skrzynki. Uruchom analizę AI przed generowaniem raportu.',
    });
  }

  // Get distinct section_keys from analysis results
  const { data: results } = await adminClient
    .from('analysis_results')
    .select('section_key')
    .eq('analysis_job_id', latestJob.id);

  const analyzedSections = new Set(
    (results || []).map((r: { section_key: string }) => r.section_key)
  );

  // Load DB prompt overrides to get current section config
  const { data: dbPrompts } = await adminClient
    .from('prompt_templates')
    .select('section_key, in_internal_report, in_client_report')
    .eq('tier', 'global')
    .eq('is_active', true);

  const dbPromptMap = new Map(
    (dbPrompts || []).map((p: Record<string, unknown>) => [p.section_key as string, p])
  );

  // Build expected sections per template type
  const allPromptDefs = DEFAULT_PROMPTS.filter((p) => p.section_key !== '_global_context');

  const internalSections = allPromptDefs
    .filter((p) => {
      const override = dbPromptMap.get(p.section_key);
      return override ? (override.in_internal_report as boolean) : true;
    })
    .map((p) => ({ key: p.section_key, title: p.title }));

  const clientSections = allPromptDefs
    .filter((p) => {
      const override = dbPromptMap.get(p.section_key);
      return override
        ? (override.in_client_report as boolean)
        : CLIENT_REPORT_SECTIONS.includes(p.section_key);
    })
    .map((p) => ({ key: p.section_key, title: p.title }));

  const missingInternal = internalSections.filter((s) => !analyzedSections.has(s.key));
  const missingClient = clientSections.filter((s) => !analyzedSections.has(s.key));

  return NextResponse.json({
    hasAnalysis: true,
    analysisDate: latestJob.created_at,
    analyzedSectionKeys: [...analyzedSections],
    internal: {
      total: internalSections.length,
      covered: internalSections.length - missingInternal.length,
      missing: missingInternal,
    },
    client: {
      total: clientSections.length,
      covered: clientSections.length - missingClient.length,
      missing: missingClient,
    },
  });
}
