# Phase 9: Scraping Engine - Research

**Researched:** 2026-02-23
**Domain:** Apify Actor API integration, polling-based scraping, FB account protection, Vercel serverless
**Confidence:** HIGH (Apify API verified with official docs, codebase patterns verified from source)

## Summary

Phase 9 implements the core scraping pipeline: triggering Apify Actor runs, polling their status, fetching results, and upserting posts into the database. The architecture is a two-phase polling pattern (start run -> poll status -> fetch dataset -> upsert) that adapts the existing `useSyncJob` / `sync/process` pattern for asynchronous external jobs.

Research confirmed all Apify API v2 endpoints, authentication method (Bearer token in Authorization header), response formats, and dataset retrieval approach. The N8N workflow provided exact cookie format (7 cookie objects with full browser metadata) and actor input structure. The existing codebase provides a complete template for the polling hook and server-side batch processing.

**Primary recommendation:** Implement a 3-route API (`/api/fb/scrape`, `/api/fb/scrape/process`, `/api/fb/scrape/status/[jobId]`) with `useScrapeJob` hook. The `/process` route operates in 3 modes: (1) start Apify run, (2) poll run status, (3) fetch dataset and upsert. Rate limiting between groups is handled client-side in the hook with configurable delay (180-360s).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch()` | Node.js 22 built-in | Apify REST API calls (3 endpoints) | Zero deps, matches existing Graph API pattern |
| `encrypt.ts` (existing) | AES-256-GCM | Decrypt Apify token + FB cookies from `fb_settings` | Already proven, same pattern as email credentials |
| `admin.ts` (existing) | -- | `verifyAdmin()` + `getAdminClient()` | Shared admin module from Phase 7 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase JS (existing) | `@supabase/supabase-js` | DB operations: upsert posts, update jobs | All DB interactions via `getAdminClient()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch()` | `apify-client` npm | 12 deps, 2.8 MB for 3 API calls. NOT worth it. |
| Client-side rate limiting | Server-side queue (Bull, etc.) | Over-engineering for 1-5 groups. Future consideration. |

**Installation:**
```bash
# ZERO new npm packages. Everything uses existing dependencies.
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/api/fb/
    scrape/
      route.ts              # POST: create scrape job + start Apify run
      process/
        route.ts            # POST: poll status / fetch results / upsert
      status/[jobId]/
        route.ts            # GET: read job status (optional, for recovery)
  hooks/
    useScrapeJob.ts         # Client-side polling hook (pattern: useSyncJob)
  lib/fb/
    apify-client.ts         # 3 functions: startActorRun, getRunStatus, getDatasetItems
    post-mapper.ts          # mapApifyPostToFbPost() + mapApifyPostToFbComment()
  components/fb/
    ScrapeProgress.tsx      # Progress bar + status display
    ScrapeButton.tsx        # Trigger button with cookie health check
```

### Pattern 1: Two-Phase Polling Architecture

**What:** Scraping uses a 3-mode `/process` endpoint called repeatedly by the client hook.
**When to use:** Always -- this is the core scraping pattern.

```
UI: Click "Scrapuj"
  |
  v
POST /api/fb/scrape { groupId }
  - verifyAdmin()
  - Check no active scrape job for this group
  - Create fb_scrape_jobs row (status: 'pending')
  - Return { jobId }
  |
  v
useScrapeJob starts polling loop (every 5s)
  |
  v
POST /api/fb/scrape/process { jobId }
  MODE 1 (no apify_run_id): Start Apify Actor run
    - Decrypt token + cookies from fb_settings
    - Call startActorRun()
    - Save apify_run_id to job
    - Return { status: 'running', hasMore: true }
  MODE 2 (apify_run_id, run not finished): Poll status
    - Call getRunStatus()
    - If RUNNING/READY -> Return { status: 'running', hasMore: true }
    - If FAILED/TIMED-OUT -> Mark job failed, return error
  MODE 3 (run SUCCEEDED): Fetch + upsert
    - Call getDatasetItems()
    - Map to fb_posts/fb_comments via post-mapper.ts
    - Upsert with ON CONFLICT (group_id, facebook_post_id)
    - Update fb_groups.last_scraped_at, total_posts
    - Return { status: 'completed', postsFound, postsNew, postsUpdated }
