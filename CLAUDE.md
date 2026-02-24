# Lulkiewicz PR Hub

Hub narzędziowy agencji PR. 2 moduły: Email Analyzer (audyt komunikacji administracji osiedli) + FB Analyzer (monitoring grup FB).
Next.js 16 App Router + Supabase (hosted) + Tailwind v4. Język UI: polski. Kod: angielski.

## Architektura

- **API routes**: każdy route używa `verifyScopedAdminAccess()` + `getAdminClient()` z `src/lib/api/admin.ts`
- **Polling pattern**: Długie operacje (analiza AI, sync email, scrape FB) przez polling:
  hook → POST /api/.../process → batch N items → {hasMore, status} → poll again
- **AI Provider**: `src/lib/ai/ai-provider.ts` — callAI() z 240s abort timeout (Vercel Pro limit 300s)
- **Analysis Profiles**: `src/lib/ai/analysis-profiles.ts` — per-mailbox (communication_audit | case_analytics)

## Kluczowe pliki

| Obszar | Plik |
|--------|------|
| Polling email | src/hooks/useAnalysisJob.ts (retry 3x, backoff 2s→4s→8s) |
| Polling FB | src/hooks/useFbAnalysisJob.ts |
| Polling sync | src/hooks/useSyncJob.ts |
| AI calls | src/lib/ai/ai-provider.ts — loadAIConfig() + callAI() |
| Profile registry | src/lib/ai/analysis-profiles.ts |
| Prompty domyślne | src/lib/ai/default-prompts.ts (13 sekcji communication_audit) |
| Prompty case | src/lib/ai/profiles/case-analytics-prompts.ts |
| Typy | src/types/email.ts — AnalysisProfileId, główne typy |
| Stan projektu | .planning/STATE.md |
| Handoffy | docs/HANDOFF-*.md |

## Konwencje

- Status DB: TEXT z CHECK constraint (nie enum)
- Supabase: brak generated types → `Record<string, unknown>` cast
- `getAdminClient()` lazy init — NIGDY top-level (Vercel cold start crash)
- Upsert ON CONFLICT dla deduplikacji (emails, fb_posts)
- `Promise.allSettled` dla batch processing — error per-item logowany, NIE failuje joba
- Migracje SQL via Supabase Dashboard/Management API — pliki w supabase/migrations/ jako docs

## Gotchas

- Vercel Pro: 300s limit → AI timeout 240s (60s bufor)
- PostgREST default: 1000 rows → zawsze `.limit(10000)` przy dużych queries
- Polling hooks: network error → retry z backoff; HTTP 4xx/5xx → stop + pokaż błąd
- Supabase CLI: BROKEN — migracje przez Dashboard lub Management API

## Debugowanie

- Supabase REST bezpośrednio: `curl "${SUPABASE_URL}/rest/v1/{table}?select=..." -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"` (klucze w .env.local)
- Job utknął w 'processing': auto-resume przy reload strony (useEffect w analyze/page.tsx)
- Logi AI: console.error w process routes → terminal dev servera

## Stan projektu

- v1.0 Email Analyzer: COMPLETE (fazy 1-6 + 2.1 + 2.2 + Analysis Profiles v2)
- v1.1 FB Analyzer: 87% (fazy 7-10 COMPLETE, 11-12 pending)
- Infrastruktura: GitHub → Vercel Pro auto-deploy, Supabase eu-north-1
