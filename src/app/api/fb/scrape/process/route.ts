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
import { mapApifyPostToFbPost, logRawPostSample } from '@/lib/fb/post-mapper';
import type { MappedFbPost } from '@/lib/fb/post-mapper';
import {
  SCRAPE_ERROR_MESSAGES,
} from '@/types/fb';
import type {
  ApifyCookieObject,
  ApifyActorInput,
  FbScrapeStatus,
} from '@/types/fb';

// Vercel function timeout — max 60s
export const maxDuration = 60;

// Safety timeout: stop before Vercel hard limit (60s - 10s buffer)
const SAFETY_TIMEOUT_MS = 50_000;

// Paginacja datasetu Apify
const DATASET_PAGE_SIZE = 200;

// Batch size dla upsert do Supabase
const UPSERT_BATCH_SIZE = 100;

// Domyslny Apify Actor
const DEFAULT_ACTOR_ID = 'curious_coder/facebook-post-scraper';

/**
 * POST /api/fb/scrape/process — Serce scraping pipeline.
 *
 * Wolany cyklicznie przez hook kliencki (co 5s).
 * Operuje w 3 trybach na podstawie statusu joba:
 *
 * MODE 1 (pending):     Start Apify Actor run
 * MODE 2 (running):     Poll Apify run status
 * MODE 3 (downloading): Fetch dataset + upsert posts
 */
