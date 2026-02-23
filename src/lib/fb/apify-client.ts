// Server-only — NIE importuj w komponentach klienckich
// Apify REST API v2 wrapper dla scraping engine (Phase 9)

import type {
  ApifyActorInput,
  ApifyRunState,
  ApifyRunStatusResponse,
  ApifyStatusAction,
} from '@/types/fb';

const APIFY_BASE = 'https://api.apify.com/v2';

// ---------------------------------------------------------------------------
// 1. Start Actor run
// POST /v2/acts/{actorId}/runs
// Auth: Authorization: Bearer {token}
// Body: actor input JSON
// Response: { data: { id, status, defaultDatasetId, statusMessage, ... } }
// ---------------------------------------------------------------------------
export async function startActorRun(
  token: string,
  actorId: string,
  input: ApifyActorInput,
): Promise<{ runId: string; datasetId: string }> {
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
    datasetId: json.data.defaultDatasetId,
  };
}

// ---------------------------------------------------------------------------
// 2. Get run status
// GET /v2/actor-runs/{runId}
// Auth: Authorization: Bearer {token}
// Response: { data: { id, status, statusMessage, defaultDatasetId, startedAt, finishedAt } }
// ---------------------------------------------------------------------------
export async function getRunStatus(
  token: string,
  runId: string,
): Promise<ApifyRunStatusResponse> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify status check failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.data;
}

// ---------------------------------------------------------------------------
// 3. Get dataset items
// GET /v2/datasets/{datasetId}/items?format=json&offset={offset}&limit={limit}
// Auth: Authorization: Bearer {token}
// UWAGA: response to BEZPOSREDNI JSON ARRAY (NIE opakowany w data!)
// Total z headera X-Apify-Pagination-Total
// ---------------------------------------------------------------------------
export async function getDatasetItems<T>(
  token: string,
  datasetId: string,
  offset = 0,
  limit = 1000,
): Promise<{ items: T[]; total: number }> {
  const url = `${APIFY_BASE}/datasets/${datasetId}/items?format=json&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify dataset fetch failed (${res.status}): ${text}`);
  }

  const items: T[] = await res.json(); // Direct JSON array!
  const total = parseInt(res.headers.get('X-Apify-Pagination-Total') || '0', 10);
  return { items, total };
}

// ---------------------------------------------------------------------------
// 4. Map Apify run status to action
// Mapuje WSZYSTKIE 8 statusow Apify na akcje wewnetrzne
// ---------------------------------------------------------------------------
export function mapApifyStatusToAction(status: ApifyRunState): ApifyStatusAction {
  switch (status) {
    case 'READY':
    case 'RUNNING':
    case 'TIMING-OUT':  // Nadal dziala, zbliza sie do timeoutu
    case 'ABORTING':    // W trakcie przerywania, czekaj na stan koncowy
      return 'keep_polling';
    case 'SUCCEEDED':
      return 'fetch_results';
    case 'FAILED':
    case 'TIMED-OUT':
    case 'ABORTED':
      return 'mark_failed';
  }
}

// ---------------------------------------------------------------------------
// 5. Format date for Apify (yyyy-M-dd, BEZ leading zero!)
// Apify Actor oczekuje formatu np. "2026-2-23" (nie "2026-02-23")
// ---------------------------------------------------------------------------
export function formatApifyDate(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
