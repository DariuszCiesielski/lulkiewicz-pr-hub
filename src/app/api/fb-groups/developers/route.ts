import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/fb-groups/developers
 * Zwraca posortowana liste unikalnych developerow (dla autosuggest).
 */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('fb_groups')
    .select('developer')
    .not('developer', 'is', null)
    .is('deleted_at', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplikacja i sortowanie w JS
  const developers = [...new Set(
    (data || []).map((r) => r.developer as string).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'pl'));

  return NextResponse.json(developers);
}
