# Architecture: FB Analyzer Integration into PR Hub

**Project:** Lulkiewicz PR Hub v1.1
**Researched:** 2026-02-12
**Confidence:** HIGH (based on full codebase analysis of existing v1.0 patterns)

---

## 1. Executive Summary

FB Analyzer follows the exact same architectural patterns as Email Analyzer. The existing codebase provides a clear, proven template: polling-driven batch processing, admin-only API routes, CSS Variables design system, and hook-based UI state management. Integration is straightforward because the two modules are **parallel siblings** -- they share infrastructure (auth, AI, encryption, export) but operate on completely separate data domains.

The main architectural decision is: **keep modules fully separate with shared utilities extracted**. This avoids coupling while reducing the already-present code duplication (21 files with copy-pasted `verifyAdmin`/`getAdminClient`).

---

## 2. Integration Architecture Overview

```
src/
  app/
    (hub)/
      email-analyzer/   <-- existing, untouched
      fb-analyzer/      <-- NEW: parallel module
    api/
      sync/             <-- existing email sync
      analysis/         <-- existing email analysis
      reports/          <-- existing email reports
      dashboard/        <-- existing email dashboard
      fb/               <-- NEW: all FB API routes under /api/fb/
        groups/
        posts/
        scrape/
        analysis/
        reports/
        dashboard/
  components/
    email/              <-- existing, untouched
    threads/            <-- existing, untouched
    fb/                 <-- NEW: FB-specific components
  hooks/
    useSyncJob.ts       <-- existing
    useAnalysisJob.ts   <-- existing
    useScrapeJob.ts     <-- NEW (pattern: useSyncJob)
    useFbAnalysisJob.ts <-- NEW (pattern: useAnalysisJob)
  lib/
    ai/                 <-- SHARED: ai-provider.ts, anonymizer.ts
    crypto/             <-- SHARED: encrypt.ts
    export/             <-- SHARED: export-report-docx.ts, markdown-to-docx.ts
    email/              <-- existing, untouched
    fb/                 <-- NEW: apify-client.ts, fb-prompts.ts, fb-report-generator.ts
    api/                <-- NEW (recommended): extracted verifyAdmin, getAdminClient
  types/
    index.ts            <-- MODIFIED: ToolId already has 'fb-analyzer'
    email.ts            <-- existing, untouched
    fb.ts               <-- NEW: FB domain types
  config/
    tools.ts            <-- MODIFIED: fb-analyzer active=true, comingSoon=false
```

---

## 3. Integration Points (Existing Code Modifications)

### 3.1 Modifications Required

| File | Change | Risk |
|------|--------|------|
| `src/config/tools.ts` | Set `fb-analyzer` to `active: true, comingSoon: false` | ZERO -- single boolean flip |
| `src/components/layout/Sidebar.tsx` | Add FB Analyzer to `NAV_ITEMS` with children | LOW -- additive, same pattern as email-analyzer |
| `src/types/index.ts` | Already done -- `'fb-analyzer'` in ToolId union | NONE |

### 3.2 Shared Utilities (Direct Reuse, No Changes)

| Module | Path | Used For |
|--------|------|----------|
| AI Provider | `src/lib/ai/ai-provider.ts` | `callAI()` for sentiment analysis |
| AI Config | `ai_config` table + loadAIConfig() | Same API key, model, temperature |
| Encryption | `src/lib/crypto/encrypt.ts` | Encrypt/decrypt Apify API token |
| DOCX Export | `src/lib/export/export-report-docx.ts` | Export FB reports to .docx |
| Markdown Parser | `src/lib/export/markdown-to-docx.ts` | Convert report markdown to docx |
| Auth Context | `src/contexts/AuthContext.tsx` | `useAuth()` for `isAdmin` checks |
| Theme Context | `src/contexts/ThemeContext.tsx` | CSS Variables, design system |
| Supabase Server | `src/lib/supabase/server.ts` | createClient for API routes |

### 3.3 Recommended Extraction: Admin API Utilities

