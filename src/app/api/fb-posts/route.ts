import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/fb-posts
 * Lista postów FB z joinem na fb_groups (group_name).
 * Query params: group_id, sentiment, search, relevant_only
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const { searchParams } = request.nextUrl;
  const groupId = searchParams.get('group_id');
  const sentiment = searchParams.get('sentiment');
  const search = searchParams.get('search');
  const relevantOnly = searchParams.get('relevant_only') === 'true';

  // Supabase foreign key embedding: fb_posts.group_id -> fb_groups.id
  let query = adminClient
    .from('fb_posts')
    .select('id, group_id, facebook_post_id, author_name, content, posted_at, likes_count, comments_count, shares_count, post_url, media_url, sentiment, relevance_score, ai_snippet, ai_categories, fb_groups!inner(name)')
    .order('posted_at', { ascending: false })
    .limit(200);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }
  if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
    query = query.eq('sentiment', sentiment);
  }
  if (relevantOnly) {
    query = query.not('relevance_score', 'is', null);
  }
  if (search) {
    query = query.ilike('content', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten group name from embedded join
  const posts = (data || []).map((row: Record<string, unknown>) => {
    const group = row.fb_groups as Record<string, unknown> | null;
    return {
      ...row,
      group_name: group?.name || 'Nieznana grupa',
      fb_groups: undefined,
    };
  });

  return NextResponse.json(posts);
}
