import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/**
 * GET /api/prompts — list prompts.
 *
 * Without ?profileId: legacy behavior — merges DEFAULT_PROMPTS with tier='global' DB overrides.
 * With ?profileId=<uuid>: returns tier='profile' sections for that profile.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  const profileId = request.nextUrl.searchParams.get('profileId');
  const seed = request.nextUrl.searchParams.get('seed') === 'true';
  const sectionKey = request.nextUrl.searchParams.get('sectionKey');

  if (profileId && seed && sectionKey) {
    return getSeedPrompt(profileId, sectionKey);
  }

  if (profileId) {
    return getProfilePrompts(profileId);
  }

  return getLegacyPrompts();
}

/** Seed lookup: oldest row for section_key + profile_id (original migration seed) */
async function getSeedPrompt(profileId: string, sectionKey: string) {
  const { data, error } = await getAdminClient()
    .from('prompt_templates')
    .select('*')
    .eq('profile_id', profileId)
    .eq('section_key', sectionKey)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ seed: null });
  }

  return NextResponse.json({ seed: data });
}

/** Profile-scoped: tier='profile' sections for a given profile_id */
async function getProfilePrompts(profileId: string) {
  const { data, error } = await getAdminClient()
    .from('prompt_templates')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tier', 'profile')
    .eq('is_active', true)
    .order('section_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompts: data || [] });
}

/** Legacy: DEFAULT_PROMPTS merged with tier='global' DB overrides */
async function getLegacyPrompts() {
  const { data: dbPrompts } = await getAdminClient()
    .from('prompt_templates')
    .select('*')
    .eq('is_active', true)
    .order('section_order', { ascending: true });

  // Merge: DB global overrides > defaults
  const globalOverrides = new Map(
    (dbPrompts || [])
      .filter((p: Record<string, unknown>) => p.tier === 'global')
      .map((p: Record<string, unknown>) => [p.section_key as string, p])
  );

  const mergedDefaults = DEFAULT_PROMPTS.map((def) => {
    const override = globalOverrides.get(def.section_key);
    if (override) {
      globalOverrides.delete(def.section_key);
      return override;
    }
    return {
      id: null,
      ...def,
      tier: 'default',
      is_active: true,
      in_internal_report: true,
      in_client_report: CLIENT_REPORT_SECTIONS.includes(def.section_key),
    };
  });

  const customSections = (dbPrompts || []).filter(
    (p: Record<string, unknown>) =>
      p.tier === 'global' &&
      !DEFAULT_PROMPTS.some((d) => d.section_key === p.section_key)
  );

  const prompts = [...mergedDefaults, ...customSections].sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.section_order as number) || 0) - ((b.section_order as number) || 0)
  );

  return NextResponse.json({ prompts });
}

/**
 * POST /api/prompts — create or update a prompt section.
 *
 * Without profileId in body: legacy tier='global' upsert.
 * With profileId: tier='profile' upsert scoped to that profile.
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  let body: {
    section_key: string;
    title: string;
    system_prompt: string;
    user_prompt_template: string;
    section_order?: number;
    in_internal_report?: boolean;
    in_client_report?: boolean;
    profileId?: string;
    synthetic_focus?: string | null;
    standard_focus?: string | null;
    model?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  if (!body.section_key) {
    return NextResponse.json({ error: 'section_key jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const tier = body.profileId ? 'profile' : 'global';

  // Deactivate existing entry for this section_key + tier + profile
  const deactivateQuery = adminClient
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('section_key', body.section_key)
    .eq('tier', tier);

  if (body.profileId) {
    deactivateQuery.eq('profile_id', body.profileId);
  }

  await deactivateQuery;

  // Build insert row
  const insertRow: Record<string, unknown> = {
    section_key: body.section_key,
    tier,
    title: body.title,
    system_prompt: body.system_prompt,
    user_prompt_template: body.user_prompt_template,
    section_order: body.section_order || 0,
    is_active: true,
    in_internal_report: body.in_internal_report ?? true,
    in_client_report: body.in_client_report ?? false,
  };

  if (body.profileId) {
    insertRow.profile_id = body.profileId;
    insertRow.synthetic_focus = body.synthetic_focus ?? null;
    insertRow.standard_focus = body.standard_focus ?? null;
    insertRow.model = body.model ?? null;
    insertRow.temperature = body.temperature ?? null;
    insertRow.max_tokens = body.max_tokens ?? null;
  }

  const { data, error } = await adminClient
    .from('prompt_templates')
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompt: data });
}

/**
 * DELETE /api/prompts — soft delete a prompt section (is_active=false).
 *
 * Without profileId in body: legacy tier='global' delete.
 * With profileId: tier='profile' delete scoped to that profile.
 */
export async function DELETE(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  let body: { section_key: string; profileId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  if (!body.section_key) {
    return NextResponse.json({ error: 'section_key jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  const query = adminClient
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('section_key', body.section_key)
    .eq('is_active', true);

  if (body.profileId) {
    query.eq('profile_id', body.profileId).eq('tier', 'profile');
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