**Problem:** `verifyAdmin()` and `getAdminClient()` are copy-pasted identically in **21 API route files**. Adding ~11 more FB API routes will make this 32 files with identical code.

**Recommendation:** Extract to `src/lib/api/admin.ts`:

```typescript
// src/lib/api/admin.ts
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function verifyAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const { data } = await getAdminClient()
    .from('app_allowed_users')
    .select('role')
    .eq('email', user.email)
    .single();

  return data?.role === 'admin';
}
```

**Timing:** Do this in Phase 1 (Foundation) of FB Analyzer. Only new FB routes use the extracted utility. Existing email routes can be migrated later (optional, not blocking).

**Confidence:** HIGH -- this is pure refactoring of identical code.

---

## 4. New Components Needed

### 4.1 Pages (App Router)

| Route | Page | Description |
|-------|------|-------------|
| `/fb-analyzer` | `page.tsx` | Redirect to `/fb-analyzer/dashboard` |
| `/fb-analyzer/layout.tsx` | layout | Empty wrapper (same pattern as email-analyzer) |
| `/fb-analyzer/dashboard` | Dashboard | KPI tiles, alerts, recent activity |
| `/fb-analyzer/groups` | Groups | CRUD list of monitored FB groups |
| `/fb-analyzer/posts` | Posts | Filterable list of scraped posts |
| `/fb-analyzer/posts/[id]` | Post Detail | Post + comments + AI analysis |
| `/fb-analyzer/analyze` | AI Analysis | Trigger sentiment analysis (pattern: email analyze page) |
| `/fb-analyzer/reports` | Reports | Report list + generate (pattern: email reports) |
| `/fb-analyzer/reports/[id]` | Report Detail | Markdown preview + DOCX export |
| `/fb-analyzer/settings` | Settings | Apify token config |

### 4.2 API Routes

| Endpoint | Methods | Description | Pattern Source |
|----------|---------|-------------|----------------|
| `/api/fb/groups` | GET, POST | List/create groups | `/api/mailboxes` |
| `/api/fb/groups/[id]` | GET, PUT, DELETE | Group CRUD | `/api/mailboxes/[id]` |
| `/api/fb/posts` | GET | List posts (filters, pagination) | `/api/threads` |
| `/api/fb/posts/[id]` | GET | Post + comments | `/api/threads/[id]` |
| `/api/fb/scrape` | POST | Start scrape job | `/api/sync` |
| `/api/fb/scrape/process` | POST | Process scrape batch | `/api/sync/process` |
| `/api/fb/scrape/status/[jobId]` | GET | Check scrape status | `/api/sync/status/[jobId]` |
| `/api/fb/analysis` | POST | Start analysis job | `/api/analysis` |
| `/api/fb/analysis/process` | POST | Process analysis batch | `/api/analysis/process` |
| `/api/fb/reports` | GET, POST | List/generate reports | `/api/reports` |
| `/api/fb/reports/[id]` | GET, PUT, DELETE | Report CRUD | `/api/reports/[id]` |
| `/api/fb/dashboard` | GET | Aggregated KPI | `/api/dashboard` |

### 4.3 Components (`src/components/fb/`)

| Component | Description | Similar To |
|-----------|-------------|------------|
| `GroupForm.tsx` | Add/edit FB group (URL, name) | `MailboxForm.tsx` |
| `GroupCard.tsx` | Group card with status + actions | ThreadCard pattern |
| `GroupList.tsx` | List of groups | `MailboxList.tsx` |
| `PostCard.tsx` | Post preview with sentiment badge | `ThreadCard.tsx` |
| `PostList.tsx` | Filterable post list | `ThreadList.tsx` |
| `PostFilters.tsx` | Sentiment, date, relevance filters | `ThreadFilters.tsx` |
| `PostDetail.tsx` | Full post view + comments | email detail pattern |
| `CommentCard.tsx` | Single comment with sentiment | `EmailMessage.tsx` |
| `SentimentBadge.tsx` | Colored badge (positive/neutral/negative) | NEW pattern |
| `RelevanceBadge.tsx` | Relevance score indicator | NEW pattern |
| `ScrapeProgress.tsx` | Scrape progress bar | `SyncProgress.tsx` |
| `AnalysisProgress.tsx` | Analysis progress bar | Inline in analyze page |
| `FbDashboardKPI.tsx` | Dashboard KPI tiles | email dashboard pattern |
| `FbReportGenerator.tsx` | Report generation form | email reports page inline |
| `FbReportPreview.tsx` | Report markdown preview | email report detail |

