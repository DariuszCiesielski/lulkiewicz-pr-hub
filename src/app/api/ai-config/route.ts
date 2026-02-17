import { NextRequest, NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto/encrypt';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * Mask an API key for safe display: first 6 chars + "..." + last 4 chars.
 * Short keys (<=10 chars) show first 3 + "..." + last 2.
 */
function maskApiKey(key: string): string {
  if (key.length <= 10) {
    return key.slice(0, 3) + '...' + key.slice(-2);
  }
  return key.slice(0, 6) + '...' + key.slice(-4);
}

/** GET /api/ai-config — get active AI configuration with masked API key preview */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const { data, error } = await getAdminClient()
    .from('ai_config')
    .select('id, provider, model, temperature, max_tokens, api_key_encrypted, is_active, created_at, updated_at')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ config: null });
  }

  let apiKeyPreview: string | null = null;
  const hasApiKey = !!data.api_key_encrypted;

  if (data.api_key_encrypted) {
    try {
      const decrypted = decrypt(data.api_key_encrypted as string);
      apiKeyPreview = maskApiKey(decrypted);
    } catch {
      // Decryption failed — key exists but cannot be previewed
      apiKeyPreview = null;
    }
  }

  // Remove encrypted key from response
  const { api_key_encrypted: _, ...safeData } = data;

  return NextResponse.json({
    config: {
      ...safeData,
      has_api_key: hasApiKey,
      api_key_preview: apiKeyPreview,
    },
  });
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

  // Load existing config to preserve API key if not provided
  const { data: existing } = await adminClient
    .from('ai_config')
    .select('api_key_encrypted')
    .eq('is_active', true)
    .single();

  // Deactivate existing configs
  await adminClient
    .from('ai_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Encrypt new API key, or preserve existing one
  const encryptedKey = body.api_key
    ? encrypt(body.api_key)
    : (existing?.api_key_encrypted as string) || null;

  // Insert new config
  const { data, error } = await adminClient
    .from('ai_config')
    .insert({
      provider: body.provider || 'openai',
      api_key_encrypted: encryptedKey,
      model: body.model || 'gpt-5.2',
      temperature: body.temperature ?? 0.3,
      max_tokens: body.max_tokens ?? 16384,
      is_active: true,
    })
    .select('id, provider, model, temperature, max_tokens, is_active')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data });
}
