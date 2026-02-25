import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import {
  startActorRun,
  getRunStatus,
  getDatasetItems,
  mapApifyStatusToAction,
  formatApifyDate,
} from '@/lib/fb/apify-client';
import { SCRAPE_ERROR_MESSAGES } from '@/types/fb';
import type { ApifyCookieObject, ApifyActorInput } from '@/types/fb';

// Vercel function timeout — 60s max
export const maxDuration = 60;

// Polling config for health check
const MAX_WAIT_MS = 45_000; // 45s — Vercel limit 60s, 15s buffer
const POLL_MS = 3_000;      // 3s between polls

// Default Apify Actor
const DEFAULT_ACTOR_ID = 'curious_coder/facebook-post-scraper';

/**
 * POST /api/fb/scrape/check-cookies — Lightweight pre-scrape cookie health check.
 *
 * Uruchamia minimalny Apify Actor run (scrapeUntil: today) i czeka na wynik.
 * Jeśli aktor zwróci >0 postów, cookies są ważne.
 * Jeśli 0 postów lub błąd, cookies prawdopodobnie wygasły.
 *
 * Body: { groupId: string }
 * Returns: { success: boolean, postsFound: number, error?: string }
 */
export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { groupId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Nieprawidłowy format danych' },
      { status: 400 }
    );
  }

  const { groupId } = body;

  if (!groupId) {
    return NextResponse.json(
      { error: 'groupId jest wymagany' },
      { status: 400 }
    );
  }

  // 1. Pobierz grupe
  const { data: group, error: groupError } = await adminClient
    .from('fb_groups')
    .select('id, facebook_url, cookies_encrypted, apify_actor_id')
    .eq('id', groupId)
    .is('deleted_at', null)
    .single();

  if (groupError || !group) {
    return NextResponse.json(
      { error: 'Grupa nie istnieje lub zostala usunieta' },
      { status: 404 }
    );
  }

  // 2. Zaladuj konfiguracje (token, cookies, actorId)
  const { data: settings } = await adminClient
    .from('fb_settings')
    .select('key, value_encrypted, value_plain')
    .in('key', ['apify_token', 'fb_cookies', 'apify_actor_id']);

  const settingsMap = new Map<string, { value_encrypted: string | null; value_plain: string | null }>();
  for (const s of (settings || []) as { key: string; value_encrypted: string | null; value_plain: string | null }[]) {
    settingsMap.set(s.key, { value_encrypted: s.value_encrypted, value_plain: s.value_plain });
  }

  // Token Apify
  const tokenRecord = settingsMap.get('apify_token');
  if (!tokenRecord?.value_encrypted) {
    return NextResponse.json(
      { error: SCRAPE_ERROR_MESSAGES['NO_TOKEN'].message, suggestion: SCRAPE_ERROR_MESSAGES['NO_TOKEN'].suggestion },
      { status: 400 }
    );
  }
  const token = decrypt(tokenRecord.value_encrypted);

  // Cookies — per-group override LUB globalne
  let cookies: ApifyCookieObject[];
  if (group.cookies_encrypted) {
    const decryptedCookies = decrypt(group.cookies_encrypted as string);
    cookies = JSON.parse(decryptedCookies) as ApifyCookieObject[];
  } else {
    const cookiesRecord = settingsMap.get('fb_cookies');
    if (!cookiesRecord?.value_encrypted) {
      return NextResponse.json(
        { error: SCRAPE_ERROR_MESSAGES['NO_COOKIES'].message, suggestion: SCRAPE_ERROR_MESSAGES['NO_COOKIES'].suggestion },
        { status: 400 }
      );
    }
    const decryptedCookies = decrypt(cookiesRecord.value_encrypted);
    cookies = JSON.parse(decryptedCookies) as ApifyCookieObject[];
  }

  // Actor ID
  const actorId =
    (group.apify_actor_id as string) ||
    settingsMap.get('apify_actor_id')?.value_plain ||
    DEFAULT_ACTOR_ID;

  // 3. Buduj minimalny input — scrapeUntil: today (najlzejszy mozliwy run)
  const input: ApifyActorInput = {
    cookie: cookies,
    'scrapeGroupPosts.groupUrl': group.facebook_url as string,
    scrapeUntil: formatApifyDate(new Date()), // today — minimal window
    sortType: 'new_posts',
    minDelay: 1,
    maxDelay: 2,
    proxy: { useApifyProxy: true },
  };

  try {
    // 4. Start minimalny Apify Actor run
    const { runId, datasetId } = await startActorRun(token, actorId, input);

    // 5. Poll do zakonczenia
    const start = Date.now();
    let finalDatasetId = datasetId;

    while (Date.now() - start < MAX_WAIT_MS) {
      const runStatus = await getRunStatus(token, runId);
      const action = mapApifyStatusToAction(runStatus.status);

      if (action === 'fetch_results') {
        // Uzyj datasetId z runStatus (moze byc bardziej aktualny)
        finalDatasetId = runStatus.defaultDatasetId || finalDatasetId;
        break;
      }

      if (action === 'mark_failed') {
        return NextResponse.json({
          success: false,
          postsFound: 0,
          error: `Actor run zakonczony: ${runStatus.status}`,
        });
      }

      // keep_polling — czekaj
      await new Promise(r => setTimeout(r, POLL_MS));
    }

    // Sprawdz timeout
    if (Date.now() - start >= MAX_WAIT_MS) {
      return NextResponse.json({
        success: false,
        postsFound: 0,
        error: 'Health check timeout — sprawdzanie cookies trwalo zbyt dlugo',
      });
    }

    // 6. Pobierz wyniki — tylko total count (limit: 1)
    const { total } = await getDatasetItems(token, finalDatasetId, 0, 1);

    return NextResponse.json({
      success: true,
      postsFound: total,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Cookie health check error:', msg);

    return NextResponse.json({
      success: false,
      postsFound: 0,
      error: msg,
    });
  }
}