```

### Pattern 2: useScrapeJob Hook (adapted from useSyncJob)

**What:** Client-side hook managing scrape lifecycle, including multi-group queue.
**When to use:** Any component that triggers scraping.

Key differences from `useSyncJob`:
1. **Polling interval: 5000ms** (not 500ms) -- Apify runs take minutes, not seconds
2. **Status mapping**: `idle -> starting -> cookie_check -> running -> downloading -> completed/error`
3. **Multi-group queue**: When scraping multiple groups, enforce 180-360s delay between groups
4. **Cookie health check**: Optional pre-scrape validation (maxPosts: 1 test run)

```typescript
// Conceptual hook interface
export type ScrapeUIStatus =
  'idle' | 'starting' | 'cookie_check' | 'running' | 'downloading' | 'completed' | 'error';

export interface ScrapeProgress {
  currentGroup: string | null;
  groupsTotal: number;
  groupsCompleted: number;
  postsFound: number;
  postsNew: number;
  postsUpdated: number;
  apifyStatus: string | null;  // READY, RUNNING, SUCCEEDED, etc.
  estimatedWaitSeconds: number | null;  // for queue delay display
}

export interface UseScrapeJobReturn {
  startScrape: (groupId: string) => Promise<void>;
  startBulkScrape: (groupIds: string[]) => Promise<void>;
  status: ScrapeUIStatus;
  progress: ScrapeProgress;
  error: string | null;
  jobId: string | null;
  reset: () => void;
}
```

### Pattern 3: Apify API Wrapper (apify-client.ts)

**What:** Three-function wrapper for Apify REST API v2.
**When to use:** Only from server-side API routes (token is secret).

```typescript
// Source: https://docs.apify.com/api/v2

const APIFY_BASE = 'https://api.apify.com/v2';

// 1. Start Actor run
// POST /v2/acts/{actorId}/runs
// Auth: Authorization: Bearer {token}
// Body: actor input JSON
// Response: { data: { id, status, defaultDatasetId, statusMessage, ... } }
export async function startActorRun(
  token: string,
  actorId: string,
  input: Record<string, unknown>
): Promise<{ runId: string; datasetId: string }> {
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify start failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return {
    runId: json.data.id,
    datasetId: json.data.defaultDatasetId
  };
}