### 4.4 Hooks

| Hook | Description | Pattern Source |
|------|-------------|----------------|
| `useScrapeJob.ts` | Polling scrape status | `useSyncJob.ts` (identical pattern) |
| `useFbAnalysisJob.ts` | Polling analysis status | `useAnalysisJob.ts` (identical pattern) |

### 4.5 Lib Modules (`src/lib/fb/`)

| Module | Description | Confidence |
|--------|-------------|------------|
| `apify-client.ts` | Apify Actor API: startRun, pollRunStatus, getDatasetItems | MEDIUM (Apify API needs validation) |
| `fb-sentiment-prompts.ts` | AI prompts for sentiment analysis | HIGH (same DefaultPrompt interface) |
| `fb-report-generator.ts` | Report aggregation logic | HIGH (same pattern as email reports) |

---

## 5. Data Flow

### 5.1 Scraping Flow (Replaces Email Sync)

```
UI: Click "Scrapuj" on group
  |
  v
POST /api/fb/scrape { groupId }
  - Verify admin
  - Check no active scrape job
  - Create fb_scrape_jobs row (status: pending)
  - Return { jobId }
  |
  v
useScrapeJob hook starts polling
  |
  v
POST /api/fb/scrape/process { jobId }
  - Load job + group
  - Call Apify Actor API (startRun or checkRunStatus)
  - IF run still running: return { status: 'processing', hasMore: true }
  - IF run completed: fetch dataset items, upsert to fb_posts + fb_comments
  - Return { status: 'completed' | 'has_more' }
```

**Key difference from Email Sync:** Email sync is paginated (100 messages/batch, multiple batches). Apify runs are fire-and-forget -- you start an actor run, then poll its status until SUCCEEDED, then fetch all results at once from the dataset. The polling loop in `useScrapeJob` maps naturally, but the server-side logic is different:

- **Email:** Each `/process` call fetches one page of messages
- **FB Scrape:** Each `/process` call checks Apify run status. Only the final call fetches data.

This means the scrape process route has two modes:
1. **Polling mode:** Run not finished -- just check status, return `has_more: true`
2. **Ingest mode:** Run finished -- fetch dataset, upsert posts/comments, return `completed`

### 5.2 Analysis Flow (Identical Pattern to Email)

```
UI: Click "Analiza AI" on group
  |
  v
POST /api/fb/analysis { groupId, dateFrom?, dateTo? }
  - Count unanalyzed posts
  - Create fb_analysis_jobs row
  - Return { jobId, totalPosts }
  |
  v
useFbAnalysisJob hook starts polling
  |
  v
POST /api/fb/analysis/process { jobId }
  - Load BATCH_SIZE posts (1 post per request, like email)
  - For each post + its comments:
    - Build text block
    - Call callAI() with sentiment prompts
    - Update fb_posts: sentiment, relevance_score, ai_snippet, ai_categories
  - Return { processedPosts, totalPosts, hasMore }
```

**Key difference from Email Analysis:** Results go directly onto `fb_posts` columns (sentiment, relevance_score, ai_snippet, ai_categories) instead of a separate `analysis_results` table. This is correct because:
- Email analysis produces 7 report sections per thread (structured data needs separate table)
- FB analysis produces simple per-post metadata (sentiment enum, score, snippet)

### 5.3 Report Flow (Same Pattern as Email)

```
POST /api/fb/reports { groupId, dateFrom?, dateTo?, templateType }
  - Load analyzed posts for group/date range
  - Aggregate into report sections
  - Create fb_reports row + content_markdown
  - Return { reportId }
```

