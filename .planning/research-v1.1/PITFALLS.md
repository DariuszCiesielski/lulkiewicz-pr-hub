# Domain Pitfalls: FB Analyzer

**Domain:** Facebook group scraping (Apify) + Polish sentiment analysis + Next.js/Supabase integration
**Researched:** 2026-02-12
**Confidence:** MEDIUM (based on training data + codebase analysis; WebSearch/WebFetch unavailable for verification)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or feature-breaking issues.

### Pitfall 1: Apify Scrape Timeout vs Vercel Timeout Mismatch

**What goes wrong:** Apify Actor run for a large Facebook group can take 3-15 minutes. The existing polling pattern (useSyncJob) calls `/api/fb/scrape/process` which hits Vercel's 60s timeout. If the code tries to START the Apify run AND WAIT for results in a single API call, it will always timeout for non-trivial groups.

**Why it happens:** Copying the email sync pattern too literally. Email sync fetches a batch of 100 emails per request (fast, synchronous). Apify Actor runs are fundamentally different -- they are long-running async jobs on Apify infrastructure.

**Consequences:** Every scrape for groups with 50+ posts will timeout. Users see "Error 504" with no data saved.

**Prevention:**
1. **Two-phase architecture (MUST):**
   - Phase A: `POST /api/fb/scrape` -- starts Apify Actor run via API, saves `apify_run_id` to `fb_scrape_jobs`, returns immediately
   - Phase B: `POST /api/fb/scrape/process` -- polls Apify run status (`GET /v2/actor-runs/{runId}`). If still running, return `{ status: 'waiting', hasMore: true }`. If finished, fetch dataset items and upsert to DB in batches
2. **Frontend polling loop (useScrapeJob):** Call `/process` every 5-10 seconds. Most calls will just check status (fast). Only when Apify run completes does it fetch + save data
3. **Dataset pagination:** When fetching results from completed run, use Apify dataset pagination (`offset` + `limit`) to avoid loading thousands of items in one request

**Detection:** Test with a group that has 200+ posts. If it fails, this is the issue.

**Phase:** Phase 3 (Scraping) -- this is THE critical design decision for the entire scraping pipeline.

**Confidence:** HIGH -- directly observed this pattern in the existing `useSyncJob` codebase and Vercel 60s constraint is documented in the project.

---

### Pitfall 2: Facebook Cookie Expiration Mid-Scrape

**What goes wrong:** The Apify Facebook scraper requires active Facebook session cookies (`c_user` + `xs` at minimum). These cookies expire unpredictably -- sometimes after 24-48 hours, sometimes after a week. If cookies expire during a scrape job, the Apify run returns partial data or authentication errors, but may still report "success" with 0 results.

**Why it happens:** Facebook actively invalidates sessions, especially for accounts showing automated behavior (consistent timing, no human-like browsing patterns). There is no refresh mechanism -- expired cookies simply stop working.

**Consequences:**
- Silent failures: scrape job "completes" with 0 new posts
- Partial data: some posts scraped before cookie expired, rest missing
- Admin doesn't know until they check -- no automatic alert
- If using a personal account, the account may get restricted or banned

**Prevention:**
1. **Cookie health check before scraping:** Before starting an Apify run, make a lightweight test request (e.g., scrape the group page with `maxPosts: 1`). If it returns 0 results or auth error, flag cookies as expired BEFORE starting the real scrape
2. **Post-scrape validation:** After scrape completes, compare `posts_found` with expected range. If a group typically has 10+ posts/week and scrape returns 0, flag as suspicious
3. **Cookie status in UI:** Add a `cookie_status` field to `fb_groups` or a global `fb_config` table: `valid`, `expired`, `unknown`. Show prominent warning in Dashboard when cookies are expired
4. **Admin notification:** When cookies expire, surface it immediately -- this is the most common failure mode. Consider Telegram alert (existing N8N pattern) or in-app banner
5. **Cookie rotation docs:** Document the cookie extraction process for the admin. It's manual (browser DevTools > Application > Cookies > facebook.com), and they need to know HOW and WHEN to do it
6. **NEVER store cookies in plaintext:** Use existing `encrypt.ts` (AES-256-GCM) -- already planned, but emphasize it

**Detection:** `posts_found = 0` on a group that previously had posts. Or Apify run log contains "login" or "redirect" keywords.

**Phase:** Phase 3 (Scraping) -- must be built into the core scraping flow from day one.

**Confidence:** MEDIUM -- based on training data about Facebook scraping patterns. Specific expiration timing may vary.

