# CC Thread Filtering — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-mailbox CC filtering so threads where the mailbox is only in CC/BCC are excluded from AI analysis.

**Architecture:** Hybrid approach — thread-builder computes `cc_filter_status` flag on each thread, analysis routes filter based on this flag + mailbox `cc_filter_mode` setting. UI exposes a select field with auto-defaults based on analysis profile.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL), React (MailboxForm component), TypeScript types

**Design doc:** `docs/plans/2026-02-24-cc-thread-filtering-design.md`

---

### Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/20260224_cc_thread_filtering.sql`

**Step 1: Write the migration**

```sql
-- CC Thread Filtering: per-mailbox filtering of CC-only threads from analysis

-- 1. Add cc_filter_status to email_threads
ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS cc_filter_status TEXT NOT NULL DEFAULT 'unknown';

-- 2. Add cc_filter_mode to mailboxes
ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS cc_filter_mode TEXT NOT NULL DEFAULT 'off';

-- 3. Set default cc_filter_mode based on analysis_profile for existing mailboxes
UPDATE mailboxes
  SET cc_filter_mode = 'never_in_to'
  WHERE analysis_profile = 'case_analytics';

-- 4. Index for filtering in analysis queries
CREATE INDEX IF NOT EXISTS idx_email_threads_cc_filter_status
  ON email_threads(cc_filter_status);
```

**Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via Supabase Management API if CLI is broken — see existing migration headers for pattern)

**Step 3: Commit**

```bash
git add supabase/migrations/20260224_cc_thread_filtering.sql
git commit -m "feat: add cc_filter_status and cc_filter_mode columns"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/email.ts`

**Step 1: Add new types and extend interfaces**

Add after line 13 (after `AnalysisProfileId`):

```ts
export type CcFilterMode = 'off' | 'never_in_to' | 'first_email_cc';
export type CcFilterStatus = 'direct' | 'cc_first_only' | 'cc_always' | 'unknown';
```

Add `cc_filter_mode` to `Mailbox` interface (after `analysis_profile` field, line 29):

```ts
  cc_filter_mode: CcFilterMode;
```

Add `cc_filter_status` to `EmailThread` interface (after `status` field, line 109):

```ts
  cc_filter_status: CcFilterStatus;
```

Add `cc_filter_mode` to `MailboxFormData` interface (after `analysis_profile` field, line 133):

```ts
  cc_filter_mode: CcFilterMode;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Errors in files that now need to handle the new field (MailboxForm, API routes). These will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add src/types/email.ts
git commit -m "feat: add CcFilterMode and CcFilterStatus types"
```

---

### Task 3: Thread Builder — compute cc_filter_status

**Files:**
- Modify: `src/lib/threading/thread-builder.ts`

**Step 1: Add to_addresses to RawEmail interface and SELECT query**

In the `RawEmail` interface (line 79), add field:

```ts
  to_addresses: { address: string; name: string }[] | null;
```

In the SELECT query (line 254), add `to_addresses` to the select string:

```ts
  .select('id, mailbox_id, subject, from_address, from_name, sent_at, received_at, body_text, header_message_id, header_in_reply_to, header_references, to_addresses')
```

**Step 2: Add computeCcFilterStatus function**

Add before the `buildThreadsForMailbox` function (before line 240):

```ts
// --- CC filter status computation ---

export type CcFilterStatusValue = 'direct' | 'cc_first_only' | 'cc_always';

/**
 * Determine if the mailbox is a direct recipient (To) or only CC/BCC in this thread.
 *
 * - 'direct': mailbox appears in To field in at least one email, including the first
 * - 'cc_first_only': first email has mailbox in CC/BCC only, but later emails have it in To
 * - 'cc_always': mailbox never appears in To field in any email
 */
export function computeCcFilterStatus(
  emails: RawEmail[],
  mailboxEmail: string
): CcFilterStatusValue {
  const mailboxAddr = mailboxEmail.toLowerCase();

  const firstEmailHasTo = emails[0]?.to_addresses
    ?.some((r) => r.address.toLowerCase() === mailboxAddr) ?? false;

  const anyEmailHasTo = emails.some(
    (e) => e.to_addresses?.some((r) => r.address.toLowerCase() === mailboxAddr) ?? false
  );

  if (anyEmailHasTo && firstEmailHasTo) return 'direct';
  if (anyEmailHasTo && !firstEmailHasTo) return 'cc_first_only';
  return 'cc_always';
}
```

**Step 3: Use computeCcFilterStatus in thread row construction**

In the thread metadata loop (around line 436, inside `threadRows.push`), add the `cc_filter_status` field. Find this block:

```ts
    threadRows.push({
      mailbox_id: mailboxId,
      subject_normalized: group.subjectNormalized || '(brak tematu)',
      // ...existing fields...
      avg_response_time_minutes: avgResponseTime,
    });
```

