# FB Reports & Export — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin generates FB reports on demand — selects developer + date range, AI synthesizes per-group sections + developer summary, exports to DOCX with clickable FB post links.

**Architecture:** Dedicated `fb-report-synthesizer.ts` for AI synthesis (3 calls per group + 1 per developer). Polling-driven generation via `/api/fb-reports/process`. Reuse existing `exportReportToDocx()` for DOCX export. New `fb_report_sections` table for per-section storage.

**Tech Stack:** Next.js 16 App Router, Supabase (hosted), callAI() from ai-provider.ts, ReactMarkdown + remarkGfm, docx library

---

## Task 1: DB Migration — `fb_report_sections`

**Files:**
- Create: `supabase/migrations/20260225_fb_report_sections.sql`

**Step 1: Write migration SQL**

```sql
-- FB Report Sections — stores AI-synthesized sections per report
CREATE TABLE IF NOT EXISTS fb_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES fb_reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_report_sections_report ON fb_report_sections(report_id);

-- RLS: admin-only (matches fb_reports policy)
ALTER TABLE fb_report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access fb_report_sections"
  ON fb_report_sections FOR ALL
  USING (true)
  WITH CHECK (true);
```

**Step 2: Apply migration via Supabase Dashboard**

Run the SQL above in Supabase Dashboard → SQL Editor (CLI is broken per project gotchas).

**Step 3: Verify**

Run in SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fb_report_sections';
```
Expected: 7 columns (id, report_id, section_key, section_order, title, content_markdown, is_edited, created_at).

**Step 4: Commit**

```bash
git add supabase/migrations/20260225_fb_report_sections.sql
git commit -m "db: add fb_report_sections table for FB report AI synthesis"
```

---

## Task 2: FB Report Synthesizer

**Files:**
- Create: `src/lib/ai/fb-report-synthesizer.ts`

**Reference:** `src/lib/ai/report-synthesizer.ts` (email version — for callAI pattern, truncation, batching)

**Step 1: Create fb-report-synthesizer.ts**

The file must export 4 functions + types:

```typescript
// Types
export interface FbPostForSynthesis {
  content: string;
  sentiment: string | null;
  relevance_score: number | null;
  ai_snippet: string | null;
  ai_categories: string[] | null;
  post_url: string | null;
  posted_at: string | null;
  author_name: string | null;
  group_name: string;  // denormalized from join
}

export interface FbSynthesisOutput {
  markdown: string;
  tokensUsed: number;
  processingTimeMs: number;
}
```

Constants:
- `MAX_INPUT_CHARS = 60_000` (same as email)
- System prompt: PL, expert in social media monitoring, developer reputation management

4 functions, each calls `callAI()`:

1. **`synthesizeGroupAnalysis(aiConfig, posts, groupName, dateRange?)`**
   - Focus: overall summary, sentiment breakdown, top categories, trends
   - Input: all relevant posts from group
   - Output: markdown section

2. **`synthesizeGroupRisk(aiConfig, posts, groupName, dateRange?)`**
   - Focus: PR risks, negative post quotes with FB links, severity assessment
   - Input: filtered to negative posts + high relevance (>=7)
   - Output: markdown section with `[link](post_url)` references

3. **`synthesizeGroupRecommendations(aiConfig, posts, groupName, previousSections, dateRange?)`**
   - Focus: actionable recommendations for this group
   - Input: posts + content_markdown from analysis + risk sections
   - Output: markdown section with priority table

4. **`synthesizeDeveloperSummary(aiConfig, groupSections, developerName, dateRange?)`**
   - Focus: cross-group patterns, top risks, overall assessment
   - Input: content_markdown from ALL group sections (not posts)
   - Output: executive summary markdown

Helper functions:
- `formatPostsForPrompt(posts)` — format posts into compact text block
- `truncateToLimit(text, limit)` — same pattern as email synthesizer

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/ai/fb-report-synthesizer.ts` (or just check no red squiggles in IDE)

**Step 3: Commit**

```bash
git add src/lib/ai/fb-report-synthesizer.ts
git commit -m "feat: add FB report synthesizer — 4 AI synthesis functions for group and developer reports"
```

---

## Task 3: API — Create & List FB Reports

**Files:**
- Create: `src/app/api/fb-reports/route.ts`

**Reference:** `src/app/api/reports/route.ts` (email version)

**Step 1: Create route.ts with GET and POST**

**GET /api/fb-reports** — list reports:
1. `verifyAdmin()` from `@/lib/api/admin`
2. Query `fb_reports` ordered by `created_at DESC`
3. Optional filter: `?developer=Robyg`
4. Return `{ reports: [...] }`

