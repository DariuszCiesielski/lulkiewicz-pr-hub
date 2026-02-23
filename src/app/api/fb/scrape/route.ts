import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { SCRAPE_ERROR_MESSAGES } from '@/types/fb';

// Vercel function timeout
export const maxDuration = 30;

/**
 * POST /api/fb/scrape — Tworzy nowe zadanie scrapowania dla grupy FB.
 *
 * Body: { groupId: string, scrapeUntilDays?: number }
 * Returns: { jobId: string, status: 'pending', groupName: string }
 *
 * Pre-flight validation:
 * - Grupa istnieje i jest aktywna
 * - Brak aktywnego joba dla tej grupy (409)
 * - Apify token skonfigurowany
 * - FB cookies dostepne (globalne lub per-group)
 */
export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { groupId?: string; scrapeUntilDays?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Nieprawidlowy format danych' },
      { status: 400 }
    );
  }

  const { groupId, scrapeUntilDays = 30 } = body;

  if (!groupId) {
    return NextResponse.json(
      { error: 'groupId jest wymagany' },
      { status: 400 }
    );
  }

  // 1. Sprawdz grupe — musi istniec, byc aktywna, nie soft-deleted
  const { data: group, error: groupError } = await adminClient
    .from('fb_groups')
    .select('id, name, status, deleted_at, cookies_encrypted')
    .eq('id', groupId)
    .is('deleted_at', null)
    .single();

  if (groupError || !group) {
    return NextResponse.json(
      { error: 'Grupa nie istnieje lub jest nieaktywna' },
      { status: 404 }
    );
  }

  if (group.status !== 'active') {
    return NextResponse.json(
      { error: 'Grupa nie istnieje lub jest nieaktywna' },
      { status: 404 }
    );
  }

  // 2. Sprawdz aktywne joby — blokada duplikatow
  const { data: activeJobs } = await adminClient
    .from('fb_scrape_jobs')
    .select('id, status')
    .eq('group_id', groupId)
    .in('status', ['pending', 'running', 'downloading']);

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json(
      { error: 'Scrapowanie juz trwa dla tej grupy' },
      { status: 409 }
    );
  }

  // 3. Pre-flight: sprawdz konfiguracje
  const { data: settings } = await adminClient
    .from('fb_settings')
    .select('key, value_encrypted')
    .in('key', ['apify_token', 'fb_cookies']);

  const settingsMap = new Map(
    (settings || []).map((s: { key: string; value_encrypted: string | null }) => [s.key, s.value_encrypted])
  );

  // Token Apify wymagany
  if (!settingsMap.get('apify_token')) {
    return NextResponse.json(
      { error: SCRAPE_ERROR_MESSAGES['NO_TOKEN'].message, suggestion: SCRAPE_ERROR_MESSAGES['NO_TOKEN'].suggestion },
      { status: 400 }
    );
  }

  // Cookies: globalne LUB per-group
  if (!settingsMap.get('fb_cookies') && !group.cookies_encrypted) {
    return NextResponse.json(
      { error: SCRAPE_ERROR_MESSAGES['NO_COOKIES'].message, suggestion: SCRAPE_ERROR_MESSAGES['NO_COOKIES'].suggestion },
      { status: 400 }
    );
  }

  // 4. Utworz job
  const { data: job, error: jobError } = await adminClient
    .from('fb_scrape_jobs')
    .insert({
      group_id: groupId,
      status: 'pending',
      started_at: new Date().toISOString(),
      posts_found: 0,
      posts_new: 0,
      posts_updated: 0,
    })
    .select('id, status')
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: `Blad tworzenia zadania scrapowania: ${jobError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    status: 'pending',
    groupName: group.name,
    scrapeUntilDays,
  });
}
