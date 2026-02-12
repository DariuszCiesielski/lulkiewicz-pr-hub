import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

// Kolumny do zwracania w GET — NIGDY cookies_encrypted
const GROUP_SELECT_COLUMNS = 'id, name, facebook_url, developer, status, last_scraped_at, total_posts, ai_instruction, apify_actor_id, created_at, updated_at';

function isValidFbGroupUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.facebook.com' ||
        parsed.hostname === 'facebook.com' ||
        parsed.hostname === 'm.facebook.com') &&
      parsed.pathname.includes('/groups/')
    );
  } catch {
    return false;
  }
}

/**
 * Wyciaga nazwe grupy z URL-a (ostatni segment po /groups/).
 * np. https://www.facebook.com/groups/deweloperzy-krakow -> deweloperzy-krakow
 */
function extractGroupName(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const groupsIndex = parts.indexOf('groups');
    if (groupsIndex >= 0 && parts[groupsIndex + 1]) {
      return decodeURIComponent(parts[groupsIndex + 1]);
    }
  } catch {
    // fallback
  }
  return url;
}

/**
 * GET /api/fb-groups
 * Lista grup (bez soft-deleted) z opcjonalnymi filtrami developer i status.
 * Wzbogaca o relevant_posts (count fb_posts) i has_custom_cookies (boolean).
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const { searchParams } = request.nextUrl;
  const developer = searchParams.get('developer');
  const status = searchParams.get('status');

  // Buduj zapytanie z filtrami
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = adminClient
    .from('fb_groups')
    .select('id, name, facebook_url, developer, status, last_scraped_at, total_posts, ai_instruction, apify_actor_id, created_at, updated_at, cookies_encrypted')
    .is('deleted_at', null);

  if (developer) {
    query = query.eq('developer', developer);
  }
  if (status === 'active' || status === 'paused') {
    query = query.eq('status', status);
  }

  query = query
    .order('developer', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const groups = (data || []) as Record<string, unknown>[];

  if (groups.length === 0) {
    return NextResponse.json([]);
  }

  // Policz relevant_posts per group — osobne zapytanie
  const groupIds = groups.map((g) => g.id as string);
  const { data: postsData } = await adminClient
    .from('fb_posts')
    .select('group_id')
    .in('group_id', groupIds);

  const posts = (postsData || []) as Record<string, unknown>[];
  const postCounts: Record<string, number> = {};
  for (const post of posts) {
    const gid = post.group_id as string;
    postCounts[gid] = (postCounts[gid] || 0) + 1;
  }

  // Wzbogac grupy o relevant_posts i has_custom_cookies, usun cookies_encrypted z response
  const enriched = groups.map((group) => {
    const { cookies_encrypted, ...rest } = group;
    return {
      ...rest,
      relevant_posts: postCounts[group.id as string] || 0,
      has_custom_cookies: cookies_encrypted != null,
    };
  });

  return NextResponse.json(enriched);
}

/**
 * POST /api/fb-groups
 * Tworzy grupe (single) lub grupy (bulk z URL-ami).
 * Single body: { name, facebook_url, developer?, ai_instruction? }
 * Bulk body: { urls: string[], developer? }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: {
    name?: string;
    facebook_url?: string;
    developer?: string;
    ai_instruction?: string;
    urls?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  // Rozroznienie: bulk (urls array) vs single
  if (body.urls && Array.isArray(body.urls)) {
    return handleBulkCreate(adminClient, body.urls, body.developer || null);
  }

  return handleSingleCreate(adminClient, body);
}

async function handleSingleCreate(
  adminClient: ReturnType<typeof getAdminClient>,
  body: { name?: string; facebook_url?: string; developer?: string; ai_instruction?: string }
) {
  const { name, facebook_url, developer, ai_instruction } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Nazwa grupy jest wymagana' }, { status: 400 });
  }
  if (!facebook_url || !isValidFbGroupUrl(facebook_url)) {
    return NextResponse.json(
      { error: 'Wymagany prawidlowy URL grupy Facebook (facebook.com/groups/...)' },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient
    .from('fb_groups')
    .insert({
      name: name.trim(),
      facebook_url: facebook_url.trim(),
      developer: developer?.trim() || null,
      ai_instruction: ai_instruction?.trim() || null,
      status: 'active',
      total_posts: 0,
    })
    .select(GROUP_SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

async function handleBulkCreate(
  adminClient: ReturnType<typeof getAdminClient>,
  urls: string[],
  developer: string | null
) {
  if (urls.length === 0) {
    return NextResponse.json({ error: 'Lista URL-ow jest pusta' }, { status: 400 });
  }
  if (urls.length > 100) {
    return NextResponse.json({ error: 'Maksymalnie 100 URL-ow na raz' }, { status: 400 });
  }

  const errors: { line: number; url: string; reason: string }[] = [];
  const validRecords: { name: string; facebook_url: string; developer: string | null; status: string; total_posts: number }[] = [];

  // Pobierz istniejace URL-e zeby wykryc duplikaty
  const { data: existing } = await adminClient
    .from('fb_groups')
    .select('facebook_url')
    .is('deleted_at', null);

  const existingUrls = new Set((existing || []).map((r) => r.facebook_url));

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();

    if (!url) {
      errors.push({ line: i + 1, url, reason: 'Pusty URL' });
      continue;
    }

    if (!isValidFbGroupUrl(url)) {
      errors.push({ line: i + 1, url, reason: 'Nieprawidlowy URL grupy Facebook' });
      continue;
    }

    if (existingUrls.has(url)) {
      errors.push({ line: i + 1, url, reason: 'Grupa o tym URL juz istnieje' });
      continue;
    }

    // Sprawdz duplikaty wewnatrz biezacego batcha
    if (validRecords.some((r) => r.facebook_url === url)) {
      errors.push({ line: i + 1, url, reason: 'Zduplikowany URL w liscie' });
      continue;
    }

    validRecords.push({
      name: extractGroupName(url),
      facebook_url: url,
      developer: developer?.trim() || null,
      status: 'active',
      total_posts: 0,
    });
  }

  let created = 0;

  if (validRecords.length > 0) {
    const { error } = await adminClient.from('fb_groups').insert(validRecords);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    created = validRecords.length;
  }

  return NextResponse.json({ created, errors }, { status: 201 });
}