**POST /api/fb-reports** — create report:
1. `verifyAdmin()` + `getAdminClient()`
2. Parse body: `{ developer, dateFrom, dateTo, excludeGroupIds? }`
3. Fetch groups: `fb_groups WHERE developer = :developer AND status = 'active' AND deleted_at IS NULL AND id NOT IN (:excludeGroupIds)`
4. Validate: at least 1 group with analyzed posts in date range
5. Calculate `totalSections = (groups.length * 3) + 1`
6. Build title: `"Raport FB — {developer} ({groups.length} grup, {dateFrom} — {dateTo})"`
7. Insert `fb_reports` with `{ title, group_ids: groups.map(g => g.id), date_from: dateFrom, date_to: dateTo, status: 'generating' }`
8. Return `{ reportId, title, totalSections, status: 'generating' }`

`maxDuration = 60` (only DB queries, no AI here).

**Step 2: Verify**

Start dev server. Test with curl:
```bash
curl -X GET http://localhost:3000/api/fb-reports -H "Cookie: <auth_cookie>"
```
Expected: `{ "reports": [] }`

**Step 3: Commit**

```bash
git add src/app/api/fb-reports/route.ts
git commit -m "feat: add POST+GET /api/fb-reports — create and list FB reports"
```

---

## Task 4: API — Process FB Report (Polling Synthesis)

**Files:**
- Create: `src/app/api/fb-reports/process/route.ts`

**Reference:** `src/app/api/reports/process/route.ts` (email version — same polling pattern)

**Step 1: Create process/route.ts**

`maxDuration = 300` (Vercel Pro — AI calls can take up to 240s).

POST /api/fb-reports/process:
1. `verifyAdmin()` + `getAdminClient()`
2. Parse body: `{ reportId }`
3. Load report from `fb_reports`
4. Guard: if status is 'draft' → return completed. If not 'generating' → error
5. Load `fb_report_sections` to find which sections already done
6. Build ordered section list:
   - For each group_id in report.group_ids: 3 section keys (`group:{id}:analysis`, `group:{id}:risk`, `group:{id}:recommendations`)
   - Then: `developer:{developer}:summary`
7. Find first missing section key
8. If none missing → update status to 'draft', return `{ hasMore: false }`
9. Process 1 section:

**For group sections:**
   - Load posts from `fb_posts` WHERE group_id AND posted_at BETWEEN date_from AND date_to AND relevance_score >= 3 ORDER BY relevance_score DESC LIMIT 200
   - Load group name from `fb_groups`
   - Call appropriate synthesize function:
     - `:analysis` → `synthesizeGroupAnalysis()`
     - `:risk` → `synthesizeGroupRisk()`
     - `:recommendations` → `synthesizeGroupRecommendations()` (also loads previous 2 sections' content_markdown)
   - Insert result into `fb_report_sections`

**For developer summary:**
   - Load all `fb_report_sections` for this report (excluding developer summary)
   - Call `synthesizeDeveloperSummary()`
   - Insert result

10. Return `{ status, processedSections, totalSections, hasMore }`

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/fb-reports/process/route.ts
git commit -m "feat: add POST /api/fb-reports/process — polling-driven AI synthesis per section"
```

---

## Task 5: API — Report Detail CRUD

**Files:**
- Create: `src/app/api/fb-reports/[id]/route.ts`

**Reference:** `src/app/api/reports/[id]/route.ts` (email version — nearly identical)

**Step 1: Create [id]/route.ts with GET, PATCH, DELETE**

**GET** /api/fb-reports/[id]:
1. `verifyAdmin()` + `getAdminClient()`
2. Load report from `fb_reports` by id
3. Load sections from `fb_report_sections` WHERE report_id = id ORDER BY section_order ASC
4. Return `{ report, sections }`

**PATCH** /api/fb-reports/[id]:
1. `verifyAdmin()`
2. Parse body: `{ sectionId, content_markdown }`
3. Update `fb_report_sections` SET content_markdown, is_edited = true
4. Return `{ success: true }`

**DELETE** /api/fb-reports/[id]:
1. `verifyAdmin()`
2. Delete sections WHERE report_id (FK cascade should handle this, but explicit delete for safety)
3. Delete report
4. Return `{ success: true }`

Note: FB routes use simpler `verifyAdmin()` (not `verifyScopedAdminAccess()` — no demo user scope for FB module).

**Step 2: Verify TypeScript compiles**

**Step 3: Commit**

```bash
git add src/app/api/fb-reports/[id]/route.ts
git commit -m "feat: add GET/PATCH/DELETE /api/fb-reports/[id] — report detail CRUD"
```

---

## Task 6: Frontend — Reports List Page

**Files:**
- Rewrite: `src/app/(hub)/fb-analyzer/reports/page.tsx`

**Reference:** `src/app/(hub)/email-analyzer/reports/page.tsx` (adapt layout and form)

**Step 1: Rewrite page.tsx**

Replace empty state with full implementation:

**State:**
- `reports[]`, `isLoading`, `error`
- `showGenerate` (toggle form)
- `developers[]` (unique list from fb_groups)
- `selectedDeveloper`, `dateFrom`, `dateTo`
- `groups[]` (for selected developer), `excludedGroupIds` (Set)
- `isGenerating`, `generatingMessage`

**On mount:**
- `fetchReports()` — GET /api/fb-reports
- Fetch unique developers: GET /api/fb-groups → extract unique `developer` values

**Generate form (showGenerate === true):**
- Dropdown: developer (required)
- Date inputs: dateFrom, dateTo (required)
- When developer changes: load groups for that developer, show checkboxes (all checked by default)
- Checkboxes: list of groups with name, allow unchecking
- "Generuj" button

**handleGenerate():**
1. POST /api/fb-reports `{ developer, dateFrom, dateTo, excludeGroupIds }`
2. Get `{ reportId, totalSections }`
3. Polling loop: `while (hasMore)` → POST /api/fb-reports/process `{ reportId }` → update progress message
4. On complete: `router.push(/fb-analyzer/reports/${reportId})`

**Reports list:**
- Cards with title, date, developer badge, group count
- Delete button (with confirm)
- Click → navigate to detail

**Step 2: Verify in browser**

Start dev server. Navigate to /fb-analyzer/reports. Should show:
- Empty reports list (no reports yet)
- "Generuj raport" button → form with developer dropdown

**Step 3: Commit**

```bash
git add src/app/(hub)/fb-analyzer/reports/page.tsx
git commit -m "feat: FB reports list page with generate form, polling progress, and report history"
```

---

## Task 7: Frontend — Report Detail Page

**Files:**
- Create: `src/app/(hub)/fb-analyzer/reports/[id]/page.tsx`

**Reference:** `src/app/(hub)/email-analyzer/reports/[id]/page.tsx` (same structure)

**Step 1: Create report detail page**

Adapt email report detail page for FB:

**Header:**
- Title, developer name, date range, created date
- "Pobierz .docx" button (calls `exportReportToDocx()`)
- "Kopiuj raport" button (clipboard)
- "Powrót do raportów" link → `/fb-analyzer/reports`

**Table of Contents:**
- Collapsible, shows section titles grouped by group name + developer summary

**Sections:**
- Sorted by `section_order`
- Each section: title, content_markdown (ReactMarkdown + remarkGfm)
- Inline edit: click Edit icon → textarea → Save/Cancel
- Visual separators between groups

**Key differences from email:**
- Back link: `/fb-analyzer/reports` (not `/email-analyzer/reports`)
- No `mailbox` info — replaced with developer name
- No template_type/detail_level badges — FB reports don't have these variants

**Step 2: Verify in browser**

Navigate to a report detail page (after generating one). Should show:
- Header with report metadata
- TOC with sections
- Markdown rendered content
- Edit, copy, export buttons working

**Step 3: Commit**

```bash
git add src/app/(hub)/fb-analyzer/reports/[id]/page.tsx
git commit -m "feat: FB report detail page with TOC, inline edit, copy, and DOCX export"
```

---

## Task 8: Integration Verification

**Step 1: End-to-end test in browser**

Full flow:
1. Go to /fb-analyzer/reports
2. Click "Generuj raport"
3. Select developer (e.g., "Robyg"), set date range, optionally uncheck some groups
4. Click "Generuj" — watch progress
5. Redirected to report detail page
6. Verify: sections per group (3 each) + developer summary
7. Test: edit a section, save, verify persistence
8. Test: copy to clipboard
9. Test: export DOCX, open file, verify clickable links
10. Go back to list, verify report appears
11. Delete report, verify removed

**Step 2: Check for edge cases**
- Developer with 0 analyzed posts → should show error
- Empty date range → should show error
- All groups excluded → should show error

**Step 3: Final commit (if any fixes needed)**

```bash
git commit -m "fix: FB reports edge case fixes from integration testing"
```

---

## Execution Order & Dependencies

```
Task 1 (DB migration) ─────────────────────────┐
                                                 │
Task 2 (Synthesizer) ──────────┐                │
                                ├── Task 4 (Process API) ──┐
Task 3 (Create/List API) ──────┘                │          │
                                                 │          │
Task 5 (Detail CRUD API) ──────────────────────┤          │
                                                 │          │
                                                 ├── Task 6 (List page) ──┐
                                                 │                         ├── Task 8 (E2E verify)
                                                 └── Task 7 (Detail page) ┘
```

Tasks 1, 2, 3 can run in parallel.
Task 4 depends on 2 + 3.
Task 5 is independent.
Tasks 6-7 depend on all API tasks.
Task 8 is final verification.