---

## 6. Database Schema Design

### 6.1 Planned Tables (6 tables -- validated)

```sql
-- Groups (equivalent of mailboxes)
fb_groups (
  id UUID PK,
  name TEXT NOT NULL,
  facebook_url TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',  -- active | paused | archived
  last_scraped_at TIMESTAMPTZ,
  total_posts INT DEFAULT 0,
  apify_token_encrypted TEXT,  -- per-group Apify token (optional, fallback to env)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Posts (equivalent of emails/threads)
fb_posts (
  id UUID PK,
  group_id UUID FK -> fb_groups,
  facebook_post_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT,
  posted_at TIMESTAMPTZ,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  -- AI analysis results (stored directly, not in separate table)
  sentiment TEXT,            -- positive | neutral | negative | mixed
  relevance_score FLOAT,    -- 0.0 to 1.0
  ai_snippet TEXT,           -- AI-generated summary
  ai_categories TEXT[],      -- array of topic categories
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, facebook_post_id)
)

-- Comments
fb_comments (
  id UUID PK,
  post_id UUID FK -> fb_posts,
  facebook_comment_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT,
  posted_at TIMESTAMPTZ,
  likes_count INT DEFAULT 0,
  sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, facebook_comment_id)
)

-- Scrape jobs (equivalent of sync_jobs)
fb_scrape_jobs (
  id UUID PK,
  group_id UUID FK -> fb_groups,
  status TEXT DEFAULT 'pending',  -- pending | processing | completed | failed
  apify_run_id TEXT,
  posts_found INT DEFAULT 0,
  posts_new INT DEFAULT 0,
  posts_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Analysis jobs (equivalent of analysis_jobs)
fb_analysis_jobs (
  id UUID PK,
  group_id UUID FK -> fb_groups,
  status TEXT DEFAULT 'pending',
  total_posts INT DEFAULT 0,
  analyzed_posts INT DEFAULT 0,
  progress INT DEFAULT 0,
  date_range_from DATE,
  date_range_to DATE,
  ai_config_id UUID FK -> ai_config,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Reports (equivalent of reports + report_sections combined)
fb_reports (
  id UUID PK,
  group_id UUID FK -> fb_groups,
  title TEXT NOT NULL,
  content_markdown TEXT,     -- full report as markdown
  summary_data JSONB,        -- structured KPI data for dashboard
  date_range_from DATE,
  date_range_to DATE,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### 6.2 Schema Design Decisions

**Q: Should sentiment be on `fb_posts` or in a separate `fb_analysis_results` table?**

**Answer: On `fb_posts` directly.** Rationale:
- Email analysis produces 7 structured report sections per thread -- needs separate table
- FB analysis produces simple metadata per post (sentiment enum, float score, text snippet)
- Storing inline avoids JOINs for the most common query (list posts with sentiment)
- Re-analysis overwrites the values directly (simpler than managing result versions)
- `analyzed_at` field tracks when analysis was last run

**Q: Should `fb_reports` have separate `report_sections` like email?**

**Answer: Single `content_markdown` field, not separate sections.** Rationale:
- Email reports have 7 independently editable sections (complex structure)
- FB reports are simpler: sentiment summary + top posts + alerts (generated as one markdown document)
- `summary_data` JSONB holds structured KPI for dashboard cross-referencing
- If section editing is needed later, can split into sections then

**Q: Is 6 tables optimal?**

**Answer: Yes.** The 6 tables mirror the email module's 6 core tables (mailboxes, emails, sync_jobs, analysis_jobs, analysis_results, reports). The FB equivalent replaces `analysis_results` with inline fields on `fb_posts` and combines `reports`+`report_sections` into a simpler `fb_reports`. This is appropriate given the simpler data model.

### 6.3 Indexes

```sql
CREATE INDEX idx_fb_posts_group_id ON fb_posts(group_id);
CREATE INDEX idx_fb_posts_posted_at ON fb_posts(posted_at DESC);
CREATE INDEX idx_fb_posts_sentiment ON fb_posts(sentiment);
CREATE INDEX idx_fb_posts_relevance ON fb_posts(relevance_score DESC);
CREATE INDEX idx_fb_comments_post_id ON fb_comments(post_id);
CREATE INDEX idx_fb_scrape_jobs_group ON fb_scrape_jobs(group_id, status);
CREATE INDEX idx_fb_analysis_jobs_group ON fb_analysis_jobs(group_id, status);
```

### 6.4 RLS Policies

Same pattern as all existing tables: admin-only via `app_allowed_users`:

```sql
ALTER TABLE fb_groups ENABLE ROW LEVEL SECURITY;
-- Repeat for all 6 tables
CREATE POLICY "Admin only" ON fb_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM app_allowed_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 7. Apify Integration Architecture

