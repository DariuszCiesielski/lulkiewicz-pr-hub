import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  const [groupsResult, postsResult] = await Promise.allSettled([
    adminClient
      .from('fb_groups')
      .select('id, developer, last_scraped_at')
      .is('deleted_at', null)
      .eq('status', 'active'),
    adminClient
      .from('fb_posts')
      .select('group_id, sentiment, relevance_score'),
  ]);

  const groups = (groupsResult.status === 'fulfilled' ? (groupsResult.value.data || []) : []) as Record<string, unknown>[];
  const posts = (postsResult.status === 'fulfilled' ? (postsResult.value.data || []) : []) as Record<string, unknown>[];

  // KPI
  const totalGroups = groups.length;
  const totalPosts = posts.length;
  const relevantPosts = posts.filter((p) => p.relevance_score != null).length;
  const negativePosts = posts.filter((p) => p.sentiment === 'negative').length;

  const scores = posts
    .map((p) => p.relevance_score as number | null)
    .filter((s): s is number => s != null);
  const avgRelevance = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
    : 0;

  // Last scrape
  const scrapeDates = groups
    .map((g) => g.last_scraped_at as string | null)
    .filter(Boolean) as string[];
  const lastScrape = scrapeDates.length > 0
    ? scrapeDates.sort().reverse()[0]
    : null;

  // Developer summaries
  const groupsByDev: Record<string, string[]> = {};
  for (const g of groups) {
    const dev = (g.developer as string) || 'Bez dewelopera';
    if (!groupsByDev[dev]) groupsByDev[dev] = [];
    groupsByDev[dev].push(g.id as string);
  }

  const developerSummaries = Object.entries(groupsByDev).map(([developer, groupIds]) => {
    const devPosts = posts.filter((p) => groupIds.includes(p.group_id as string));
    return {
      developer,
      groups: groupIds.length,
      relevantPosts: devPosts.filter((p) => p.relevance_score != null).length,
      negativePosts: devPosts.filter((p) => p.sentiment === 'negative').length,
    };
  }).sort((a, b) => a.developer.localeCompare(b.developer, 'pl'));

  return NextResponse.json({
    kpi: { totalGroups, totalPosts, relevantPosts, negativePosts, lastScrape, avgRelevance },
    developerSummaries,
  });
}