---

### Pitfall 3: Duplicate Post Detection Failure

**What goes wrong:** Running scrapes on the same group multiple times (which is the entire point -- monitoring) inserts duplicate posts into `fb_posts`. This corrupts sentiment analysis (same post analyzed multiple times), inflates KPIs, and makes reports unreliable.

**Why it happens:** The email analyzer solved this with `UNIQUE(mailbox_id, internet_message_id)` + upsert. Facebook posts need the same pattern but with different keys. The naive approach of using post URL or content hash fails because:
- Post URLs may change format
- Content can be edited by the author
- Facebook post IDs may be extracted differently across Actor versions

**Consequences:** Inflated post counts, duplicate sentiment scores, incorrect trend analysis, wasted AI tokens analyzing the same content.

**Prevention:**
1. **UNIQUE constraint:** `UNIQUE(group_id, facebook_post_id)` on `fb_posts` table -- this is the primary dedup key
2. **Upsert strategy:** `ON CONFLICT (group_id, facebook_post_id) DO UPDATE SET` -- update content, likes, comments count, shares (these change over time), but preserve original `created_at` and `first_scraped_at`
3. **Track content changes:** Add `content_hash` (SHA-256 of post text) and `content_updated_at`. If content changed between scrapes, mark for re-analysis
4. **Same for comments:** `UNIQUE(post_id, facebook_comment_id)` on `fb_comments`
5. **facebook_post_id extraction:** Verify what the Apify Actor returns as unique identifier. Map it consistently. Add a migration test that inserts the same post twice to verify constraint works

**Detection:** `SELECT facebook_post_id, COUNT(*) FROM fb_posts GROUP BY facebook_post_id HAVING COUNT(*) > 1` -- run this after first few scrapes.

**Phase:** Phase 1 (Database migration) for constraints, Phase 3 (Scraping) for upsert logic.

**Confidence:** HIGH -- this is a universal scraping pattern. The email analyzer already solved it correctly.

---

### Pitfall 4: AI Sentiment Analysis for Polish Real Estate Management Context

**What goes wrong:** Generic sentiment analysis misclassifies domain-specific Polish real estate terms. Examples:
- "Fundusz remontowy podwyzszony o 50%" -- factual statement classified as negative (because "podwyzszony" = increased, sounds bad)
- "Zarzadca wymienil drzwi" -- positive (problem was fixed) but classified as neutral
- "Proszę o interwencję w sprawie cisza nocna" -- complaint (negative) but uses polite language, classified as neutral
- "Wreszcie dziala domofon!" -- positive (relief) but model misses Polish sarcasm detection
- "Administracja jak zwykle" -- sarcastic negative, but literal reading is neutral

**Why it happens:** LLMs are better at English sentiment. Polish has:
- Different sentiment markers (diminutives, particles like "no", "przeciez")
- Sarcasm that's structurally different from English
- Domain vocabulary that generic models don't understand (wspolnota, zarzadca, fundusz remontowy, czynsz, uchwala, zebranie wspolnoty)
- Mixed sentiment: gratitude + complaint in same post

**Consequences:** Unreliable reports, false alerts (negative post flagged as positive), missed actual complaints, loss of trust in the tool.

**Prevention:**
1. **Domain-specific system prompt (CRITICAL):** The sentiment prompt MUST include:
   - List of domain terms with expected sentiment context
   - Examples of Polish real estate complaints vs. praise
   - Instruction to consider the ACTION described, not just word polarity
   - Multi-label support: a post can be both positive AND negative about different aspects
2. **Structured output format:** Don't just return "positive/negative/neutral". Use:
   - `sentiment`: positive | negative | neutral | mixed
   - `sentiment_score`: -1.0 to +1.0
   - `aspects`: array of { aspect: string, sentiment: string } (e.g., "dzwi" -> positive, "czynsz" -> negative)
   - `ai_snippet`: 1-sentence summary in Polish
   - `categories`: array (e.g., ["remont", "bezpieczenstwo", "finanse"])
3. **Few-shot examples in prompt:** Include 5-10 real examples of Polish real estate posts with correct classification
4. **Confidence score:** Have AI return confidence. Low-confidence results can be flagged for human review
5. **Test with real data:** Before finalizing prompts, test on actual FB group posts (if available). Iterate prompts based on results

**Detection:** Manual review of first 20-30 analyzed posts. If accuracy < 80%, prompts need tuning.

**Phase:** Phase 5 (AI Analysis) -- prompt engineering is the core of this phase.