### 7.1 `apify-client.ts` -- Core Apify API Wrapper

**Confidence:** MEDIUM (Apify API specifics need validation against current docs)

Based on training knowledge of Apify Actor API v2:

```typescript
// src/lib/fb/apify-client.ts

const APIFY_BASE_URL = 'https://api.apify.com/v2';

interface ApifyRunResult {
  id: string;           // run ID
  status: string;       // READY | RUNNING | SUCCEEDED | FAILED | TIMED-OUT | ABORTED
  datasetId: string;
}

interface ApifyPostItem {
  postId: string;
  text: string;
  authorName: string;
  timestamp: string;    // ISO date
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  comments?: ApifyCommentItem[];
}

// Start an actor run
async function startActorRun(token: string, actorId: string, input: object): Promise<string>
// Check run status
async function getRunStatus(token: string, runId: string): Promise<ApifyRunResult>
// Fetch dataset items
async function getDatasetItems(token: string, datasetId: string): Promise<ApifyPostItem[]>
```

**Key considerations:**
- Apify Actor runs are asynchronous. Starting a run returns immediately with a run ID.
- Polling run status replaces the paginated Graph API fetch pattern.
- Dataset items are fetched in bulk once the run completes.
- Apify has rate limits but they're generous (100+ requests/minute for paid plans).

**Apify token storage options:**
1. **Environment variable** (`APIFY_TOKEN` in `.env` / Vercel) -- simplest, recommended for MVP
2. **Encrypted in DB** (`fb_groups.apify_token_encrypted`) -- per-group tokens, use same `encrypt.ts`
3. **Both** -- DB token takes priority, env var as fallback

**Recommendation:** Start with env var only. Add per-group encrypted token later if needed.

### 7.2 Scrape Process Route -- Two-Phase Pattern

```typescript
// POST /api/fb/scrape/process
// Phase 1: Start run or check status (most calls)
// Phase 2: Ingest data (final call only)

export async function POST(request: Request) {
  // ... verify admin, load job ...

  if (!job.apify_run_id) {
    // First call -- start the actor run
    const runId = await startActorRun(token, actorId, { url: group.facebook_url });
    await updateJob(job.id, { apify_run_id: runId, status: 'processing' });
    return NextResponse.json({ status: 'processing', hasMore: true });
  }

  // Subsequent calls -- check run status
  const runResult = await getRunStatus(token, job.apify_run_id);

  if (runResult.status === 'RUNNING' || runResult.status === 'READY') {
    return NextResponse.json({ status: 'processing', hasMore: true });
  }

  if (runResult.status === 'FAILED' || runResult.status === 'TIMED-OUT') {
    await failJob(job.id, `Apify run failed: ${runResult.status}`);
    return NextResponse.json({ status: 'failed', error: runResult.status });
  }

  // SUCCEEDED -- fetch and ingest data
  const items = await getDatasetItems(token, runResult.datasetId);
  const { newPosts, updatedPosts } = await upsertPosts(adminClient, group.id, items);

  await completeJob(job.id, { posts_found: items.length, posts_new: newPosts, posts_updated: updatedPosts });
  return NextResponse.json({ status: 'completed', postsFound: items.length });
}
```

### 7.3 Vercel Timeout Considerations