Add `cc_filter_status` to the object:

```ts
      cc_filter_status: computeCcFilterStatus(group.emails, mailboxEmail),
```

Also add `cc_filter_status` to the `ThreadRow` interface (around line 374):

```ts
    cc_filter_status: string;
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/lib/threading/thread-builder.ts
git commit -m "feat: compute cc_filter_status in thread builder"
```

---

### Task 4: Analysis Routes — CC filtering

**Files:**
- Modify: `src/app/api/analysis/route.ts`
- Modify: `src/app/api/analysis/process/route.ts`

**Step 4a: Helper function for building CC filter query**

Add to `src/app/api/analysis/route.ts` (or inline — small enough to inline in both files).

The CC filter logic is the same in both routes, so define it inline in each:

```ts
// Apply CC filter to thread query based on mailbox setting
function applyCcFilter(query: any, ccFilterMode: string | null) {
  if (ccFilterMode === 'never_in_to') {
    return query.neq('cc_filter_status', 'cc_always');
  }
  if (ccFilterMode === 'first_email_cc') {
    return query.eq('cc_filter_status', 'direct');
  }
  return query; // 'off' or null — no filtering
}
```

**Step 4b: Modify POST /api/analysis (job creation) — `route.ts`**

In `src/app/api/analysis/route.ts`, the POST handler already loads mailbox data (line 138-143). Extend the select to include `cc_filter_mode`:

```ts
  const { data: mailbox } = await adminClient
    .from('mailboxes')
    .select('analysis_profile, cc_filter_mode')
    .eq('id', body.mailboxId)
    .single();
```

Then apply the filter to the thread count query (after line 164, before `const { count: totalThreads }`):

```ts
  threadQuery = applyCcFilter(threadQuery, mailbox?.cc_filter_mode);
```

**Step 4c: Modify POST /api/analysis/process (processing) — `process/route.ts`**

In `src/app/api/analysis/process/route.ts`, load mailbox `cc_filter_mode`. After loading the job (line 51-59), add:

```ts
  // Load mailbox cc_filter_mode
  const { data: mailboxData } = await adminClient
    .from('mailboxes')
    .select('cc_filter_mode')
    .eq('id', job.mailbox_id)
    .single();
```

Then in the thread query (line 117-125), add `cc_filter_status` to select and apply the filter:

```ts
    let threadQuery = adminClient
      .from('email_threads')
      .select('id, subject_normalized, mailbox_id, cc_filter_status')
      .eq('mailbox_id', job.mailbox_id);

    if (job.date_range_from) threadQuery = threadQuery.gte('first_message_at', job.date_range_from);
    if (job.date_range_to) threadQuery = threadQuery.lte('last_message_at', job.date_range_to);

    // Apply CC filter
    if (mailboxData?.cc_filter_mode === 'never_in_to') {
      threadQuery = threadQuery.neq('cc_filter_status', 'cc_always');
    } else if (mailboxData?.cc_filter_mode === 'first_email_cc') {
      threadQuery = threadQuery.eq('cc_filter_status', 'direct');
    }
```

**Step 4d: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4e: Commit**

```bash
git add src/app/api/analysis/route.ts src/app/api/analysis/process/route.ts
git commit -m "feat: filter CC-only threads from analysis"
```

---

### Task 5: Mailbox API — handle cc_filter_mode in CRUD

**Files:**
- Modify: `src/app/api/mailboxes/route.ts`
- Modify: `src/app/api/mailboxes/[id]/route.ts`

**Step 5a: Add cc_filter_mode to SELECT columns**

In BOTH files, update `MAILBOX_SELECT_COLUMNS` to include `cc_filter_mode`:

```ts
const MAILBOX_SELECT_COLUMNS = 'id, email_address, display_name, connection_type, tenant_id, client_id, sync_status, last_sync_at, total_emails, delta_link, created_at, updated_at, connection_tested_at, connection_test_ok, analysis_profile, cc_filter_mode';
```

**Step 5b: POST handler (create) — `route.ts`**

Add `cc_filter_mode` to body type (line 61-71):

```ts
    cc_filter_mode?: string;
```

Add to destructuring (line 79-89):

```ts
    cc_filter_mode,
```

Add to insert object (line 166-181). Resolve default based on profile:

```ts
      cc_filter_mode: cc_filter_mode || (analysis_profile === 'case_analytics' ? 'never_in_to' : 'off'),
```

**Step 5c: PATCH handler (update) — `[id]/route.ts`**

Add `cc_filter_mode` to body type (line 55-65):

```ts
    cc_filter_mode?: string;
```

Add to update builder (after line 115):

```ts
  if (body.cc_filter_mode !== undefined) update.cc_filter_mode = body.cc_filter_mode;
```

**Step 5d: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5e: Commit**

