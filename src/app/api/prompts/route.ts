import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PROMPTS } from '@/lib/ai/default-prompts';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/** GET /api/prompts — list all prompts (merges defaults with DB overrides) */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { data: dbPrompts } = await getAdminClient()
    .from('prompt_templates')
    .select('*')
    .eq('is_active', true)
    .order('section_order', { ascending: true });

  // Merge: DB global overrides > defaults
  const globalOverrides = new Map(
    (dbPrompts || [])
      .filter((p) => p.tier === 'global')
      .map((p) => [p.section_key, p])
  );

  const prompts = DEFAULT_PROMPTS.map((def) => {
    const override = globalOverrides.get(def.section_key);
    return override || {
      id: null,
      ...def,
      tier: 'default',
      is_active: true,
    };
  });

  return NextResponse.json({ prompts });
}

/** POST /api/prompts — create or update a global prompt override */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: {
    section_key: string;
    title: string;
    system_prompt: string;
    user_prompt_template: string;
    section_order?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompt: data });
}
