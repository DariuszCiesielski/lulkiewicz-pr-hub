import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import { verifyScopedAdminAccess } from '@/lib/api/demo-scope';
import { loadAllProfiles, loadProfileSections } from '@/lib/ai/profile-loader';

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z',
};

function generateSlug(name: string): string {
  return name
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => DIACRITICS[ch] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/**
 * GET /api/analysis-profiles — List all analysis profiles.
 * Optional: ?includeSections=true to include prompt_templates per profile.
 */
export async function GET(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const includeSections = request.nextUrl.searchParams.get('includeSections') === 'true';

  const profiles = await loadAllProfiles(adminClient);

  if (!includeSections) {
    return NextResponse.json({ profiles });
  }

  // Attach sections to each profile
  const profilesWithSections = await Promise.all(
    profiles.map(async (profile) => {
      const sections = await loadProfileSections(adminClient, profile.id, true);
      return { ...profile, sections };
    })
  );

  return NextResponse.json({ profiles: profilesWithSections });
}

/**
 * POST /api/analysis-profiles — Create a new custom analysis profile.
 * Body: { name, slug, description?, threadSectionKey, threadSystemPrompt, threadUserPromptTemplate,
 *         syntheticSystemPrompt?, standardSystemPrompt?, usesDefaultPrompts? }
 */
export async function POST(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Nazwa profilu jest wymagana' }, { status: 400 });
  }

  const slug = (body.slug as string)?.trim().toLowerCase().replace(/\s+/g, '_') || generateSlug(name);
  if (!slug) {
    return NextResponse.json({ error: 'Nie udało się wygenerować slug z nazwy' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('analysis_profiles')
    .insert({
      name,
      slug,
      description: (body.description as string)?.trim() || null,
      thread_section_key: (body.threadSectionKey as string) || `_${slug}_thread_summary`,
      thread_system_prompt: (body.threadSystemPrompt as string) || '',
      thread_user_prompt_template: (body.threadUserPromptTemplate as string) || '',
      synthetic_system_prompt: (body.syntheticSystemPrompt as string) || null,
      standard_system_prompt: (body.standardSystemPrompt as string) || null,
      uses_default_prompts: body.usesDefaultPrompts === true,
      is_system: false,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Profil o tym slugu już istnieje' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