- **Scrape status polling:** Very fast (<1s per call) -- no timeout risk
- **Data ingestion:** Could be large. Use upsert batches (100 posts at a time) with safety timeout
- **AI analysis:** Same BATCH_SIZE=1 pattern as email (1 post per request, parallel prompts)
- **All routes:** `export const maxDuration = 60;`

---

## 8. Component Sharing Strategy

**Q: Should fb-analyzer share any components with email-analyzer?**

**Answer: NO shared components, YES shared utilities.**

### What to Share (utilities/lib):
- `verifyAdmin()` / `getAdminClient()` -- extract to `src/lib/api/admin.ts`
- `ai-provider.ts` -- `callAI()`, `loadAIConfig()`
- `encrypt.ts` -- `encrypt()`, `decrypt()`
- `export-report-docx.ts` -- `exportReportToDocx()` (generic enough for FB reports)
- Design system -- CSS Variables, same style patterns

### What to Keep Separate (components):
- All `src/components/fb/` components are new and FB-specific
- No shared component between `src/components/email/` and `src/components/fb/`
- No shared component between `src/components/threads/` and `src/components/fb/`

### Rationale:
1. **Email and FB have different data shapes.** Email has mailboxes/threads/emails. FB has groups/posts/comments. Sharing components would require complex generics for minimal benefit.
2. **UI will diverge.** FB has sentiment badges, relevance scores, engagement metrics -- email has response times, GDPR checks, case statuses. Different enough to warrant separate components.
3. **Copy the pattern, not the code.** Use email components as _reference_ when building FB components (same CSS Variables, same layout patterns), but don't create abstractions.
4. **Avoid premature abstraction.** If a third module arrives and patterns stabilize, extract shared components then.

---

## 9. Sidebar Navigation Integration

```typescript
// In Sidebar.tsx NAV_ITEMS, add after email-analyzer:
{
  href: '/fb-analyzer',
  label: 'Analizator Grup FB',
  icon: MessageSquare,  // already imported
  badge: 'Nowy',
  children: [
    { href: '/fb-analyzer/dashboard', label: 'Dashboard', icon: BarChart3, adminOnly: true },
    { href: '/fb-analyzer/groups', label: 'Grupy', icon: Users, adminOnly: true },
    { href: '/fb-analyzer/posts', label: 'Posty', icon: MessageSquare, adminOnly: true },
    { href: '/fb-analyzer/analyze', label: 'Analiza AI', icon: Brain, adminOnly: true },
    { href: '/fb-analyzer/reports', label: 'Raporty', icon: ClipboardList, adminOnly: true },
    { href: '/fb-analyzer/settings', label: 'Ustawienia', icon: Cog, adminOnly: true },
  ],
}
```

New import needed: `Users` from lucide-react (for Groups icon).

---

## 10. Build Order (Critical Path Analysis)

### Phase Dependencies Graph

```
Phase 1: Foundation (DB + Types + Nav + Shell)
   |
   +--- Phase 2: Groups CRUD ------+
   |                                |
   +--- (parallel after Phase 1)   |
                                    |
Phase 3: Apify Scraping -----------+
   |                                |
   v                                |
Phase 4: Post Browsing             |
   |                                |
   v                                |
Phase 5: AI Analysis ------+       |
   |                        |       |
   v                        v       |
Phase 6: Dashboard         |       |
   |                        |       |
   v                        v       |
Phase 7: Reports + Export          |
```

### Detailed Build Order

**Phase 1: Foundation (DB + Types + Navigation)** -- MUST BE FIRST
- SQL migration for 6 tables + RLS + indexes
- `src/types/fb.ts` -- all domain types
- Extract `src/lib/api/admin.ts` (verifyAdmin, getAdminClient)
- Update Sidebar NAV_ITEMS
- Update tools.ts (active=true)
- Shell pages (layout + empty pages with placeholders)
- **Deliverable:** Navigation works, empty pages accessible, tables exist

