# Phase D: Strona promptów profile-aware — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the `/email-analyzer/prompts` page profile-aware — dropdown to switch between "Global overrides" and specific analysis profiles, with per-profile prompt editing, focus fields, and seed-based reset.

**Architecture:** Extend existing `/api/prompts` route to accept optional `profileId` query param (GET) and `profile_id` body field (POST/DELETE). Profile mode reads `tier='profile'` rows directly from DB (no DEFAULT_PROMPTS merge). UI adds a dropdown at top of page to switch context, plus `synthetic_focus` / `standard_focus` fields visible only in profile mode.

**Tech Stack:** Next.js 16 App Router, Supabase (hosted), React 19, Tailwind CSS v4, TypeScript

**Design doc:** `docs/plans/2026-02-24-phase-d-prompts-profile-aware-design.md`

---

## Task 1: API — GET with profileId support

**Files:**
- Modify: `src/app/api/prompts/route.ts` (GET handler)

**Context:**
- Current GET returns global prompts merged with DEFAULT_PROMPTS.
- Profile prompts live in `prompt_templates` with `tier='profile'` and `profile_id=UUID`.
- DB has 20 seed rows: 14 for communication_audit (UUID `ddd18b04-1182-46d4-a798-e72326162a9e`), 6 for case_analytics (UUID `d8c037cc-7f2a-445c-b4f8-be16cc25d5f4`).

**Step 1: Add profileId query param handling to GET**

Change `GET()` signature to accept `request: NextRequest`. Add logic:
- Read `profileId` from `request.nextUrl.searchParams`
- If no profileId → existing behavior (unchanged)
- If profileId present → query `prompt_templates` WHERE `profile_id=UUID AND tier='profile' AND is_active=true`, order by `section_order ASC`
- Return `{ prompts }` with raw DB rows (include `synthetic_focus`, `standard_focus` fields)
- NO merge with DEFAULT_PROMPTS for profile mode

**Step 2: Add seed query support**

When `?profileId=UUID&seed=true&sectionKey=X`:
- Query: `SELECT * FROM prompt_templates WHERE profile_id=UUID AND section_key=X ORDER BY created_at ASC LIMIT 1`
- This returns the original seed row (may be `is_active=false` if user modified it)
- Return `{ seed: row }` (or `{ seed: null }` if not found)

**Step 3: Verify manually**

Run: `npm run build` (or just check TypeScript with `npx tsc --noEmit`)
Expected: No type errors in prompts/route.ts

**Step 4: Commit**

```bash
git add src/app/api/prompts/route.ts
git commit -m "feat(prompts): GET supports profileId query param + seed lookup"
```

---

## Task 2: API — POST with profile_id support

**Files:**
- Modify: `src/app/api/prompts/route.ts` (POST handler)

**Context:**
- Current POST always saves with `tier='global'`.
- Profile saves need `tier='profile'` + `profile_id=UUID`.
- Deactivation scope must include `profile_id` when saving profile prompts.

**Step 1: Extend POST body type**

Add optional fields to body type:
```ts
profile_id?: string;
synthetic_focus?: string;
standard_focus?: string;
```

**Step 2: Add profile-aware deactivation + insert**

- If `body.profile_id` present:
  - Deactivate: `.eq('section_key', body.section_key).eq('tier', 'profile').eq('profile_id', body.profile_id)`
  - Insert with: `tier: 'profile'`, `profile_id: body.profile_id`, plus `synthetic_focus` and `standard_focus`
- If no `body.profile_id`:
  - Existing behavior (tier='global', deactivate by section_key + tier='global')

**Step 3: Verify with build check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/api/prompts/route.ts
git commit -m "feat(prompts): POST supports profile_id + synthetic/standard focus"
```

---

## Task 3: API — DELETE with profile_id support

**Files:**
- Modify: `src/app/api/prompts/route.ts` (DELETE handler)

**Step 1: Extend DELETE body type**

Add optional `profile_id?: string` to body type.

**Step 2: Add profile-aware deletion**

- If `body.profile_id`:
  - `.eq('section_key', body.section_key).eq('tier', 'profile').eq('profile_id', body.profile_id)`
- If no `body.profile_id`:
  - Existing behavior

**Step 3: Commit**

```bash
git add src/app/api/prompts/route.ts
git commit -m "feat(prompts): DELETE supports profile_id"
```

---

## Task 4: UI — Profile dropdown + profile-aware fetch

**Files:**
- Modify: `src/app/(hub)/email-analyzer/prompts/page.tsx`

**Context:**
- Profiles come from `GET /api/analysis-profiles` (returns `{ profiles: [{ id, name, slug, ... }] }`)
- `selectedProfileId=''` means global mode, UUID means profile mode
- `PromptTemplate` interface needs `synthetic_focus` and `standard_focus` fields

**Step 1: Extend PromptTemplate interface**

Add to existing interface:
```ts
synthetic_focus?: string | null;
standard_focus?: string | null;
```

**Step 2: Add profile state + fetch profiles**

```ts
interface ProfileOption {
  id: string;
  name: string;
  slug: string;
}

const [profiles, setProfiles] = useState<ProfileOption[]>([]);
const [selectedProfileId, setSelectedProfileId] = useState<string>('');
```

Add `useEffect` to fetch profiles from `/api/analysis-profiles` on mount.

**Step 3: Make fetchPrompts profile-aware**

Change `fetchPrompts` to accept `selectedProfileId` in its dependency array:
```ts
const url = selectedProfileId
  ? `/api/prompts?profileId=${selectedProfileId}`
  : '/api/prompts';
