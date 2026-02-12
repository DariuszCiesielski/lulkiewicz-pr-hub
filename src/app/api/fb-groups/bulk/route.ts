import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

type BulkAction = 'set_status' | 'set_developer' | 'soft_delete';

/**
 * PATCH /api/fb-groups/bulk
 * Operacje masowe na grupach: zmiana statusu, dewelopera lub soft delete.
 * Body: { ids: string[], action: BulkAction, value?: string }
 */
export async function PATCH(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { ids?: string[]; action?: BulkAction; value?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  const { ids, action, value } = body;

  // Walidacja
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Lista identyfikatorow (ids) jest wymagana' }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: 'Akcja (action) jest wymagana' }, { status: 400 });
  }

  const validActions: BulkAction[] = ['set_status', 'set_developer', 'soft_delete'];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Nieprawidlowa akcja. Dozwolone: ${validActions.join(', ')}` },
      { status: 400 }
    );
  }

  let error;

  switch (action) {
    case 'set_status': {
      if (value !== 'active' && value !== 'paused') {
        return NextResponse.json(
          { error: 'Wartosc statusu musi byc "active" lub "paused"' },
          { status: 400 }
        );
      }
      ({ error } = await adminClient
        .from('fb_groups')
        .update({ status: value })
        .in('id', ids)
        .is('deleted_at', null));
      break;
    }

    case 'set_developer': {
      ({ error } = await adminClient
        .from('fb_groups')
        .update({ developer: value || null })
        .in('id', ids)
        .is('deleted_at', null));
      break;
    }

    case 'soft_delete': {
      ({ error } = await adminClient
        .from('fb_groups')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
        .is('deleted_at', null));
      break;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: ids.length });
}
