import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto/encrypt';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Kolumny do zwracania — NIGDY cookies_encrypted
const GROUP_SELECT_COLUMNS = 'id, name, facebook_url, developer, status, last_scraped_at, total_posts, ai_instruction, apify_actor_id, created_at, updated_at';

const SUPER_ADMIN_EMAIL = 'dariusz.ciesielski.71@gmail.com';

async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email || null;
}

/**
 * GET /api/fb-groups/[id]
 * Szczegoly grupy (bez soft-deleted). Wzbogacony o relevant_posts i has_custom_cookies.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('fb_groups')
    .select('id, name, facebook_url, developer, status, last_scraped_at, total_posts, ai_instruction, apify_actor_id, created_at, updated_at, cookies_encrypted')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Grupa nie znaleziona' }, { status: 404 });
  }

  const group = data as Record<string, unknown>;

  // Policz posty
  const { count } = await adminClient
    .from('fb_posts')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id);

  const { cookies_encrypted, ...rest } = group;

  return NextResponse.json({
    ...rest,
    relevant_posts: count ?? 0,
    has_custom_cookies: cookies_encrypted != null,
  });
}

/**
 * PATCH /api/fb-groups/[id]
 * Aktualizacja grupy. Dozwolone pola: name, facebook_url, developer, status, ai_instruction, cookies_encrypted.
 * Zmiana apify_actor_id wymaga super admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  // Sprawdz czy grupa istnieje i nie jest deleted
  const { data: existing } = await adminClient
    .from('fb_groups')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Grupa nie znaleziona' }, { status: 404 });
  }

  // Walidacja facebook_url jesli podany
  if (body.facebook_url !== undefined) {
    const url = body.facebook_url as string;
    try {
      const parsed = new URL(url);
      const isValid =
        (parsed.hostname === 'www.facebook.com' ||
          parsed.hostname === 'facebook.com' ||
          parsed.hostname === 'm.facebook.com') &&
        parsed.pathname.includes('/groups/');
      if (!isValid) {
        return NextResponse.json(
          { error: 'Wymagany prawidlowy URL grupy Facebook (facebook.com/groups/...)' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Wymagany prawidlowy URL grupy Facebook (facebook.com/groups/...)' },
        { status: 400 }
      );
    }
  }

  // apify_actor_id — super admin gate
  if (body.apify_actor_id !== undefined) {
    const email = await getCurrentUserEmail();
    if (email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Zmiana Actor ID wymaga uprawnien super admina' },
        { status: 403 }
      );
    }
  }

  // Buduj obiekt aktualizacji z dozwolonych pol
  const allowedFields = ['name', 'facebook_url', 'developer', 'status', 'ai_instruction', 'cookies_encrypted', 'apify_actor_id'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'cookies_encrypted') {
        // null -> usun override, string -> zaszyfruj
        if (body[field] === null) {
          updateData.cookies_encrypted = null;
        } else {
          try {
            updateData.cookies_encrypted = encrypt(body[field] as string);
          } catch (err) {
            console.error('Encryption error:', err);
            return NextResponse.json(
              { error: 'Blad szyfrowania danych. Sprawdz konfiguracje ENCRYPTION_KEY.' },
              { status: 500 }
            );
          }
        }
      } else {
        updateData[field] = body[field];
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Brak danych do aktualizacji' }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from('fb_groups')
    .update(updateData)
    .eq('id', id)
    .select(GROUP_SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/fb-groups/[id]
 * Soft delete — ustawia deleted_at na biezacy timestamp.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Sprawdz czy grupa istnieje i nie jest juz deleted
  const { data: existing } = await adminClient
    .from('fb_groups')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Grupa nie znaleziona' }, { status: 404 });
  }

  const { error } = await adminClient
    .from('fb_groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
