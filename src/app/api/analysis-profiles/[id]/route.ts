import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import { verifyScopedAdminAccess } from '@/lib/api/demo-scope';
import { loadProfile, loadProfileSections, loadGlobalContext } from '@/lib/ai/profile-loader';

/**
 * GET /api/analysis-profiles/[id] — Get a single profile with sections.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const profile = await loadProfile(adminClient, id);
  if (!profile) {
    return NextResponse.json({ error: 'Profil nie znaleziony' }, { status: 404 });
  }

  const sections = await loadProfileSections(adminClient, profile.id);
  const globalContext = await loadGlobalContext(adminClient, profile.id);

  return NextResponse.json({ profile, sections, globalContext });
}

/**
 * PATCH /api/analysis-profiles/[id] — Update a profile.
 * Body: partial fields to update.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Verify profile exists and check system status
  const { data: existing } = await adminClient
    .from('analysis_profiles')
    .select('is_system, slug')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Profil nie znaleziony' }, { status: 404 });
  }

  // Block slug changes on system profiles
  if (existing.is_system && body.slug !== undefined && body.slug !== existing.slug) {
    return NextResponse.json({ error: 'Nie można zmieniać slug profilu systemowego' }, { status: 400 });
  }

  // Build update object — only include provided fields
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) update.name = (body.name as string).trim();
  if (body.description !== undefined) update.description = (body.description as string)?.trim() || null;
  if (body.threadSectionKey !== undefined) update.thread_section_key = body.threadSectionKey;
  if (body.threadSystemPrompt !== undefined) update.thread_system_prompt = body.threadSystemPrompt;
  if (body.threadUserPromptTemplate !== undefined) update.thread_user_prompt_template = body.threadUserPromptTemplate;
  if (body.syntheticSystemPrompt !== undefined) update.synthetic_system_prompt = body.syntheticSystemPrompt;
  if (body.standardSystemPrompt !== undefined) update.standard_system_prompt = body.standardSystemPrompt;
  if (body.usesDefaultPrompts !== undefined) update.uses_default_prompts = body.usesDefaultPrompts;

  const { data, error } = await adminClient
    .from('analysis_profiles')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Profil nie znaleziony' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/analysis-profiles/[id] — Delete a custom profile.
 * System profiles (is_system=true) cannot be deleted.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Check if system profile
  const { data: profile } = await adminClient
    .from('analysis_profiles')
    .select('is_system')
    .eq('id', id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profil nie znaleziony' }, { status: 404 });
  }

  if (profile.is_system) {
    return NextResponse.json({ error: 'Nie można usunąć profilu systemowego' }, { status: 403 });
  }

  // Clear references on mailboxes using this profile
  await adminClient
    .from('mailboxes')
    .update({ default_profile_id: null })
    .eq('default_profile_id', id);

  // Delete profile (CASCADE will remove prompt_templates with profile_id)
  const { error } = await adminClient
    .from('analysis_profiles')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
