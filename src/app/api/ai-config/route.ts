import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto/encrypt';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const { data } = await getAdminClient()
    .from('app_allowed_users')
    .select('role')
    .eq('email', user.email)
    .single();

  return data?.role === 'admin';
}

/** GET /api/ai-config — get active AI configuration (without API key) */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { data, error } = await getAdminClient()
    .from('ai_config')
    .select('id, provider, model, temperature, max_tokens, is_active, created_at, updated_at')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({ config: { ...data, has_api_key: true } });
}

/** POST /api/ai-config — create or update AI configuration */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: {
    provider?: string;
    api_key?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Deactivate existing configs
  await adminClient
    .from('ai_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Encrypt API key
  const encryptedKey = body.api_key ? encrypt(body.api_key) : null;

  // Insert new config
  const { data, error } = await adminClient
    .from('ai_config')
    .insert({
      provider: body.provider || 'openai',
      api_key_encrypted: encryptedKey,
      model: body.model || 'gpt-4o-mini',
      temperature: body.temperature ?? 0.3,
      max_tokens: body.max_tokens ?? 4096,
      is_active: true,
    })
    .select('id, provider, model, temperature, max_tokens, is_active')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data });
}
