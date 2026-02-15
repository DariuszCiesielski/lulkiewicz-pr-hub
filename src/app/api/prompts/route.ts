import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS, CLIENT_REPORT_SECTIONS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/** GET /api/prompts — list all prompts (merges defaults with DB overrides + custom sections) */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

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

  // Start with default prompts (merged with DB overrides)
  const mergedDefaults = DEFAULT_PROMPTS.map((def) => {
    const override = globalOverrides.get(def.section_key);
    if (override) {
      globalOverrides.delete(def.section_key); // Mark as consumed
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

  // Add any custom sections from DB that are NOT default overrides
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

/** POST /api/prompts — create or update a global prompt override */
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

  // Deactivate existing global override for this section
  await adminClient
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('section_key', body.section_key)
    .eq('tier', 'global');

  // Insert new
  const { data, error } = await adminClient
    .from('prompt_templates')
    .insert({
      section_key: body.section_key,
      tier: 'global',
      title: body.title,
      system_prompt: body.system_prompt,
      user_prompt_template: body.user_prompt_template,
      section_order: body.section_order || 0,
      is_active: true,
      in_internal_report: body.in_internal_report ?? true,
      in_client_report: body.in_client_report ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompt: data });
}

/** DELETE /api/prompts — soft delete a prompt section (is_active=false) */
export async function DELETE(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 });
  }

  let body: { section_key: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidlowy format danych' }, { status: 400 });
  }

  if (!body.section_key) {
    return NextResponse.json({ error: 'section_key jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Soft delete: set is_active=false for all entries with this section_key
  const { error } = await adminClient
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('section_key', body.section_key)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
