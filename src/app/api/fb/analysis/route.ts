import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/fb/analysis — Lista jobow analizy AI postow FB.
 * Query: ?groupId=uuid (opcjonalnie)
 * Zwraca ostatnie 10 jobow, posortowane od najnowszych.
 * Enrichment: dolacza nazwe grupy z fb_groups.
 */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const groupId = request.nextUrl.searchParams.get('groupId');
  const adminClient = getAdminClient();

  let query = adminClient
    .from('fb_analysis_jobs')
    .select('id, group_id, status, total_posts, analyzed_posts, progress, error_message, started_at, completed_at, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data: jobs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with group name
  const groupIds = [...new Set((jobs || []).map((j) => j.group_id))];
  const groupNameMap = new Map<string, string>();

  if (groupIds.length > 0) {
    const { data: groups } = await adminClient
      .from('fb_groups')
      .select('id, name')
      .in('id', groupIds);

    for (const g of groups || []) {
      groupNameMap.set(g.id, g.name);
    }
  }

  const enrichedJobs = (jobs || []).map((job) => ({
    ...job,
    group_name: groupNameMap.get(job.group_id) || null,
  }));

  return NextResponse.json({ jobs: enrichedJobs });
}

/**
 * POST /api/fb/analysis — Tworzy nowy job analizy AI postow FB.
 * Body: { groupId: string, forceReanalyze?: boolean }
 *
 * forceReanalyze jest persisted w job.metadata JSONB —
 * process route odczytuje go stamtad (nie z request body).
 * Pattern identyczny jak sync_jobs.metadata w email-analyzer.
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  let body: { groupId?: string; forceReanalyze?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  if (!body.groupId) {
    return NextResponse.json({ error: 'groupId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const forceReanalyze = body.forceReanalyze === true;

  // 1. Sprawdz czy grupa istnieje i nie jest deleted
  const { data: group, error: groupError } = await adminClient
    .from('fb_groups')
    .select('id, name')
    .eq('id', body.groupId)
    .is('deleted_at', null)
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: 'Grupa nie zostala znaleziona' }, { status: 404 });
  }

  // 2. Sprawdz AI config
  const { data: aiConfig } = await adminClient
    .from('ai_config')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!aiConfig) {
    return NextResponse.json(
      { error: 'Brak konfiguracji AI. Ustaw klucz API w Ustawieniach AI.' },
      { status: 400 }
    );
  }

  // 3. Sprawdz brak aktywnego joba
  const { data: activeJobs } = await adminClient
    .from('fb_analysis_jobs')
    .select('id')
    .eq('group_id', body.groupId)
    .in('status', ['pending', 'running', 'paused']);

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json(
      { error: 'Analiza juz trwa dla tej grupy' },
      { status: 409 }
    );
  }

  // 4. Policz posty do analizy
  let countQuery = adminClient
    .from('fb_posts')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', body.groupId)
    .not('content', 'is', null);

  if (!forceReanalyze) {
    countQuery = countQuery.is('sentiment', null);
  }

  const { count: totalPosts } = await countQuery;

  if (!totalPosts || totalPosts === 0) {
    return NextResponse.json(
      { error: forceReanalyze
          ? 'Brak postow z trescia do analizy w tej grupie'
          : 'Brak nowych postow do analizy. Wszystkie posty zostaly juz przeanalizowane.'
      },
      { status: 400 }
    );
  }

  // 5. Stworz job z metadata { forceReanalyze }
  const { data: job, error: jobError } = await adminClient
    .from('fb_analysis_jobs')
    .insert({
      group_id: body.groupId,
      status: 'pending',
      total_posts: totalPosts,
      analyzed_posts: 0,
      progress: 0,
      started_at: new Date().toISOString(),
      metadata: { forceReanalyze },
    })
    .select('id, status, total_posts')
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: `Blad tworzenia zadania: ${jobError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    totalPosts: job.total_posts,
    forceReanalyze,
  });
}
