import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto/encrypt';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

const SUPER_ADMIN_EMAIL = 'dariusz.ciesielski.71@gmail.com';
const DEFAULT_APIFY_ACTOR = 'curious_coder/facebook-post-scraper';

// Dozwolone prefiksy kluczy
const ENCRYPTED_KEYS = ['apify_token', 'fb_cookies'];
const SUPER_ADMIN_KEYS = ['apify_actor_id'];

async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email || null;
}

/**
 * GET /api/fb-settings
 * Zwraca flagi boolean (has_apify_token, has_fb_cookies), apify_actor_id
 * i developer_instructions. NIGDY nie zwraca value_encrypted.
 */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('fb_settings')
    .select('key, value_encrypted, value_plain');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = (data || []) as { key: string; value_encrypted: string | null; value_plain: string | null }[];

  // Buduj response — NIGDY nie zwracaj value_encrypted
  const apifyTokenRecord = settings.find((s) => s.key === 'apify_token');
  const fbCookiesRecord = settings.find((s) => s.key === 'fb_cookies');
  const actorIdRecord = settings.find((s) => s.key === 'apify_actor_id');

  // Zbierz developer_instructions
  const developerInstructions: Record<string, string> = {};
  for (const setting of settings) {
    if (setting.key.startsWith('developer_instruction:') && setting.value_plain) {
      const devName = setting.key.replace('developer_instruction:', '');
      developerInstructions[devName] = setting.value_plain;
    }
  }

  // Slowa kluczowe
  const fbKeywordsRecord = settings.find((s) => s.key === 'fb_keywords');
  let fbKeywords: string[] = [];
  if (fbKeywordsRecord?.value_plain) {
    try {
      fbKeywords = JSON.parse(fbKeywordsRecord.value_plain);
    } catch {
      fbKeywords = [];
    }
  }

  return NextResponse.json({
    has_apify_token: !!(apifyTokenRecord?.value_encrypted),
    has_fb_cookies: !!(fbCookiesRecord?.value_encrypted),
    apify_actor_id: actorIdRecord?.value_plain || DEFAULT_APIFY_ACTOR,
    developer_instructions: developerInstructions,
    fb_keywords: fbKeywords,
  });
}

/**
 * POST /api/fb-settings
 * Zapisuje ustawienie. Szyfruje apify_token i fb_cookies.
 * Body: { key: string, value: string }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { key?: string; value?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { key, value } = body;

  if (!key || value === undefined || value === null) {
    return NextResponse.json({ error: 'Klucz (key) i wartość (value) są wymagane' }, { status: 400 });
  }

  // Walidacja klucza
  const isEncryptedKey = ENCRYPTED_KEYS.includes(key);
  const isSuperAdminKey = SUPER_ADMIN_KEYS.includes(key);
  const isDeveloperInstruction = key.startsWith('developer_instruction:');
  const isFbKeywords = key === 'fb_keywords' || key.startsWith('fb_keywords:');

  if (!isEncryptedKey && !isSuperAdminKey && !isDeveloperInstruction && !isFbKeywords) {
    return NextResponse.json(
      { error: `Niedozwolony klucz: ${key}. Dozwolone: apify_token, fb_cookies, apify_actor_id, developer_instruction:*, fb_keywords, fb_keywords:*` },
      { status: 400 }
    );
  }

  // Super admin gate
  if (isSuperAdminKey) {
    const email = await getCurrentUserEmail();
    if (email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Zmiana tego ustawienia wymaga uprawnień super admina' },
        { status: 403 }
      );
    }
  }

  // Przygotuj dane do zapisu
  let valueEncrypted: string | null = null;
  let valuePlain: string | null = null;

  if (isEncryptedKey) {
    // Szyfruj wartosci wrażliwe
    try {
      valueEncrypted = encrypt(value);
    } catch (err) {
      console.error('Encryption error:', err);
      return NextResponse.json(
        { error: 'Błąd szyfrowania danych. Sprawdź konfigurację ENCRYPTION_KEY.' },
        { status: 500 }
      );
    }
  } else {
    // Zapisz jako plain text (apify_actor_id, developer_instruction:*)
    valuePlain = value;
  }

  // Upsert — wstaw lub aktualizuj
  const { error } = await adminClient
    .from('fb_settings')
    .upsert(
      {
        key,
        value_encrypted: valueEncrypted,
        value_plain: valuePlain,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