**Confidence:** MEDIUM -- based on general NLP knowledge and Polish language characteristics. Actual accuracy depends on model quality and prompt engineering.

---

### Pitfall 5: Account Ban Escalation

**What goes wrong:** The Facebook account used for session cookies gets temporarily or permanently banned. This kills ALL scraping capability until a new account is set up.

**Why it happens:** Facebook detects automated access via:
- Unusual access patterns (same pages visited at regular intervals)
- IP reputation (Apify proxy IPs may be flagged)
- Account age/activity (new or dormant accounts are more suspicious)
- Too many groups accessed too quickly
- Session used from multiple IP addresses (Apify uses different IPs than the user's normal login)

**Consequences:** Complete feature outage until new account cookies are provided. If the admin's personal account is used, they lose personal Facebook access too.

**Prevention:**
1. **NEVER use the admin's personal account.** Create a dedicated Facebook account for scraping. Document this requirement clearly
2. **Rate limiting between groups:** The N8N workflow uses 3-6 min between groups -- replicate this. Don't scrape all groups in parallel
3. **Scrape frequency limits:** Maximum once per day per group (preferably). Build this as a hard limit in the API, not just UI guidance
4. **Configurable delays:** Store `min_delay_between_scrapes_ms` in `fb_config` or settings. Default: 300000 (5 min)
5. **Sequential group scraping:** Never start multiple Apify runs for different groups simultaneously from the same account
6. **Account rotation strategy (future):** Design the schema to support multiple Facebook accounts (`fb_accounts` table), even if v1.1 only uses one. This makes recovery from bans easier
7. **Graceful degradation:** If scraping fails, the rest of the app (existing posts, analysis, reports) should still work. Don't couple scraping availability to the entire FB analyzer module

**Detection:** Apify run fails with auth-related errors. Monitor `fb_scrape_jobs` for consecutive failures on the same group.

**Phase:** Phase 3 (Scraping) for rate limiting, Phase 2 (Groups) for sequential scraping design.

**Confidence:** MEDIUM -- Facebook anti-scraping measures are well-documented in training data. Specific thresholds may have changed.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded UX.

### Pitfall 6: Apify Actor Output Schema Changes

**What goes wrong:** The `curious_coder/facebook-post-scraper` Actor is third-party. Its output schema can change without notice when the author updates the Actor. Fields may be renamed, removed, or restructured.

**Prevention:**
1. **Schema validation layer:** In `apify-client.ts`, validate Actor output against expected TypeScript interface before inserting into DB. Use Zod or manual validation
2. **Flexible field mapping:** Don't assume exact field names. Map Apify output to internal types through a dedicated `mapApifyPostToFbPost()` function
3. **Pin Actor version:** Use `build` parameter in Apify API call to pin to a specific Actor build. Only upgrade deliberately after testing
4. **Log raw data:** On first N scrapes, log raw Apify output to a `fb_scrape_raw_log` or just console.log. Helps debug schema mismatches
5. **Fallback for missing fields:** If a field is missing, use sensible defaults (e.g., `likes: 0`, `content: ''`) rather than crashing

**Phase:** Phase 3 (Scraping).

**Confidence:** MEDIUM -- general risk with third-party Actors on Apify marketplace.

---

### Pitfall 7: Vercel Timeout for Large Dataset Fetching

**What goes wrong:** After an Apify run completes, fetching results from the Apify dataset can timeout if the group has thousands of posts. A single `GET /v2/datasets/{id}/items` call to fetch 5000+ items may take longer than 60 seconds when combined with DB upserts.

**Prevention:**
1. **Paginate dataset fetching:** Fetch Apify dataset items in pages of 100-200 (`limit` + `offset` params)
2. **One page per `/process` call:** Each call to `POST /api/fb/scrape/process` fetches one page, upserts to DB, returns `{ hasMore: true }`. Client polling loop continues until all pages processed
3. **Track fetch progress:** Add `dataset_offset` to `fb_scrape_jobs` to track where we are in the dataset
4. **Safety timeout:** Same pattern as email sync -- 50s safety timeout with 10s buffer for Vercel's 60s limit

**Phase:** Phase 3 (Scraping).

**Confidence:** HIGH -- this is the exact same constraint that required BATCH_SIZE=1 in the email analysis pipeline.

---

### Pitfall 8: Reusing AI Provider Without Adapter

**What goes wrong:** The existing `callAI()` function works for email thread analysis (long text in, structured analysis out). For FB sentiment analysis, the requirements differ:
- Input is shorter (single post vs. entire email thread)
- Output should be structured JSON (sentiment, score, categories) not free-text markdown
- Batch efficiency matters more (hundreds of posts vs. 6 threads)
- Token cost per item should be lower

Reusing `callAI()` directly without adaptation leads to expensive, slow, poorly-structured sentiment analysis.

**Prevention:**
1. **Keep `callAI()` as-is** -- it's the low-level AI call function, and it works fine
2. **Create FB-specific wrapper:** `analyzeFbPostSentiment(config, post)` that:
   - Uses shorter, more focused prompts
   - Requests JSON output format (if model supports it)
   - Parses structured response into `{ sentiment, score, categories, snippet }`
3. **Consider using `response_format: { type: "json_object" }` in the OpenAI API call** -- this may require a small extension to `callAI()` (add optional parameter for response format)
4. **Batch posts in prompt:** Instead of 1 API call per post, consider sending 5-10 short posts in a single prompt with instructions to return a JSON array. Reduces API calls and costs significantly
5. **Monitor token usage:** Add tracking per analysis job. Alert if cost exceeds threshold

**Phase:** Phase 5 (AI Analysis) -- design the wrapper, Phase 3 (callAI extension) if `response_format` is needed.

**Confidence:** HIGH -- based on direct codebase analysis of `ai-provider.ts`.

---

### Pitfall 9: Missing Incremental Scrape (Delta Sync)

**What goes wrong:** Every scrape fetches ALL posts from the group, even if only 5 new posts were added since last scrape. This wastes Apify compute units, takes longer, and costs more.

**Prevention:**
1. **Use `startDate` parameter:** The Apify Actor likely supports a date filter. Pass `last_scraped_at` from `fb_groups` as the start date
2. **Track high watermark:** After successful scrape, update `fb_groups.last_scraped_at` to the newest post's date
3. **Periodic full scrape:** Even with delta, run a full scrape monthly to catch edits, deleted posts, and updated engagement metrics
4. **Cost tracking:** Log Apify compute units per scrape job. Show in settings/dashboard so admin can monitor costs

**Phase:** Phase 3 (Scraping) -- design from the start, even if first implementation does full scrape.

**Confidence:** LOW -- depends on the specific Apify Actor's input parameters. Needs verification during Phase 3 research.

---

### Pitfall 10: Scrape Job State Machine Complexity

**What goes wrong:** The scrape job has more states than the email sync job because it involves an external async system (Apify). States: `pending` -> `starting` -> `apify_running` -> `fetching_results` -> `saving` -> `completed` / `failed`. If the state machine is not well-defined, jobs get stuck in intermediate states with no recovery.

**Prevention:**
1. **Explicit state enum:** Define all states upfront in types AND database
2. **Timeout per state:** `apify_running` should timeout after 15 minutes. `fetching_results` after 5 minutes. If exceeded, mark as `failed` with reason
3. **Stale job cleanup:** On app start or before new scrape, check for jobs stuck in intermediate states > 30 min. Mark as `failed`
4. **Idempotent `/process` calls:** If the same job is processed twice (e.g., client retry), it should resume, not duplicate work
5. **Store `apify_run_id`:** Essential for both status polling and debugging. If the process endpoint dies mid-fetch, next call can resume using the run ID

**Phase:** Phase 3 (Scraping) -- must be designed before implementation.

**Confidence:** HIGH -- based on analysis of existing `useSyncJob` pattern, which is simpler because Graph API calls are synchronous.

---

### Pitfall 11: Ignoring Posts Without Text Content

**What goes wrong:** Facebook group posts can be:
- Text only (easy)
- Image/video only with no text (common for photos of building damage, parking violations)
- Link shares with minimal text
- Polls
- Event announcements

If the system only handles text posts, it misses a significant portion of group activity.

**Prevention:**
1. **Classify post types:** Add `post_type` field: `text`, `photo`, `video`, `link`, `poll`, `event`, `other`
2. **For image-only posts:** Store the post but mark sentiment as `unanalyzable` with reason. Don't skip it -- the comments on image posts often contain sentiment
3. **Analyze comments separately:** Even if a post has no text, its comments may have valuable sentiment data. Design the analysis pipeline to handle comments independently
4. **Future: image description:** GPT-4o+ can describe images. Plan for this as a future enhancement but don't block v1.1 on it
5. **Engagement metrics still matter:** Likes, shares, and comment count on a text-less post still indicate engagement. Track these regardless

**Phase:** Phase 1 (Schema -- `post_type` field), Phase 4 (UI -- display logic), Phase 5 (Analysis -- handle empty content).

**Confidence:** MEDIUM -- based on general Facebook group behavior patterns.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 12: Apify Token Storage Location

**What goes wrong:** The plan mentions both `.env` (`APIFY_TOKEN`) and "encrypted in DB as alternative." If both paths exist, code may check one place and not the other, leading to "token not found" errors even when configured.

**Prevention:** Pick ONE canonical storage location. **Recommendation:** Encrypt in DB (like OpenAI API key in `ai_config`). This is consistent with the existing pattern and allows changing tokens without redeployment.

**Phase:** Phase 3 (Settings page).

---

### Pitfall 13: Sidebar Navigation Clutter

**What goes wrong:** Adding 7+ navigation items for FB Analyzer (Dashboard, Groups, Posts, Analyze, Reports, Settings) alongside existing Email Analyzer items makes the sidebar overwhelming.

**Prevention:**
1. **Collapsible sections:** Each tool's nav items collapse/expand independently (already planned with `children` pattern)
2. **Show only active tool's children:** When user is in FB Analyzer, email items are collapsed
3. **Consistent ordering:** Mirror Email Analyzer's nav structure where possible (Dashboard first, Settings last)

**Phase:** Phase 1 (Navigation update).

---

### Pitfall 14: Missing Error Table for Scrape Failures

**What goes wrong:** The N8N workflow logs errors to a separate table and sends Telegram alerts. If the PR Hub version doesn't replicate this, scraping failures are silently lost in server logs that nobody checks.

**Prevention:**
1. **`error_message` field on `fb_scrape_jobs`** -- already in the plan, but make sure it captures the FULL error, not just "Failed"
2. **Error count on dashboard:** Show "Last 5 scrape failures" widget
3. **Consider a general `error_log` table** shared across both email and FB analyzers, or at minimum, surface errors in the UI prominently

**Phase:** Phase 3 (Scraping), Phase 6 (Dashboard).

---

### Pitfall 15: Timezone Handling for posted_at

**What goes wrong:** Facebook post timestamps from Apify may be in different timezone formats (UTC, local, or relative like "2 hours ago"). If stored inconsistently, date filtering and trending analysis break.

**Prevention:**
1. **Normalize to UTC** on ingest (in the `mapApifyPostToFbPost()` mapping function)
2. **Store as `timestamptz`** in PostgreSQL (Supabase default for timestamp columns)
3. **Display in Polish timezone** (Europe/Warsaw) on the frontend using `toLocaleString('pl-PL')`
4. **Validate during mapping:** If timestamp is unparseable, use `scraped_at` as fallback

**Phase:** Phase 3 (Scraping -- data mapping).

---

### Pitfall 16: Cost Surprise from Apify Compute Units

**What goes wrong:** Apify charges per compute unit. Scraping large groups or running scrapes too frequently leads to unexpectedly high bills. The admin may not realize the cost until the monthly invoice.

**Prevention:**
1. **Show estimated cost per scrape** in the UI before triggering (based on group size and historical CU usage)
2. **Monthly CU usage dashboard** -- fetch from Apify API or track locally
3. **Configurable scrape limits:** Max posts per scrape, max scrapes per day, max groups per scrape run
4. **Document pricing:** In settings page, link to Apify pricing and explain CU model

**Phase:** Phase 3 (Settings), Phase 6 (Dashboard).

---

## Integration Pitfalls (Specific to Adding to Existing System)

### Pitfall 17: Shared AI Config Conflict

**What goes wrong:** Both Email Analyzer and FB Analyzer use the same `ai_config` table. If the admin changes the AI model or temperature for email analysis, it also affects FB sentiment analysis, which may need different settings.

**Prevention:**
1. **Option A (simple):** Use same AI config for both tools. Document that settings are shared. This is fine for v1.1
2. **Option B (future):** Add `tool_id` column to `ai_config` to allow per-tool settings
3. **Different prompts are sufficient:** The main customization is in prompts, not model settings. FB-specific prompts in `fb-sentiment-prompts.ts` handle the domain difference

**Phase:** Phase 5 (Analysis) -- decide during implementation.

---

### Pitfall 18: Database Migration Conflicts

**What goes wrong:** Adding 6 new tables via SQL migration while the existing system is live on Vercel. If migration fails midway, the system is in an inconsistent state.

**Prevention:**
1. **All new tables, no alterations:** FB Analyzer tables are entirely new (no ALTER TABLE on existing tables). This is safe -- a failed migration won't affect existing functionality
2. **Apply via Supabase Dashboard SQL Editor** (Supabase CLI is broken -- documented in project context)
3. **Test migration locally first:** Run the SQL in a test schema or review carefully for syntax errors
4. **Add tables in order:** Tables with foreign keys must be created after their references (`fb_posts` after `fb_groups`, `fb_comments` after `fb_posts`)

**Phase:** Phase 1 (Database migration).

**Confidence:** HIGH -- based on documented project constraint about Supabase CLI.

---

### Pitfall 19: ToolId Registry Not Extensible

**What goes wrong:** The existing `ToolId` type is a union string type. Adding `'fb-analyzer'` is straightforward, but if tool-specific routing, permissions, or configuration patterns aren't generalized, each new tool requires scattered changes across the codebase.

**Prevention:**
1. **Update `ToolId` union type** in `src/types/index.ts` (already planned)
2. **Update `src/config/tools.ts`** with new tool metadata
3. **Verify all switch/if statements** that use `ToolId` handle the new value
4. **Consider a tool registry pattern** if planning more tools beyond v1.1 -- but for now, direct union type is fine

**Phase:** Phase 1 (Foundation).

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation | Severity |
|-------|---------------|------------|----------|
| Phase 1: Foundation | Migration syntax error blocks deployment | Test SQL in Supabase SQL Editor first, new tables only (no ALTER) | Low |
| Phase 1: Foundation | Missing UNIQUE constraints | Add `UNIQUE(group_id, facebook_post_id)` and `UNIQUE(post_id, facebook_comment_id)` from day one | High |
| Phase 2: Groups CRUD | Hardcoded group URLs break | Validate and normalize Facebook group URLs on input | Low |
| Phase 3: Scraping | **Apify timeout vs Vercel timeout** | Two-phase async architecture (start run, poll status, fetch results in pages) | Critical |
| Phase 3: Scraping | Cookie expiration undetected | Health check before scrape, post-scrape validation, UI cookie status | Critical |
| Phase 3: Scraping | Account ban from aggressive scraping | Rate limiting between groups (5+ min), daily scrape limit, dedicated account | High |
| Phase 3: Scraping | Actor schema changes break parsing | Schema validation layer, pinned Actor version, flexible mapping | Medium |
| Phase 4: Posts UI | No content for image-only posts | `post_type` classification, analyze comments separately | Medium |
| Phase 5: AI Analysis | Polish sentiment misclassification | Domain-specific prompts with examples, structured JSON output, manual review of first batch | High |
| Phase 5: AI Analysis | Expensive per-post AI calls | Batch 5-10 posts per prompt, use shorter prompts than email analysis | Medium |
| Phase 6: Dashboard | Stale data without scrape schedule | Show `last_scraped_at` prominently, warn if > 7 days old | Low |
| Phase 7: Reports | Reports based on bad sentiment data | Validate sentiment accuracy BEFORE building reports (do Phase 5 testing thoroughly) | High |

---

## Sources and Confidence Notes

| Finding | Source | Confidence |
|---------|--------|------------|
| Vercel 60s timeout constraint | Codebase (`maxDuration = 60`, commit 715f9d2) | HIGH |
| Polling-based batch pattern | Codebase (`useSyncJob.ts`, `useAnalysisJob.ts`) | HIGH |
| AES-256-GCM encryption reuse | Codebase (`encrypt.ts`) | HIGH |
| BATCH_SIZE=1 for timeout safety | Codebase (`analysis/process/route.ts`) | HIGH |
| Facebook cookie expiration patterns | Training data | MEDIUM |
| Facebook anti-scraping measures | Training data | MEDIUM |
| Polish NLP sentiment challenges | Training data | MEDIUM |
| Apify Actor API patterns | Training data + project plan | MEDIUM |
| Apify dataset pagination | Training data | LOW -- verify during Phase 3 research |
| `curious_coder/facebook-post-scraper` specific behavior | Project context only | LOW -- verify Actor docs during Phase 3 |
| Apify compute unit pricing model | Training data | LOW -- verify current pricing |

**NOTE:** WebSearch and WebFetch were unavailable during this research. All Apify-specific and Facebook-specific claims are based on training data (cutoff: May 2025) and should be verified against current documentation during Phase 3 implementation. The codebase-based pitfalls (timeouts, patterns, integration) are HIGH confidence.