```bash
git add src/app/api/mailboxes/route.ts src/app/api/mailboxes/\[id\]/route.ts
git commit -m "feat: handle cc_filter_mode in mailbox CRUD"
```

---

### Task 6: UI — MailboxForm cc_filter_mode field

**Files:**
- Modify: `src/components/email/MailboxForm.tsx`

**Step 6a: Add MailboxEditData field**

In the `MailboxEditData` interface (line 8-16), add:

```ts
  cc_filter_mode: CcFilterMode;
```

Update the import at top to include `CcFilterMode`:

```ts
import type { ConnectionType, AnalysisProfileId, CcFilterMode, MailboxFormData } from '@/types/email';
```

**Step 6b: Add state and auto-default logic**

Add state after `analysisProfile` state (around line 38):

```ts
  const [ccFilterMode, setCcFilterMode] = useState<CcFilterMode>(
    initialData?.cc_filter_mode ?? (initialData?.analysis_profile === 'case_analytics' ? 'never_in_to' : 'off')
  );
```

Add auto-default handler — when `analysisProfile` changes, update `ccFilterMode` (only if user hasn't manually changed it). Simplest approach: always auto-set on profile change:

```ts
  const handleProfileChange = (newProfile: AnalysisProfileId) => {
    setAnalysisProfile(newProfile);
    setCcFilterMode(newProfile === 'case_analytics' ? 'never_in_to' : 'off');
  };
```

Update the profile `<select>` onChange to use this handler:

```tsx
  onChange={(e) => handleProfileChange(e.target.value as AnalysisProfileId)}
```

**Step 6c: Add cc_filter_mode to form submission**

In `handleSubmit` (line 50), add `cc_filter_mode` to the onSubmit data:

```ts
        cc_filter_mode: ccFilterMode,
```

**Step 6d: Add the select field in the JSX**

After the analysis profile section (after closing `</div>` of the profile block, around line 220), add:

```tsx
          {/* CC filter mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Filtrowanie watkow CC
            </label>
            <select
              value={ccFilterMode}
              onChange={(e) => setCcFilterMode(e.target.value as CcFilterMode)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="off">Wylaczone</option>
              <option value="never_in_to">Pomin — nigdy w polu &quot;Do&quot;</option>
              <option value="first_email_cc">Pomin — pierwszy mail jako DW</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Pomijaj watki, w ktorych skrzynka jest tylko odbiorca DW/UDW. Przydatne dla skrzynek rzecznikow.
            </p>
          </div>
```

**Step 6e: Verify build compiles**

Run: `npx next build 2>&1 | tail -20` (or `npx tsc --noEmit`)

**Step 6f: Commit**

```bash
git add src/components/email/MailboxForm.tsx
git commit -m "feat: add CC filter mode select to MailboxForm"
```

---

### Task 7: Mock Data — add CC-only thread for Rzecznik Robyg

**Files:**
- Modify: `src/lib/mock/seed-emails.ts`
- Modify: `src/lib/mock/seed-mailboxes.ts`

**Step 7a: Add cc_filter_mode to mock mailboxes**

In `src/lib/mock/seed-mailboxes.ts`, add `cc_filter_mode` to the `MockMailbox` interface and data:

- Royal Residence: `cc_filter_mode: 'off'`
- Sady Ursynow: `cc_filter_mode: 'off'`
- Rzecznik Robyg: `cc_filter_mode: 'never_in_to'`

**Step 7b: Add at least one CC-only thread to Robyg mock emails**

In `src/lib/mock/seed-emails.ts`, add a new thread where `rzecznik@demo-developer.example` is in `cc_addresses` but NOT in `to_addresses` in any email. This creates a test case for the CC filtering. The thread should have 2-3 emails with `to_addresses` pointing to other parties and `cc_addresses` containing the rzecznik.

**Step 7c: Commit**

```bash
git add src/lib/mock/seed-emails.ts src/lib/mock/seed-mailboxes.ts
git commit -m "feat: add cc_filter_mode to mock data with CC-only thread"
```

---

### Task 8: Manual Verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Verify MailboxForm**

- Navigate to mailbox management page
- Edit Rzecznik Robyg mailbox — verify `cc_filter_mode` field shows `Pomin — nigdy w polu "Do"`
- Change profile to `communication_audit` — verify cc_filter_mode auto-changes to `Wylaczone`
- Change back to `case_analytics` — verify cc_filter_mode auto-changes to `Pomin — nigdy w polu "Do"`

**Step 3: Verify thread builder sets cc_filter_status**

- Trigger thread rebuild for a mailbox
- Check in Supabase Studio that `email_threads.cc_filter_status` is populated (`direct`, `cc_first_only`, or `cc_always`)

**Step 4: Verify analysis filtering**

- Start analysis for Rzecznik Robyg
- Verify that CC-only threads (if any exist in mock data) are excluded from `total_threads` count

**Step 5: Commit final verification notes to STATE.md if applicable**