```

Add `selectedProfileId` to `useCallback` deps. Re-fetch when profile changes.

**Step 4: Render dropdown**

Place dropdown between header and section list:
```
[▼ Profil: Globalne nadpisania    ]
         | Audyt komunikacji      |
         | Analityka spraw        |
```

Use native `<select>` styled with existing CSS vars. Options:
- `value=""` → "Globalne nadpisania"
- `value={profile.id}` → profile.name for each profile

On change: `setSelectedProfileId(value)`, reset `selectedIndex` to 0.

**Step 5: Commit**

```bash
git add src/app/(hub)/email-analyzer/prompts/page.tsx
git commit -m "feat(prompts): profile dropdown + profile-aware fetch"
```

---

## Task 5: UI — Profile-aware save, delete, copy, add

**Files:**
- Modify: `src/app/(hub)/email-analyzer/prompts/page.tsx`

**Step 1: Update handleSave**

When `selectedProfileId !== ''`:
- Add `profile_id: selectedProfileId` to POST body
- Add `synthetic_focus: editedPrompt.synthetic_focus` and `standard_focus: editedPrompt.standard_focus` to body

**Step 2: Update handleDelete**

When `selectedProfileId !== ''`:
- Add `profile_id: selectedProfileId` to DELETE body

**Step 3: Update handleCopy**

When `selectedProfileId !== ''`:
- Add `profile_id: selectedProfileId` to POST body

**Step 4: Update handleAddSection**

When `selectedProfileId !== ''`:
- Add `profile_id: selectedProfileId` to POST body
- Default `synthetic_focus` and `standard_focus` to empty string

**Step 5: Update handleReorder**

Both POST calls: add `profile_id: selectedProfileId || undefined`.

**Step 6: Update handleToggleReportType**

POST call: add `profile_id: selectedProfileId || undefined`.

**Step 7: Commit**

```bash
git add src/app/(hub)/email-analyzer/prompts/page.tsx
git commit -m "feat(prompts): profile-aware save/delete/copy/add/reorder"
```

---

## Task 6: UI — Focus fields in editor + profile badge

**Files:**
- Modify: `src/app/(hub)/email-analyzer/prompts/page.tsx`

**Step 1: Add focus fields to editor**

After "User prompt template" textarea, add (only when `selectedProfileId !== ''`):

```
--- (separator)
Focus — raport syntetyczny: [textarea, 3 rows]
Focus — raport standardowy: [textarea, 3 rows]
```

Both bind to `editedPrompt.synthetic_focus` / `editedPrompt.standard_focus`.
Style identically to existing textareas (border, bg, color from CSS vars).

**Step 2: Update badge logic**

Current badge: `'Domyślny'` or `'Zmodyfikowany'` based on tier.
- For profiles (`selectedProfileId !== ''`): always show `'Profilowy'` as badge
- For global (`selectedProfileId === ''`): keep existing behavior

**Step 3: Update isDefaultSection logic**

`isDefaultSection` currently determines if reset button shows. For profiles:
- Show reset for ALL profile sections (they all have seeds)
- Hide for custom sections added by user (no seed exists)

Detection: a section has a seed if it was created by the migration. We can check this by attempting the seed lookup on reset click, or simpler: show reset for all profile sections and handle "no seed found" gracefully.

**Step 4: Commit**

```bash
git add src/app/(hub)/email-analyzer/prompts/page.tsx
git commit -m "feat(prompts): focus fields + profile badge in editor"
```

---

## Task 7: UI — Seed-based reset for profile sections

**Files:**
- Modify: `src/app/(hub)/email-analyzer/prompts/page.tsx`

**Step 1: Update handleReset for profile mode**

When `selectedProfileId !== ''`:
1. Fetch seed: `GET /api/prompts?profileId=${selectedProfileId}&seed=true&sectionKey=${editedPrompt.section_key}`
2. If seed found → POST with seed content (system_prompt, user_prompt_template, title, synthetic_focus, standard_focus, section_order, in_internal_report, in_client_report) + `profile_id`
3. If no seed found → show error message: `'Brak oryginalnego seeda dla tej sekcji.'`

When `selectedProfileId === ''`:
- Existing behavior (reset to DEFAULT_PROMPTS) — no changes

**Step 2: Update reset button label**

- Global mode: "Resetuj do domyślnego"
- Profile mode: "Resetuj do seeda"

**Step 3: Commit**

```bash
git add src/app/(hub)/email-analyzer/prompts/page.tsx
git commit -m "feat(prompts): seed-based reset for profile sections"
```

---

## Task 8: Build verification + final commit

**Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Fix any type/build errors**

If errors found, fix them.

**Step 3: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix(prompts): build fixes for phase D"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | API GET + profileId + seed | route.ts |
| 2 | API POST + profile_id + focus | route.ts |
| 3 | API DELETE + profile_id | route.ts |
| 4 | UI dropdown + profile fetch | page.tsx |
| 5 | UI save/delete/copy/add profile-aware | page.tsx |
| 6 | UI focus fields + badge | page.tsx |
| 7 | UI seed-based reset | page.tsx |
| 8 | Build verification | — |

**Estimated commits:** 7-8
**Files modified:** 2 (route.ts + page.tsx)