// 2. Get run status
// GET /v2/actor-runs/{runId}
// Auth: Authorization: Bearer {token}
// Response: { data: { id, status, statusMessage, defaultDatasetId, startedAt, finishedAt } }
export async function getRunStatus(
  token: string,
  runId: string
): Promise<ApifyRunStatus> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Apify status check failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// 3. Get dataset items
// GET /v2/datasets/{datasetId}/items?format=json&limit=1000&offset=0
// Auth: Authorization: Bearer {token}
// Response: JSON ARRAY directly (NOT wrapped in data!)
// Pagination headers: X-Apify-Pagination-Offset, -Limit, -Count, -Total
export async function getDatasetItems<T>(
  token: string,
  datasetId: string,
  offset = 0,
  limit = 1000
): Promise<{ items: T[]; total: number }> {
  const url = `${APIFY_BASE}/datasets/${datasetId}/items?format=json&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);

  const items: T[] = await res.json(); // Direct JSON array!
  const total = parseInt(res.headers.get('X-Apify-Pagination-Total') || '0', 10);
  return { items, total };
}
```

### Pattern 4: Cookie Format for Actor Input

**What:** Exact cookie format verified from N8N workflow.
**Source:** `.n8n/Grupy FB - Pozyskiwanie leadow 2.0.json` (line 113)

The actor expects `cookie` field (NOT `sessionCookies`) as an array of cookie objects with full browser metadata:

```typescript
interface ApifyCookieObject {
  domain: string;         // ".facebook.com"
  expirationDate?: number; // Unix timestamp (optional for session cookies)
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;           // "datr" | "fr" | "xs" | "c_user" | "sb" | "presence" | "wd"
  path: string;           // "/"
  sameSite: string | null; // "no_restriction" | "lax" | null
  secure: boolean;
  session: boolean;
  storeId: string | null;
  value: string;
}

// Actor input format (verified from N8N workflow):
interface ApifyActorInput {
  cookie: ApifyCookieObject[];                    // 7 cookies from Cookie-Editor export
  'scrapeGroupPosts.groupUrl': string;            // NOTE: dot-notation key!
  scrapeUntil: string;                            // "yyyy-M-dd" format (single digit month!)
  sortType: 'new_posts';
  minDelay: number;                               // seconds between page loads
  maxDelay: number;                               // seconds between page loads
  proxy: { useApifyProxy: boolean };
}
```

**CRITICAL FINDINGS from N8N workflow:**
1. Cookie field name is `cookie` (NOT `sessionCookies` or `cookies`)
2. Group URL field uses DOT NOTATION: `scrapeGroupPosts.groupUrl` (NOT nested object)
3. Date format is `yyyy-M-dd` (month WITHOUT leading zero, e.g., "2026-2-23")
4. 7 cookies needed: `datr`, `fr`, `xs`, `c_user`, `presence`, `sb`, `wd`
5. Delay values are in SECONDS (N8N uses minDelay: 1, maxDelay: 15)
6. Success is checked by `statusMessage` containing "Finished scraping"

### Pattern 5: Actor Output Fields (from N8N workflow)

**What:** Fields returned by the actor in the dataset.
**Confidence:** MEDIUM -- confirmed from N8N workflow mapping: `createdAt`, `url`, `text`. Other fields need verification from test run.

```typescript
// Confirmed output fields (from N8N Airtable mapping):
interface ApifyFbPostOutput {
  createdAt: string;    // Timestamp (N8N converts with .toDateTime('s'))
  url: string;          // Post URL (used as dedup key in N8N)
  text: string;         // Post content
  // Fields likely present but NOT confirmed (need test run):
  // authorName?: string;
  // likes?: number;
  // comments?: number;
  // shares?: number;
  // images?: string[];
  // commentsList?: Array<{...}>;
}
```

**IMPORTANT:** The N8N workflow only uses `createdAt`, `url`, and `text`. Additional fields (author, reactions, comments) must be verified with a test Apify run. The `post-mapper.ts` should handle missing fields gracefully with defaults.

### Pattern 6: Settings Retrieval for Scraping

**What:** How to get Apify token, cookies, and actor ID from `fb_settings`.

```typescript
// Server-side helper to load scraping config
async function loadScrapeConfig(
  adminClient: ReturnType<typeof getAdminClient>,
  groupId: string
): Promise<ScrapeConfig> {
  // 1. Load global settings from fb_settings
  const { data: settings } = await adminClient
    .from('fb_settings')
    .select('key, value_encrypted, value_plain')
    .in('key', ['apify_token', 'fb_cookies', 'apify_actor_id']);

  const tokenRecord = settings?.find(s => s.key === 'apify_token');
  const cookiesRecord = settings?.find(s => s.key === 'fb_cookies');
  const actorRecord = settings?.find(s => s.key === 'apify_actor_id');

  if (!tokenRecord?.value_encrypted) {
    throw new Error('Apify token nie jest skonfigurowany. Przejdz do Ustawien.');
  }

  // 2. Decrypt token
  const token = decrypt(tokenRecord.value_encrypted);

  // 3. Get cookies -- per-group override or global
  const { data: group } = await adminClient
    .from('fb_groups')
    .select('cookies_encrypted, facebook_url, apify_actor_id')
    .eq('id', groupId)
    .single();

  let cookies: ApifyCookieObject[];
  if (group?.cookies_encrypted) {
    cookies = JSON.parse(decrypt(group.cookies_encrypted));
  } else if (cookiesRecord?.value_encrypted) {
    cookies = JSON.parse(decrypt(cookiesRecord.value_encrypted));
  } else {
    throw new Error('Facebook cookies nie sa skonfigurowane. Przejdz do Ustawien.');
  }

  const actorId = group?.apify_actor_id
    || actorRecord?.value_plain
    || 'curious_coder/facebook-post-scraper';

  return { token, cookies, actorId, groupUrl: group!.facebook_url };
}
```

### Anti-Patterns to Avoid

- **Waiting for Apify run in a single request:** Actor runs take 1-15 minutes. NEVER block a Vercel function waiting for completion. Use the polling pattern.
- **Scraping multiple groups in parallel:** This triggers Facebook anti-automation detection. ALWAYS sequential with 180-360s delays.
- **Storing decrypted tokens/cookies in memory beyond request scope:** Decrypt per-request, never cache in module-level variables.
- **Using `?token=` query parameter for Apify auth:** Use `Authorization: Bearer` header. Query params appear in logs.
- **Assuming actor output field names:** Map through `post-mapper.ts` with fallbacks, don't access raw fields directly in route handlers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Apify API integration | Generic HTTP client wrapper | `apify-client.ts` with 3 typed functions | Only 3 endpoints needed, keep it simple |
| Post deduplication | Custom hash-based dedup | PostgreSQL `ON CONFLICT (group_id, facebook_post_id) DO UPDATE` | DB constraint is authoritative, no race conditions |
| Cookie encryption | Custom crypto | Existing `encrypt.ts` (AES-256-GCM) | Proven, already handles all edge cases |
| Admin auth | Per-route auth check | `verifyAdmin()` from `@/lib/api/admin` | Shared module, DRY |
| Progress polling | WebSocket / SSE | `useScrapeJob` hook with setTimeout polling | Matches useSyncJob pattern, simpler for Vercel serverless |
| Rate limiting queue | Bull/Redis queue | Client-side setTimeout in hook | Only 1-5 groups, no need for infrastructure |

**Key insight:** The entire scraping pipeline uses patterns already proven in the email sync pipeline. The main adaptation is handling an asynchronous external system (Apify) instead of a synchronous one (Graph API).

## Common Pitfalls

### Pitfall 1: Vercel 60s Timeout on Dataset Fetch

**What goes wrong:** After Apify run completes, fetching 500+ posts and upserting them in a single request exceeds 60s.
**Why it happens:** Dataset fetch + JSON parse + DB upsert per post adds up.
**How to avoid:**
- Fetch dataset items in pages of 200 (`limit=200&offset=N`)
- Process one page per `/process` call, return `{ hasMore: true }` until all pages done
- Use 50s safety timeout (same as sync/process)
- Batch upserts: send 50-100 posts per Supabase upsert call
**Warning signs:** 504 errors on the final `/process` call (when data is being ingested).

### Pitfall 2: Cookie Field Name Mismatch

**What goes wrong:** Actor receives empty/wrong cookies, returns 0 posts with no error.
**Why it happens:** Different FB scrapers use different field names: `cookie`, `cookies`, `sessionCookies`, `loginCookies`.
**How to avoid:** Use `cookie` (singular, verified from N8N workflow). Use dot-notation for group URL: `scrapeGroupPosts.groupUrl`.
**Warning signs:** Apify run "succeeds" but dataset has 0 items.

### Pitfall 3: scrapeUntil Date Format

**What goes wrong:** Actor scrapes all historical posts or no posts at all.
**Why it happens:** Wrong date format. Actor expects `yyyy-M-dd` (NO leading zero on month).
**How to avoid:** Format as `${year}-${month}-${day}` without padding. From N8N: `$now.format("yyyy-M-dd")`.
**Warning signs:** Unexpectedly large dataset (scraping ALL posts) or empty dataset.

### Pitfall 4: Silent Cookie Expiration

**What goes wrong:** Scrape job "succeeds" with 0 posts because cookies expired.
**Why it happens:** Facebook invalidates sessions after days/weeks. Actor doesn't throw error, just returns empty.
**How to avoid:**
- Pre-scrape cookie health check: run actor with the same cookies but only fetch 1 post
- Post-scrape validation: if `posts_found === 0` for a group that has had posts before, flag as suspicious
- Show cookie status prominently in UI (last successful scrape date)
**Warning signs:** `posts_found: 0` on groups that previously had posts.

### Pitfall 5: Status Field Mismatch Between DB and UI

**What goes wrong:** Job gets stuck in `running` state with no recovery.
**Why it happens:** DB has 5 statuses (`pending`, `running`, `downloading`, `completed`, `failed`) but Apify has 8 (`READY`, `RUNNING`, `SUCCEEDED`, `FAILED`, `TIMING-OUT`, `TIMED-OUT`, `ABORTING`, `ABORTED`). Unmapped Apify statuses leave job in limbo.
**How to avoid:**
- Map ALL Apify statuses explicitly: `TIMING-OUT`/`ABORTING` -> still running (poll again)
- `TIMED-OUT`/`ABORTED` -> failed
- Add stale job cleanup: any job in `running` state for >20 minutes without Apify run update should be marked `failed`
**Warning signs:** Job stuck in `running` status in the UI for >15 minutes.

### Pitfall 6: N8N Success Check Pattern

**What goes wrong:** Treating Apify `SUCCEEDED` status as success without checking `statusMessage`.
**Why it happens:** The actor can finish without errors but produce no useful data.
**How to avoid:** Check `statusMessage` contains "Finished scraping" (from N8N: `$json.statusMessage` contains "Finished scraping"). If `SUCCEEDED` but no "Finished" in message, treat as warning.
**Warning signs:** Run status is `SUCCEEDED` but zero items in dataset.

## Code Examples

### Example 1: POST /api/fb/scrape (Start Scrape Job)

```typescript
// Source: pattern from src/app/api/sync/route.ts

import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const { groupId } = await request.json();

  if (!groupId) {
    return NextResponse.json({ error: 'groupId jest wymagany' }, { status: 400 });
  }

  // Check group exists and is active
  const { data: group } = await adminClient
    .from('fb_groups')
    .select('id, name, status, deleted_at')
    .eq('id', groupId)
    .is('deleted_at', null)
    .single();

  if (!group || group.status !== 'active') {
    return NextResponse.json({ error: 'Grupa nie istnieje lub jest nieaktywna' }, { status: 404 });
  }

  // Check no active scrape job
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

  // Create scrape job
  const { data: job, error: jobError } = await adminClient
    .from('fb_scrape_jobs')
    .insert({
      group_id: groupId,
      status: 'pending',
      started_at: new Date().toISOString(),
    })
    .select('id, status')
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: `Blad tworzenia zadania: ${jobError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobId: job.id, status: 'pending' });
}
```

### Example 2: Upsert Posts with ON CONFLICT

```typescript
// Source: pattern from src/lib/email/email-fetcher.ts (upsertEmails)

