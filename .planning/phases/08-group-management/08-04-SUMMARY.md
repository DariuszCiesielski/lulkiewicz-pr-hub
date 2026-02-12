---
phase: 08
plan: 04
subsystem: fb-analyzer-settings
tags: [settings-ui, apify, encryption, super-admin, ai-instructions]
depends_on:
  requires: ["08-01", "08-02"]
  provides: ["Settings UI for Apify token, FB cookies, Actor ID, AI instructions"]
  affects: ["09-scraping-engine"]
tech-stack:
  added: []
  patterns: ["per-section save", "dual input mode (text/file)", "super admin gate", "status badges (boolean flags)"]
key-files:
  created:
    - src/components/fb/SettingsForm.tsx
  modified:
    - src/app/(hub)/fb-analyzer/settings/page.tsx
decisions:
  - id: "settings-per-section-save"
    description: "Each settings card saves independently (not one global save button)"
  - id: "cookies-dual-input"
    description: "FB cookies support both paste-text and file-upload modes"
  - id: "page-wrapper-pattern"
    description: "Settings page is thin wrapper (20 lines), all logic in SettingsForm component"
metrics:
  duration: "~5 min"
  completed: "2026-02-12"
---

# Phase 08 Plan 04: Settings UI Summary

**SettingsForm component with 4 cards: Apify token (encrypted), FB cookies (encrypted, dual input), Actor ID (super admin only), developer AI instructions (dynamic per developer)**

## What Was Done

### Task 1: SettingsForm + settings page

**SettingsForm.tsx (529 lines)** -- full settings form with 4 cards:

1. **Apify API Token** -- password input, StatusBadge (Skonfigurowany/Nieskonfigurowany), saves encrypted via POST /api/fb-settings
2. **Facebook Cookies** -- dual input mode (paste text / upload .json/.txt file), StatusBadge, warning about dedicated FB account, saves encrypted
3. **Apify Actor (super admin only)** -- visible only when `user.email === SUPER_ADMIN_EMAIL`, editable Actor ID
4. **Developer AI Instructions** -- dynamically renders textarea per developer from /api/fb-groups/developers, each with independent save button

**settings/page.tsx (20 lines)** -- thin wrapper replacing shell, renders Cog icon + title + SettingsForm

**Key implementation details:**
- `fetchSettings()` calls `Promise.all([/api/fb-settings, /api/fb-groups/developers])` on mount
- `saveSetting(key, value)` POSTs to /api/fb-settings, re-fetches after save to update flags
- Success messages auto-dismiss after 3s via setTimeout (cleaned up on unmount)
- DeveloperInstructionField sub-component with local state + sync from parent on re-fetch
- StatusBadge sub-component for Skonfigurowany/Nieskonfigurowany display
- All styling via CSS variables (--text-primary, --bg-secondary, --border-primary, --accent-primary)
- Token and cookies values NEVER displayed -- only boolean flags

## Commits

| Hash | Message |
|------|---------|
| b1211a3 | feat(08-04): settings UI with Apify token, FB cookies, Actor ID, AI instructions |

## Deviations from Plan

### Minor Adjustments

**1. Page wrapper is 20 lines (plan suggested 60 min_lines)**
- Plan's min_lines artifact was based on the shell page which had all logic inline
- Correct architecture: thin page wrapper + SettingsForm component (529 lines)
- No functional impact -- all required functionality is present in SettingsForm

## Verification Results

- [x] settings/page.tsx replaces shell (zero mock data)
- [x] SettingsForm loads data from /api/fb-settings
- [x] Apify token saved as encrypted (POST /api/fb-settings)
- [x] FB cookies: 2 input modes (paste text + file upload), saved encrypted
- [x] Actor ID visible ONLY for super admin
- [x] AI instructions per developer -- dynamically generated from developers list
- [x] Status badges: Skonfigurowany/Nieskonfigurowany (never displays values)
- [x] Warning about dedicated FB account
- [x] CSS variables pattern (zero hardcoded colors)
- [x] `npx tsc --noEmit` passes (only error is from parallel 08-03 plan's missing import)

## Success Criteria Met

1. Admin can configure Apify token and FB cookies -- data is encrypted
2. Admin sees configuration status (Skonfigurowany/Nieskonfigurowany)
3. Super admin can change Actor ID
4. Admin can set default AI instructions per developer