**Phase 2: Group Management (CRUD)** -- SECOND
- API routes: `/api/fb/groups` (GET, POST), `/api/fb/groups/[id]` (GET, PUT, DELETE)
- Components: GroupForm, GroupCard, GroupList
- Page: `/fb-analyzer/groups/page.tsx`
- **Deliverable:** Can add/edit/delete FB groups
- **Why second:** Everything downstream needs groups to exist first

**Phase 3: Apify Scraping** -- THIRD
- `src/lib/fb/apify-client.ts` (Apify Actor API wrapper)
- API routes: `/api/fb/scrape`, `/api/fb/scrape/process`, `/api/fb/scrape/status/[jobId]`
- Hook: `useScrapeJob.ts`
- Component: `ScrapeProgress.tsx`
- Page: `/fb-analyzer/settings/page.tsx` (Apify token configuration)
- **Deliverable:** Can scrape posts from FB groups, see progress
- **Why third:** Posts are needed for all subsequent phases
- **RESEARCH FLAG:** Apify Actor API response format needs validation against current docs

**Phase 4: Post Browsing** -- FOURTH
- API routes: `/api/fb/posts` (GET with filters), `/api/fb/posts/[id]` (GET)
- Components: PostCard, PostList, PostFilters, PostDetail, CommentCard
- Components: SentimentBadge, RelevanceBadge (used here and in analysis)
- Pages: `/fb-analyzer/posts/page.tsx`, `/fb-analyzer/posts/[id]/page.tsx`
- **Deliverable:** Can browse and filter scraped posts with comments
- **Why fourth:** Need scraped data to display; also needed to verify scraping works

**Phase 5: AI Sentiment Analysis** -- FIFTH
- `src/lib/fb/fb-sentiment-prompts.ts` (AI prompts for sentiment)
- API routes: `/api/fb/analysis`, `/api/fb/analysis/process`
- Hook: `useFbAnalysisJob.ts`
- Component: `AnalysisProgress.tsx`
- Page: `/fb-analyzer/analyze/page.tsx`
- **Deliverable:** Can run AI analysis on posts, see sentiment/relevance/categories
- **Why fifth:** Needs posts in DB (Phase 3+4). Analysis results feed dashboard and reports

**Phase 6: Dashboard** -- SIXTH
- API route: `/api/fb/dashboard` (aggregated KPI)
- Component: `FbDashboardKPI.tsx`
- Page: `/fb-analyzer/dashboard/page.tsx`
- Features: KPI tiles (total posts, sentiment distribution, alerts), recent activity, negative post alerts
- **Deliverable:** Overview dashboard with actionable insights
- **Why sixth:** Needs posts + analysis data

**Phase 7: Reports + Export** -- SEVENTH (LAST)
- `src/lib/fb/fb-report-generator.ts` (report logic)
- API routes: `/api/fb/reports` (GET, POST), `/api/fb/reports/[id]` (GET, PUT, DELETE)
- Components: FbReportGenerator, FbReportPreview
- Pages: `/fb-analyzer/reports/page.tsx`, `/fb-analyzer/reports/[id]/page.tsx`
- DOCX export: Reuse `exportReportToDocx` (may need minor adaptation for FB report structure)
- **Deliverable:** Can generate, view, edit, and export reports

### Parallelization Opportunities

- **Phases 2 + Settings page from Phase 3** can overlap (Groups CRUD + Apify settings are independent)
- **Phase 4 + SentimentBadge/RelevanceBadge** can be built speculatively before Phase 5
- **Phase 6 + Phase 7** are somewhat independent (both depend on Phase 5 but not on each other)

### Critical Path

```
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6
                                                     -> Phase 7
```

Phases 6 and 7 can be parallelized. Total critical path: 6 sequential phases (not 7).

---

## 11. Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Component Abstraction Too Early
**What:** Creating generic `<DataCard>`, `<FilterableList>`, `<ProgressBar>` components shared between email and FB modules.
**Why bad:** Different data shapes, different UI needs. Creates coupling for minimal benefit.
**Instead:** Copy the pattern, keep components module-specific. Extract shared components only if a third module arrives.