async function upsertPosts(
  adminClient: ReturnType<typeof getAdminClient>,
  groupId: string,
  posts: MappedFbPost[]
): Promise<{ postsNew: number; postsUpdated: number }> {
  if (posts.length === 0) return { postsNew: 0, postsUpdated: 0 };

  // Get existing post IDs for this group
  const fbPostIds = posts.map(p => p.facebook_post_id);
  const { data: existing } = await adminClient
    .from('fb_posts')
    .select('facebook_post_id')
    .eq('group_id', groupId)
    .in('facebook_post_id', fbPostIds);

  const existingIds = new Set((existing || []).map(e => e.facebook_post_id));

  // Upsert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const rows = batch.map(post => ({
      group_id: groupId,
      facebook_post_id: post.facebook_post_id,
      author_name: post.author_name || null,
      content: post.content || null,
      posted_at: post.posted_at || null,
      likes_count: post.likes_count ?? 0,
      comments_count: post.comments_count ?? 0,
      shares_count: post.shares_count ?? 0,
      post_url: post.post_url || null,
      media_url: post.media_url || null,
    }));

    await adminClient
      .from('fb_posts')
      .upsert(rows, {
        onConflict: 'group_id,facebook_post_id',
        ignoreDuplicates: false // DO UPDATE -- refresh counts
      });
  }

  const postsNew = posts.filter(p => !existingIds.has(p.facebook_post_id)).length;
  const postsUpdated = posts.length - postsNew;

  return { postsNew, postsUpdated };
}
```

### Example 3: Apify Run Status Mapping

```typescript
// Map Apify run statuses to internal states
type ApifyStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' |
  'TIMING-OUT' | 'TIMED-OUT' | 'ABORTING' | 'ABORTED';