export async function POST(request: Request) {
  const batchStartTime = Date.now();

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Nieprawidlowy format danych' },
      { status: 400 }
    );
  }

  const { jobId } = body;

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId jest wymagany' },
      { status: 400 }
    );
  }

  // Pobierz job
  const { data: job, error: jobError } = await adminClient
    .from('fb_scrape_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: 'Zadanie scrapowania nie zostalo znalezione' },
      { status: 404 }
    );
  }

  // Walidacja statusu
  const allowedStatuses: FbScrapeStatus[] = ['pending', 'running', 'downloading'];
  if (!allowedStatuses.includes(job.status)) {
    return NextResponse.json(
      { error: `Zadanie ma status '${job.status}' — nie mozna kontynuowac` },
      { status: 400 }
    );
  }

  // Pobierz grupe
  const { data: group, error: groupError } = await adminClient
    .from('fb_groups')
    .select('id, facebook_url, cookies_encrypted, apify_actor_id')
    .eq('id', job.group_id)
    .single();

  if (groupError || !group) {
    await failJob(adminClient, jobId, 'Grupa powiazana z zadaniem nie istnieje');
    return NextResponse.json(
      { error: 'Grupa powiazana z zadaniem nie istnieje' },
      { status: 404 }
    );
  }

  try {
    // =====================================================================
    // MODE 1: Start Apify run (job.status === 'pending')
    // =====================================================================
    if (job.status === 'pending' && !job.apify_run_id) {
      const config = await loadScrapeConfig(adminClient, group);

      // Buduj actor input — 30 dni wstecz domyslnie
      const scrapeUntil = formatApifyDate(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      const input: ApifyActorInput = {
        cookie: config.cookies,
        'scrapeGroupPosts.groupUrl': config.groupUrl,
        scrapeUntil,
        sortType: 'new_posts',
        minDelay: 3,
        maxDelay: 10,
        proxy: { useApifyProxy: true },
      };

      const result = await startActorRun(config.token, config.actorId, input);

      // Zapisz runId — datasetId pobierzemy z getRunStatus() w MODE 2/3
      await adminClient
        .from('fb_scrape_jobs')
        .update({
          status: 'running',
          apify_run_id: result.runId,
        })
        .eq('id', jobId);

      return NextResponse.json({
        status: 'running',
        mode: 'started',
        hasMore: true,
      });
    }

    // =====================================================================
    // MODE 2: Poll Apify run status (job.status === 'running')
    // =====================================================================
    if (job.status === 'running') {
      const runId = job.apify_run_id;
      if (!runId) {
        await failJob(adminClient, jobId, 'Brak apify_run_id — nieprawidlowy stan joba');
        return NextResponse.json(
          { error: 'Brak apify_run_id — nieprawidlowy stan joba', status: 'failed' },
          { status: 500 }
        );
      }

      const token = await loadToken(adminClient);
      const runStatus = await getRunStatus(token, runId);
      const action = mapApifyStatusToAction(runStatus.status);

      if (action === 'keep_polling') {
        return NextResponse.json({
          status: 'running',
          mode: 'polling',
          apifyStatus: runStatus.status,
          statusMessage: runStatus.statusMessage,
          hasMore: true,
        });
      }

      if (action === 'mark_failed') {
        const errorMsg = `Apify run zakonczony: ${runStatus.status} — ${runStatus.statusMessage || ''}`;
        await failJob(adminClient, jobId, errorMsg);

        // Uzyj SCRAPE_ERROR_MESSAGES jesli mamy odpowiedni klucz
        const errorInfo = SCRAPE_ERROR_MESSAGES[runStatus.status] || {
          message: runStatus.statusMessage || 'Nieznany blad Apify',
          suggestion: 'Sprawdz logi Apify.',
        };

        return NextResponse.json({
          status: 'failed',
          error: errorInfo.message,
          suggestion: errorInfo.suggestion,
        });
      }

      // action === 'fetch_results' (SUCCEEDED)
      if (runStatus.statusMessage && !runStatus.statusMessage.includes('Finished')) {
        console.warn(
          'Apify run SUCCEEDED but statusMessage unexpected:',
          runStatus.statusMessage
        );
      }

      // Zaktualizuj job na 'downloading'
      await adminClient
        .from('fb_scrape_jobs')
        .update({ status: 'downloading' })
        .eq('id', jobId);

      return NextResponse.json({
        status: 'downloading',
        mode: 'ready_to_fetch',
        datasetId: runStatus.defaultDatasetId,
        hasMore: true,
      });
    }

    // =====================================================================
    // MODE 3: Fetch dataset + upsert (job.status === 'downloading')
    // =====================================================================
    if (job.status === 'downloading') {
      const runId = job.apify_run_id;
      if (!runId) {
        await failJob(adminClient, jobId, 'Brak apify_run_id — nieprawidlowy stan joba');
        return NextResponse.json(
          { error: 'Brak apify_run_id', status: 'failed' },
          { status: 500 }
        );
      }

      const token = await loadToken(adminClient);

      // Pobierz datasetId z run status
      const runStatus = await getRunStatus(token, runId);
      const datasetId = runStatus.defaultDatasetId;

      if (!datasetId) {
        await failJob(adminClient, jobId, 'Brak datasetId w odpowiedzi Apify');
        return NextResponse.json(
          { error: 'Brak datasetId w odpowiedzi Apify', status: 'failed' },
          { status: 500 }
        );
      }

      // Pobierz dataset items z paginacja (posts_found jako offset)
      const offset = job.posts_found || 0;
      const { items, total } = await getDatasetItems<Record<string, unknown>>(
        token,
        datasetId,
        offset,
        DATASET_PAGE_SIZE
      );

      // Loguj probke z pierwszego batcha
      if (offset === 0 && items.length > 0) {
        logRawPostSample(items, 5);
      }

      // Mapuj items na MappedFbPost
      const mappedPosts: MappedFbPost[] = items.map((item) =>
        mapApifyPostToFbPost(item, job.group_id)
      );

      // Pobierz istniejace facebook_post_id dla tej grupy (do zliczenia new vs updated)
      const mappedPostIds = mappedPosts.map((p) => p.facebook_post_id);
      const { data: existingPosts } = await adminClient
        .from('fb_posts')
        .select('facebook_post_id')
        .eq('group_id', job.group_id)
        .in('facebook_post_id', mappedPostIds);

      const existingIds = new Set(
        (existingPosts || []).map((p: { facebook_post_id: string }) => p.facebook_post_id)
      );

      let batchPostsNew = 0;
      let batchPostsUpdated = 0;

      // Upsert w batchach
      for (let i = 0; i < mappedPosts.length; i += UPSERT_BATCH_SIZE) {
        // Safety timeout check
        if (Date.now() - batchStartTime > SAFETY_TIMEOUT_MS) {
          // Zapisz progress dotychczasowy
          const processedSoFar = i;
          await adminClient
            .from('fb_scrape_jobs')
            .update({
              posts_found: offset + processedSoFar,
              posts_new: (job.posts_new || 0) + batchPostsNew,
              posts_updated: (job.posts_updated || 0) + batchPostsUpdated,
            })
            .eq('id', jobId);

          return NextResponse.json({
            status: 'downloading',
            mode: 'upserting',
            hasMore: true,
            postsFound: offset + processedSoFar,
            postsNew: (job.posts_new || 0) + batchPostsNew,
            postsUpdated: (job.posts_updated || 0) + batchPostsUpdated,
            total,
            message: 'Limit czasu — kontynuuj nastepnym batchem',
          });
        }

        const batch = mappedPosts.slice(i, i + UPSERT_BATCH_SIZE);

        // Zlicz new vs updated dla tego batcha
        for (const post of batch) {
          if (existingIds.has(post.facebook_post_id)) {
            batchPostsUpdated++;
          } else {
            batchPostsNew++;
          }
        }

        const { error: upsertError } = await adminClient
          .from('fb_posts')
          .upsert(batch as unknown as Record<string, unknown>[], {
            onConflict: 'group_id,facebook_post_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          // Nie failujemy calego joba na jednym batchu — logujemy i kontynuujemy
        }
      }

      // Zaktualizuj progress po wszystkich batchach
      const newPostsFound = offset + items.length;
      const totalPostsNew = (job.posts_new || 0) + batchPostsNew;
      const totalPostsUpdated = (job.posts_updated || 0) + batchPostsUpdated;

      // Czy sa jeszcze dane do pobrania?
      const hasMoreData = total > newPostsFound;

      if (hasMoreData) {
        // Wiecej danych — zapisz progress i kontynuuj
        await adminClient
          .from('fb_scrape_jobs')
          .update({
            posts_found: newPostsFound,
            posts_new: totalPostsNew,
            posts_updated: totalPostsUpdated,
          })
          .eq('id', jobId);

        return NextResponse.json({
          status: 'downloading',
          mode: 'upserting',
          hasMore: true,
          postsFound: newPostsFound,
          postsNew: totalPostsNew,
          postsUpdated: totalPostsUpdated,
          total,
        });
      }

      // Wszystko pobrane — finalizuj

      // Policz calkowita liczbe postow dla tej grupy
      const { count: totalGroupPosts } = await adminClient
        .from('fb_posts')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', job.group_id);

      // Zaktualizuj fb_groups
      await adminClient
        .from('fb_groups')
        .update({
          last_scraped_at: new Date().toISOString(),
          total_posts: totalGroupPosts ?? 0,
        })
        .eq('id', job.group_id);

      // Zaktualizuj job jako completed
      await adminClient
        .from('fb_scrape_jobs')
        .update({
          status: 'completed',
          posts_found: newPostsFound,
          posts_new: totalPostsNew,
          posts_updated: totalPostsUpdated,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return NextResponse.json({
        status: 'completed',
        postsFound: newPostsFound,
        postsNew: totalPostsNew,
        postsUpdated: totalPostsUpdated,
        total,
      });
    }

    // Fallback — nie powinno dojsc tutaj
    return NextResponse.json(
      { error: 'Nieobsluzony stan joba', status: job.status },
      { status: 400 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Scrape process error:', msg);

    await failJob(adminClient, jobId, msg);

    return NextResponse.json(
      { error: msg, status: 'failed' },
      { status: 500 }
    );
  }
}

// =====================================================================
// Helper: failJob
// =====================================================================

async function failJob(
  adminClient: ReturnType<typeof getAdminClient>,
  jobId: string,
  errorMessage: string
): Promise<void> {
  await adminClient
    .from('fb_scrape_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

// =====================================================================
// Helper: loadScrapeConfig
// =====================================================================

interface ScrapeConfigResult {
  token: string;
  cookies: ApifyCookieObject[];
  actorId: string;
  groupUrl: string;
}

async function loadScrapeConfig(
  adminClient: ReturnType<typeof getAdminClient>,
  group: { id: string; facebook_url: string; cookies_encrypted: string | null; apify_actor_id: string }
): Promise<ScrapeConfigResult> {
  // Pobierz wszystkie potrzebne ustawienia
  const { data: settings } = await adminClient
    .from('fb_settings')
    .select('key, value_encrypted, value_plain')
    .in('key', ['apify_token', 'fb_cookies', 'apify_actor_id']);

  const settingsMap = new Map<string, { value_encrypted: string | null; value_plain: string | null }>();
  for (const s of (settings || []) as { key: string; value_encrypted: string | null; value_plain: string | null }[]) {
    settingsMap.set(s.key, { value_encrypted: s.value_encrypted, value_plain: s.value_plain });
  }

  // 1. Token Apify (zawsze z fb_settings, zaszyfrowany)
  const tokenRecord = settingsMap.get('apify_token');
  if (!tokenRecord?.value_encrypted) {
    throw new Error('Brak skonfigurowanego tokenu Apify');
  }
  const token = decrypt(tokenRecord.value_encrypted);

  // 2. Cookies — per-group override LUB globalne
  let cookies: ApifyCookieObject[];
  if (group.cookies_encrypted) {
    // Per-group override
    const decryptedCookies = decrypt(group.cookies_encrypted);
    cookies = JSON.parse(decryptedCookies) as ApifyCookieObject[];
  } else {
    // Globalne z fb_settings
    const cookiesRecord = settingsMap.get('fb_cookies');
    if (!cookiesRecord?.value_encrypted) {
      throw new Error('Brak skonfigurowanych cookies Facebook');
    }
    const decryptedCookies = decrypt(cookiesRecord.value_encrypted);
    cookies = JSON.parse(decryptedCookies) as ApifyCookieObject[];
  }

  // 3. Actor ID — per-group || global setting || default
  const actorId =
    group.apify_actor_id ||
    settingsMap.get('apify_actor_id')?.value_plain ||
    DEFAULT_ACTOR_ID;

  // 4. Group URL
  const groupUrl = group.facebook_url;

  return { token, cookies, actorId, groupUrl };
}

// =====================================================================
// Helper: loadToken (dla MODE 2/3 — token only, bez cookies)
// =====================================================================

async function loadToken(
  adminClient: ReturnType<typeof getAdminClient>
): Promise<string> {
  const { data } = await adminClient
    .from('fb_settings')
    .select('value_encrypted')
    .eq('key', 'apify_token')
    .single();

  if (!data?.value_encrypted) {
    throw new Error('Brak skonfigurowanego tokenu Apify');
  }

  return decrypt(data.value_encrypted);
}

