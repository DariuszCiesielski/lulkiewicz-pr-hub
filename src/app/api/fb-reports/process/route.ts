import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { loadAIConfig } from '@/lib/ai/ai-provider';
import {
  synthesizeGroupAnalysis,
  synthesizeGroupRisk,
  synthesizeGroupRecommendations,
  synthesizeDeveloperSummary,
  type FbPostForSynthesis,
} from '@/lib/ai/fb-report-synthesizer';

export const maxDuration = 300;

/**
 * POST /api/fb-reports/process — Polling synthesis endpoint for FB reports.
 * Body: { reportId }
 *
 * Each request processes exactly 1 section (1 AI call).
 * Section order per group: analysis → risk → recommendations.
 * Final section: developer summary (cross-group).
 *
 * Returns: { status, processedSections, totalSections, hasMore }
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { reportId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  if (!body.reportId) {
    return NextResponse.json({ error: 'reportId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Load report
  const { data: report, error: reportError } = await adminClient
    .from('fb_reports')
    .select('*')
    .eq('id', body.reportId)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  // Guard: if already done
  if (report.status === 'draft') {
    return NextResponse.json({
      status: 'completed',
      processedSections: 0,
      totalSections: 0,
      hasMore: false,
    });
  }

  if (report.status !== 'generating') {
    return NextResponse.json(
      { error: `Raport w nieprawidłowym stanie: ${report.status}` },
      { status: 400 }
    );
  }

  try {
    const aiConfig = await loadAIConfig(adminClient);
    const groupIds: string[] = (report.group_ids as string[]) || [];
    const developer =
      ((report.summary_data as Record<string, unknown>)?.developer as string) || 'Nieznany';

    // Build ordered section list: 3 per group + 1 developer summary
    const allSectionKeys: string[] = [];
    for (const gId of groupIds) {
      allSectionKeys.push(`group:${gId}:analysis`);
      allSectionKeys.push(`group:${gId}:risk`);
      allSectionKeys.push(`group:${gId}:recommendations`);
    }
    allSectionKeys.push(`developer:${developer}:summary`);

    const totalSections = allSectionKeys.length;

    // Check which sections already exist
    const { data: existingSections } = await adminClient
      .from('fb_report_sections')
      .select('section_key')
      .eq('report_id', report.id);

    const completedKeys = new Set((existingSections || []).map((s: Record<string, unknown>) => s.section_key as string));

    // Find first missing section
    const nextKey = allSectionKeys.find((key) => !completedKeys.has(key));

    if (!nextKey) {
      // All done
      await adminClient.from('fb_reports').update({ status: 'draft' }).eq('id', report.id);
      return NextResponse.json({
        status: 'completed',
        processedSections: totalSections,
        totalSections,
        hasMore: false,
      });
    }

    // Parse the section key to determine what to do
    const parts = nextKey.split(':');
    // parts = ["group", groupId, "analysis"|"risk"|"recommendations"]
    // or     ["developer", name, "summary"]

    let sectionTitle = '';
    const sectionOrder = allSectionKeys.indexOf(nextKey);
    let contentMarkdown = '';

    if (parts[0] === 'group') {
      const groupId = parts[1];
      const sectionType = parts[2]; // analysis, risk, or recommendations

      // Load group name
      const { data: group } = await adminClient
        .from('fb_groups')
        .select('name')
        .eq('id', groupId)
        .single();

      const groupName = (group?.name as string) || 'Nieznana grupa';

      // Load posts for this group in date range (relevance >= 3)
      const { data: rawPosts } = await adminClient
        .from('fb_posts')
        .select(
          'content, sentiment, relevance_score, ai_snippet, ai_categories, post_url, posted_at, author_name'
        )
        .eq('group_id', groupId)
        .gte('posted_at', report.date_from as string)
        .lte('posted_at', report.date_to as string)
        .gte('relevance_score', 3)
        .order('relevance_score', { ascending: false })
        .limit(200);

      const posts: FbPostForSynthesis[] = (rawPosts || []).map(
        (p: Record<string, unknown>) => ({
          content: (p.content as string) || '',
          sentiment: (p.sentiment as string) || null,
          relevance_score: (p.relevance_score as number) || null,
          ai_snippet: (p.ai_snippet as string) || null,
          ai_categories: (p.ai_categories as string[]) || null,
          post_url: (p.post_url as string) || null,
          posted_at: (p.posted_at as string) || null,
          author_name: (p.author_name as string) || null,
          group_name: groupName,
        })
      );

      const dateRange =
        report.date_from && report.date_to
          ? { from: report.date_from as string, to: report.date_to as string }
          : undefined;

      if (sectionType === 'analysis') {
        sectionTitle = `${groupName} — Analiza ogólna i sentyment`;
        const result = await synthesizeGroupAnalysis(aiConfig, posts, groupName, dateRange);
        contentMarkdown = result.markdown;
      } else if (sectionType === 'risk') {
        sectionTitle = `${groupName} — Ryzyko PR`;
        const result = await synthesizeGroupRisk(aiConfig, posts, groupName, dateRange);
        contentMarkdown = result.markdown;
      } else if (sectionType === 'recommendations') {
        sectionTitle = `${groupName} — Rekomendacje`;

        // Load previous 2 sections' content for context
        const { data: prevSections } = await adminClient
          .from('fb_report_sections')
          .select('content_markdown')
          .eq('report_id', report.id)
          .in('section_key', [`group:${groupId}:analysis`, `group:${groupId}:risk`]);

        const previousSections = (prevSections || [])
          .map((s: Record<string, unknown>) => s.content_markdown as string)
          .join('\n\n---\n\n');

        const result = await synthesizeGroupRecommendations(
          aiConfig,
          posts,
          groupName,
          previousSections,
          dateRange
        );
        contentMarkdown = result.markdown;
      }
    } else if (parts[0] === 'developer') {
      // Developer summary — load ALL group sections
      sectionTitle = `Podsumowanie — ${developer}`;

      const { data: allGroupSections } = await adminClient
        .from('fb_report_sections')
        .select('section_key, content_markdown')
        .eq('report_id', report.id)
        .like('section_key', 'group:%')
        .order('section_order', { ascending: true });

      // Group sections by groupId
      const groupSectionsMap = new Map<string, { groupName: string; content: string }>();
      for (const s of allGroupSections || []) {
        const gId = (s.section_key as string).split(':')[1];
        const existing = groupSectionsMap.get(gId);
        if (existing) {
          existing.content += '\n\n' + (s.content_markdown as string);
        } else {
          groupSectionsMap.set(gId, {
            groupName: gId,
            content: (s.content_markdown as string) || '',
          });
        }
      }

      // Resolve group names
      const groupIdsList = [...groupSectionsMap.keys()];
      if (groupIdsList.length > 0) {
        const { data: groups } = await adminClient
          .from('fb_groups')
          .select('id, name')
          .in('id', groupIdsList);

        for (const g of groups || []) {
          const entry = groupSectionsMap.get(g.id as string);
          if (entry) entry.groupName = g.name as string;
        }
      }

      const groupSections = [...groupSectionsMap.values()];

      const dateRange =
        report.date_from && report.date_to
          ? { from: report.date_from as string, to: report.date_to as string }
          : undefined;

      const result = await synthesizeDeveloperSummary(
        aiConfig,
        groupSections,
        developer,
        dateRange
      );
      contentMarkdown = result.markdown;
    }

    // Insert the section
    await adminClient.from('fb_report_sections').insert({
      report_id: report.id,
      section_key: nextKey,
      section_order: sectionOrder,
      title: sectionTitle,
      content_markdown: contentMarkdown || '*Brak danych dla tej sekcji.*',
      is_edited: false,
    });

    const processedSections = completedKeys.size + 1;
    const hasMore = processedSections < totalSections;

    if (!hasMore) {
      await adminClient.from('fb_reports').update({ status: 'draft' }).eq('id', report.id);
    }

    return NextResponse.json({
      status: hasMore ? 'processing' : 'completed',
      processedSections,
      totalSections,
      hasMore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    console.error('FB Report process error:', error);

    return NextResponse.json({
      status: 'failed',
      error: message,
      processedSections: 0,
      totalSections: 0,
    });
  }
}
