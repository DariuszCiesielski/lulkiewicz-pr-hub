import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export const maxDuration = 60;

/** GET /api/fb-reports — list FB reports */
export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('fb_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data || [] });
}

/** POST /api/fb-reports — create a new FB report */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: {
    developer?: string;
    dateFrom?: string;
    dateTo?: string;
    groupIds?: string[];
    excludeGroupIds?: string[];  // backward compat
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Nieprawidłowy format danych' },
      { status: 400 }
    );
  }

  if (!body.developer || !body.dateFrom || !body.dateTo) {
    return NextResponse.json(
      { error: 'Wymagane pola: developer, dateFrom, dateTo' },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // 1. Get active groups for this developer
  const { data: allGroups, error: groupsError } = await adminClient
    .from('fb_groups')
    .select('id, name')
    .eq('developer', body.developer)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (groupsError) {
    return NextResponse.json(
      { error: `Błąd pobierania grup: ${groupsError.message}` },
      { status: 500 }
    );
  }

  if (!allGroups || allGroups.length === 0) {
    return NextResponse.json(
      { error: 'Brak aktywnych grup dla tego dewelopera' },
      { status: 400 }
    );
  }

  // 2. Filter groups — preferuj jawną listę groupIds, fallback na excludeGroupIds
  let groups: { id: string; name: string }[];
  if (body.groupIds && body.groupIds.length > 0) {
    const includeSet = new Set(body.groupIds);
    groups = allGroups.filter((g: { id: string }) => includeSet.has(g.id));
  } else {
    const excludeSet = new Set(body.excludeGroupIds || []);
    groups = allGroups.filter((g: { id: string }) => !excludeSet.has(g.id));
  }

  if (groups.length === 0) {
    return NextResponse.json(
      { error: 'Nie wybrano żadnych grup' },
      { status: 400 }
    );
  }

  // 3. Check if groups have analyzed posts in date range
  const groupIds = groups.map((g: { id: string }) => g.id);
  const { count } = await adminClient
    .from('fb_posts')
    .select('id', { count: 'exact', head: true })
    .in('group_id', groupIds)
    .gte('posted_at', body.dateFrom)
    .lte('posted_at', body.dateTo)
    .not('sentiment', 'is', null);

  if (!count || count === 0) {
    return NextResponse.json(
      {
        error:
          'Brak przeanalizowanych postów w wybranym zakresie dat. Uruchom najpierw analizę AI.',
      },
      { status: 400 }
    );
  }

  // 4. Calculate total sections: 3 per group + 1 developer summary
  const totalSections = groups.length * 3 + 1;

  // 5. Build title
  const dateFromFormatted = new Date(body.dateFrom).toLocaleDateString('pl-PL');
  const dateToFormatted = new Date(body.dateTo).toLocaleDateString('pl-PL');
  const title = `Raport FB — ${body.developer} (${groups.length} grup, ${dateFromFormatted} — ${dateToFormatted})`;

  // 6. Insert report
  const { data: report, error: insertError } = await adminClient
    .from('fb_reports')
    .insert({
      title,
      group_ids: groupIds,
      date_from: body.dateFrom,
      date_to: body.dateTo,
      status: 'generating',
      summary_data: { developer: body.developer, groupCount: groups.length },
    })
    .select('id')
    .single();

  if (insertError || !report) {
    return NextResponse.json(
      { error: `Błąd tworzenia raportu: ${insertError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    reportId: report.id,
    title,
    totalSections,
    status: 'generating',
  });
}
