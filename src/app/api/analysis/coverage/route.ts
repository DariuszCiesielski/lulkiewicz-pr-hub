import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { THREAD_SUMMARY_SECTION_KEY } from '@/lib/ai/thread-summary-prompt';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';
import { loadProfile, loadProfileSections } from '@/lib/ai/profile-loader';
import { getAnalysisProfile } from '@/lib/ai/analysis-profiles';
import type { AnalysisProfileId } from '@/types/email';

/**
 * GET /api/analysis/coverage?mailboxId=X
 *
 * Returns which report sections have analysis results and which are missing.
 * Used by the report generation form to warn the user before generating.
 *
 * Profile-aware: loads the profile from the latest analysis_job and uses
 * the correct sections (e.g. 6 for case_analytics vs 13 for communication_audit).
 */
export async function GET(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const mailboxId = request.nextUrl.searchParams.get('mailboxId');
  if (!mailboxId) {
    return NextResponse.json({ error: 'Wymagany mailboxId' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const mailboxAllowed = await isMailboxInScope(adminClient, mailboxId, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
  }

  // Find latest completed analysis job for this mailbox
  const { data: latestJob } = await adminClient
    .from('analysis_jobs')
    .select('id, created_at, analysis_profile, analysis_profile_id')
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

  // Load analysis profile to determine correct section list
  const profileRef = latestJob.analysis_profile_id || latestJob.analysis_profile || 'communication_audit';
  const profile = await loadProfile(adminClient, profileRef);

  // Load DB-driven sections for this profile
  const dbProfileSections = profile?.id
    ? await loadProfileSections(adminClient, profile.id)
    : [];

  // Build section definitions: DB sections > hardcoded profile sections > DEFAULT_PROMPTS
  let profilePromptDefs: { section_key: string; title: string }[];
  let profileClientSections: string[];

  if (dbProfileSections.length > 0) {
    profilePromptDefs = dbProfileSections.map((s) => ({
      section_key: s.sectionKey,
      title: s.title,
    }));
    profileClientSections = dbProfileSections
      .filter((s) => s.inClientReport)
      .map((s) => s.sectionKey);
  } else {
    const slug = profile?.slug || 'communication_audit';
    const hardcodedProfile = getAnalysisProfile(slug as AnalysisProfileId);
    if (hardcodedProfile.reportSections.length > 0) {
      profilePromptDefs = hardcodedProfile.reportSections.map((s) => ({
        section_key: s.section_key,
        title: s.title,
      }));
      profileClientSections = hardcodedProfile.reportSections
        .filter((s) => s.inClientReport)
        .map((s) => s.section_key);
    } else {
      profilePromptDefs = DEFAULT_PROMPTS
        .filter((p) => p.section_key !== '_global_context')
        .map((p) => ({ section_key: p.section_key, title: p.title }));
      profileClientSections = CLIENT_REPORT_SECTIONS;
    }
  }

  // Get distinct section_keys from analysis results
  const { data: results } = await adminClient
    .from('analysis_results')
    .select('section_key')
    .eq('analysis_job_id', latestJob.id);

  const analyzedSections = new Set(
    (results || []).map((r: { section_key: string }) => r.section_key)
  );

  // Determine thread summary key for this profile
  const threadSectionKey = profile?.threadSectionKey || THREAD_SUMMARY_SECTION_KEY;
  const hasThreadSummaries = analyzedSections.has(threadSectionKey);

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
  const allPromptDefs = profilePromptDefs.filter((p) => p.section_key !== '_global_context');

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
        : profileClientSections.includes(p.section_key);
    })
    .map((p) => ({ key: p.section_key, title: p.title }));

  // Thread summaries cover all sections — no missing data
  if (hasThreadSummaries) {
    return NextResponse.json({
      hasAnalysis: true,
      analysisDate: latestJob.created_at,
      analysisProfile: profile?.slug || 'communication_audit',
      analyzedSectionKeys: allPromptDefs.map((p) => p.section_key),
      internal: { total: internalSections.length, covered: internalSections.length, missing: [] },
      client: { total: clientSections.length, covered: clientSections.length, missing: [] },
    });
  }

  // Old format: check per-section coverage
  const missingInternal = internalSections.filter((s) => !analyzedSections.has(s.key));
  const missingClient = clientSections.filter((s) => !analyzedSections.has(s.key));

  return NextResponse.json({
    hasAnalysis: true,
    analysisDate: latestJob.created_at,
    analysisProfile: profile?.slug || 'communication_audit',
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