### Anti-Pattern 2: Single API Route Namespace
**What:** Putting FB routes alongside email routes (e.g., `/api/analysis/fb/...` or `/api/fb-analysis/...`).
**Why bad:** Pollutes the flat namespace, makes routing confusing.
**Instead:** All FB routes under `/api/fb/` prefix. Clean separation.

### Anti-Pattern 3: Over-Engineering the Apify Integration
**What:** Building a generic "scraper abstraction" that could handle any Apify actor.
**Why bad:** Only one actor is used. Over-engineering delays delivery.
**Instead:** Hard-code the `curious_coder/facebook-post-scraper` actor integration. Generalize later if needed.

### Anti-Pattern 4: Storing Analysis in Separate Table
**What:** Creating `fb_analysis_results` table mirroring email's `analysis_results`.
**Why bad:** FB analysis is simple (sentiment enum, score, snippet) -- adding a JOIN for every post query.
**Instead:** Store directly on `fb_posts` columns. Re-analysis overwrites values.

---

## 12. Scalability Considerations

| Concern | At 10 groups | At 100 groups | At 1000+ groups |
|---------|--------------|---------------|-----------------|
| Scrape jobs | Fine -- sequential per group | Queue system needed | Background worker needed |
| Post storage | ~1K posts -- fine | ~100K posts -- add pagination | Need archiving strategy |
| AI analysis | ~10 posts/batch -- fine | Rate limiting needed | Cost concerns -- selective analysis |
| Dashboard queries | Single aggregation -- fine | Materialized views | Pre-computed KPI table |

**For v1.1 (MVP):** Expected usage is 1-5 groups with ~100-500 posts each. No scalability concerns.

---

## 13. Environment Variables

### New Variables Needed

| Variable | Where | Required | Notes |
|----------|-------|----------|-------|
| `APIFY_TOKEN` | `.env.local` + Vercel | Yes (Phase 3) | Apify API token |
| `FB_APIFY_ACTOR_ID` | `.env.local` + Vercel | No (default to `curious_coder/facebook-post-scraper`) | Can be hardcoded |

### Existing Variables (No Changes)

- `NEXT_PUBLIC_SUPABASE_URL` -- shared
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- shared
- `SUPABASE_SERVICE_ROLE_KEY` -- shared
- `ENCRYPTION_KEY` -- shared (encrypts Apify token)

---

## 14. Sources and Confidence

| Claim | Source | Confidence |
|-------|--------|------------|
| Existing codebase patterns (all patterns described) | Direct codebase analysis (21+ files read) | HIGH |
| verifyAdmin/getAdminClient in 21 files | Grep search result | HIGH |
| Polling-driven batch processing pattern | useSyncJob.ts, useAnalysisJob.ts, sync/process, analysis/process | HIGH |
| Apify Actor API (REST endpoints, run lifecycle) | Training data | MEDIUM |
| Apify facebook-post-scraper output format | Training data | LOW -- needs validation against current docs |
| BATCH_SIZE=1 for Vercel timeout | Existing code comment + handoff doc | HIGH |
| Database schema design | Architectural plan + email schema analysis | HIGH |
| DOCX export reusability | export-report-docx.ts interface analysis | HIGH |

---

## 15. Open Questions for Phase-Specific Research

1. **Apify Actor response format:** What exact fields does `curious_coder/facebook-post-scraper` return? This needs validation before Phase 3 implementation. Suggest running a test scrape manually via Apify Console.

2. **Apify run polling interval:** How long do scrapes typically take? This determines the polling delay in `useScrapeJob` (currently planned as same `BATCH_DELAY_MS = 500ms`). May need longer intervals (2-5 seconds) since Apify runs take minutes, not seconds.

3. **FB group privacy:** Can the Apify actor scrape private groups? Does it require login cookies? This affects settings page design (may need more than just API token).

4. **Post deduplication strategy:** Apify may return overlapping data on re-scrapes. The `UNIQUE(group_id, facebook_post_id)` constraint handles this, but need to decide ON CONFLICT behavior (update counts? update content?).