function mapApifyStatusToAction(apifyStatus: ApifyStatus):
  'keep_polling' | 'fetch_results' | 'mark_failed' {
  switch (apifyStatus) {
    case 'READY':
    case 'RUNNING':
    case 'TIMING-OUT':  // Still running, approaching timeout
    case 'ABORTING':    // Being aborted, wait for final state
      return 'keep_polling';
    case 'SUCCEEDED':
      return 'fetch_results';
    case 'FAILED':
    case 'TIMED-OUT':
    case 'ABORTED':
      return 'mark_failed';
  }
}
```

### Example 4: Cookie Health Check

```typescript
// Cookie health check -- run actor with minimal config to verify cookies work
async function checkCookieHealth(
  token: string,
  actorId: string,
  cookies: ApifyCookieObject[],
  groupUrl: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const input = {
      cookie: cookies,
      'scrapeGroupPosts.groupUrl': groupUrl,
      scrapeUntil: formatApifyDate(new Date()), // today
      sortType: 'new_posts',
      minDelay: 1,
      maxDelay: 5,
      proxy: { useApifyProxy: true },
    };

    // Start a minimal test run
    const { runId } = await startActorRun(token, actorId, input);

    // Poll for max 60 seconds
    const startTime = Date.now();
    while (Date.now() - startTime < 60_000) {
      await new Promise(r => setTimeout(r, 5000));
      const status = await getRunStatus(token, runId);

      if (status.status === 'SUCCEEDED') {
        // Check if statusMessage indicates success
        if (status.statusMessage?.includes('Finished scraping')) {
          return { valid: true };
        }
        return { valid: false, error: 'Scrapowanie zakonczone ale bez wynikow -- cookies moga byc wygasle' };
      }
      if (status.status === 'FAILED' || status.status === 'TIMED-OUT' || status.status === 'ABORTED') {
        return { valid: false, error: `Apify run zakonczony statusem: ${status.status}` };
      }
    }
    return { valid: false, error: 'Cookie check przekroczyl timeout 60s' };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Nieznany blad' };
  }
}

// Date formatting for Apify (yyyy-M-dd, NO leading zero on month)
function formatApifyDate(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
```

### Example 5: Error Messages Mapping (Polish)

```typescript
// Map Apify/scraping errors to user-friendly Polish messages
const ERROR_MESSAGES: Record<string, { message: string; suggestion: string }> = {
  'TIMED-OUT': {
    message: 'Scrapowanie przekroczylo limit czasu Apify',
    suggestion: 'Sprobuj ponownie. Jesli blad sie powtarza, zmniejsz zakres dat.',
  },
  'FAILED': {
    message: 'Apify Actor zakonczyl sie bledem',
    suggestion: 'Sprawdz logi w konsoli Apify. Moze byc problem z cookies lub proxy.',
  },
  'ABORTED': {
    message: 'Scrapowanie zostalo przerwane',
    suggestion: 'Run zostal recznie zatrzymany lub przekroczyl limit pamieci.',
  },
  'NO_TOKEN': {
    message: 'Brak skonfigurowanego tokenu Apify',
    suggestion: 'Przejdz do Ustawienia > Apify API Token i wklej swoj token.',
  },
  'NO_COOKIES': {
    message: 'Brak skonfigurowanych cookies Facebook',
    suggestion: 'Przejdz do Ustawienia > Facebook Cookies i wklej cookies z Cookie-Editor.',
  },
  'COOKIES_EXPIRED': {
    message: 'Cookies Facebook prawdopodobnie wygasly',
    suggestion: 'Zaloguj sie na dedykowane konto FB, wyeksportuj nowe cookies z Cookie-Editor i wklej w Ustawienia.',
  },
  'RATE_LIMITED': {
    message: 'Zbyt czeste scrapowanie — odczekaj przed kolejna proba',
    suggestion: 'Poczekaj minimum 3 minuty miedzy scrapowaniami roznych grup.',
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `?token=` query param | `Authorization: Bearer` header | Apify recommends header | More secure, tokens not in logs |
| apify-client npm | Native fetch() | Project decision (Phase 7+) | Zero deps, consistent with Graph API pattern |
| N8N orchestration | Direct Apify API from PR Hub | v1.1 architecture decision | No middleware, simpler deployment |

**Deprecated/outdated:**
- N8N workflow: Still exists as reference but PR Hub calls Apify directly
- `sessionCookies` field name: Some older actors use this, but `curious_coder/facebook-post-scraper` uses `cookie`

## Open Questions

Things that couldn't be fully resolved:

1. **Exact Actor output field names beyond createdAt/url/text**
   - What we know: N8N only maps `createdAt`, `url`, `text`. WebFetch couldn't extract the full schema from the actor page.
   - What's unclear: Exact names for author, reactions, comments, shares, images.
   - Recommendation: `post-mapper.ts` should handle unknown fields gracefully. First test run will reveal the full schema. Log raw output of first 5 items for debugging.

2. **Cookie health check -- is it worth a separate Apify run?**
   - What we know: Test run with maxPosts:1 verifies cookies but costs ~$0.01 and takes ~30-60s.
   - What's unclear: Is there a lighter-weight way to check? (API call to Facebook via Apify without running a full scrape)
   - Recommendation: Implement health check as OPTIONAL (checkbox in UI). Default: skip, just run the scrape. If scrape returns 0 posts, show cookie warning.

3. **Dataset pagination for large groups**
   - What we know: Apify dataset items endpoint supports `limit`+`offset`, no hard max per docs.
   - What's unclear: How many posts a typical group has. If groups have <1000 posts, pagination may be unnecessary.
   - Recommendation: Fetch with `limit=1000` first. If total > 1000 (from X-Apify-Pagination-Total header), paginate in subsequent `/process` calls.

4. **Apify run status vs statusMessage**
   - What we know: N8N checks `statusMessage` contains "Finished scraping" for success.
   - What's unclear: Can status be `SUCCEEDED` but `statusMessage` NOT contain "Finished"? (partial scrape?)
   - Recommendation: Primary check: `status === 'SUCCEEDED'`. Secondary check: log `statusMessage` for debugging. Warn if `SUCCEEDED` but 0 items.

## Sources

### Primary (HIGH confidence)
- [Apify API v2: Run Actor](https://docs.apify.com/api/v2/act-runs-post) -- endpoint format, response structure, status values
- [Apify API v2: Get Run](https://docs.apify.com/api/v2/actor-run-get) -- status polling endpoint, all status values
- [Apify API v2: Get Dataset Items](https://docs.apify.com/api/v2/dataset-items-get) -- response is direct JSON array, pagination params
- [Apify API v2: Getting Started](https://docs.apify.com/api/v2/getting-started) -- Bearer token auth (recommended over ?token=)
- [Apify Academy: Run Actor and Retrieve Data](https://docs.apify.com/academy/api/run-actor-and-retrieve-data-via-api) -- complete 3-step workflow
- Codebase: `src/hooks/useSyncJob.ts` -- polling hook pattern (183 LOC)
- Codebase: `src/app/api/sync/route.ts` -- job creation pattern (119 LOC)
- Codebase: `src/app/api/sync/process/route.ts` -- batch processing pattern (395 LOC)
- Codebase: `src/app/api/fb-settings/route.ts` -- settings retrieval and encryption (149 LOC)
- Codebase: `src/lib/crypto/encrypt.ts` -- AES-256-GCM encrypt/decrypt (87 LOC)
- Codebase: `src/types/fb.ts` -- domain types (129 LOC)
- Codebase: `.n8n/Grupy FB - Pozyskiwanie leadow 2.0.json` -- actor input format, cookie structure, success check

### Secondary (MEDIUM confidence)
- [Apify Store: curious_coder/facebook-post-scraper](https://apify.com/curious_coder/facebook-post-scraper) -- actor exists, confirmed by N8N workflow
- Codebase: `supabase/migrations/20260212_07_01_fb_analyzer.sql` -- fb_scrape_jobs schema
- Codebase: `supabase/migrations/20260212_08_01_fb_groups_settings.sql` -- fb_settings schema
- Codebase: `.planning/research-v1.1/ARCHITECTURE.md` -- architecture patterns

### Tertiary (LOW confidence)
- Actor output field names beyond `createdAt`/`url`/`text` -- only confirmed from N8N mapping, rest from training data
- Cookie expiration timeline (24h-7d) -- from training data, varies

## Metadata

**Confidence breakdown:**
- Apify API endpoints & format: HIGH -- verified with official docs
- Actor input format (cookie, groupUrl, scrapeUntil): HIGH -- verified from N8N workflow JSON
- Actor output format (3 fields): MEDIUM -- only 3 fields confirmed from N8N, rest TBD
- Polling architecture: HIGH -- proven pattern from useSyncJob
- Rate limiting approach: HIGH -- N8N uses 180-360s, matches requirements
- Error handling: MEDIUM -- Apify error types known, Polish messages need UX review
- Cookie health check: MEDIUM -- concept solid, implementation details need refinement

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days -- Apify API is stable, actor may update)
