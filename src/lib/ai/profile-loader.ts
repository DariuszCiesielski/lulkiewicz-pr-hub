/**
 * Profile Loader — loads analysis profiles and their sections from DB.
 *
 * Replaces hardcoded getAnalysisProfile() with DB-driven loading.
 * Falls back to hardcoded profiles when DB data is unavailable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnalysisProfileDb, PromptTemplateDb } from '@/types/email';
import { getAnalysisProfile } from '@/lib/ai/analysis-profiles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoadedProfile {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  threadSectionKey: string;
  threadSystemPrompt: string;
  threadUserPromptTemplate: string;
  syntheticSystemPrompt: string | null;
  standardSystemPrompt: string | null;
  usesDefaultPrompts: boolean;
  isSystem: boolean;
}

export interface LoadedSection {
  id: string;
  sectionKey: string;
  title: string;
  sectionOrder: number;
  systemPrompt: string;
  userPromptTemplate: string;
  syntheticFocus: string | null;
  standardFocus: string | null;
  inInternalReport: boolean;
  inClientReport: boolean;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load a single analysis profile from DB by UUID or slug.
 * Falls back to hardcoded profile registry if DB lookup fails.
 */
export async function loadProfile(
  adminClient: SupabaseClient,
  profileIdOrSlug: string
): Promise<LoadedProfile | null> {
  // Try UUID first, then slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileIdOrSlug);

  const query = adminClient
    .from('analysis_profiles')
    .select('*');

  const { data, error } = isUuid
    ? await query.eq('id', profileIdOrSlug).single()
    : await query.eq('slug', profileIdOrSlug).single();

  if (error || !data) {
    // Fallback to hardcoded profile
    const slug = isUuid ? 'communication_audit' : profileIdOrSlug;
    const hardcoded = getAnalysisProfile(slug as 'communication_audit' | 'case_analytics');
    if (!hardcoded) return null;

    return {
      id: '',
      slug: hardcoded.id,
      name: hardcoded.label,
      description: hardcoded.description,
      threadSectionKey: hardcoded.threadConfig.sectionKey,
      threadSystemPrompt: hardcoded.threadConfig.systemPrompt,
      threadUserPromptTemplate: hardcoded.threadConfig.userPromptTemplate,
      syntheticSystemPrompt: hardcoded.syntheticSystemPrompt || null,
      standardSystemPrompt: hardcoded.standardSystemPrompt || null,
      usesDefaultPrompts: hardcoded.usesDefaultPrompts,
      isSystem: true,
    };
  }

  const row = data as unknown as AnalysisProfileDb;
  return mapProfileRow(row);
}

/**
 * Load all analysis profiles (for dropdown/listing).
 */
export async function loadAllProfiles(
  adminClient: SupabaseClient
): Promise<LoadedProfile[]> {
  const { data, error } = await adminClient
    .from('analysis_profiles')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error || !data) return [];

  return (data as unknown as AnalysisProfileDb[]).map(mapProfileRow);
}

/**
 * Load prompt_templates sections for a profile (tier='profile').
 * Excludes _global_context unless includeGlobalContext is true.
 */
export async function loadProfileSections(
  adminClient: SupabaseClient,
  profileId: string,
  includeGlobalContext = false
): Promise<LoadedSection[]> {
  let query = adminClient
    .from('prompt_templates')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tier', 'profile')
    .eq('is_active', true)
    .order('section_order', { ascending: true });

  if (!includeGlobalContext) {
    query = query.neq('section_key', '_global_context');
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as PromptTemplateDb[]).map(mapSectionRow);
}

/**
 * Load the global context section for a profile.
 */
export async function loadGlobalContext(
  adminClient: SupabaseClient,
  profileId: string
): Promise<LoadedSection | null> {
  const { data, error } = await adminClient
    .from('prompt_templates')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tier', 'profile')
    .eq('section_key', '_global_context')
    .single();

  if (error || !data) return null;
  return mapSectionRow(data as unknown as PromptTemplateDb);
}

/**
 * Resolve a profile UUID from a slug or existing UUID.
 * Useful when transitioning from TEXT analysis_profile to UUID analysis_profile_id.
 */
export async function resolveProfileId(
  adminClient: SupabaseClient,
  slugOrUuid: string
): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrUuid);
  if (isUuid) return slugOrUuid;

  const { data } = await adminClient
    .from('analysis_profiles')
    .select('id')
    .eq('slug', slugOrUuid)
    .single();

  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Mappers (internal)
// ---------------------------------------------------------------------------

function mapProfileRow(row: AnalysisProfileDb): LoadedProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    threadSectionKey: row.thread_section_key,
    threadSystemPrompt: row.thread_system_prompt,
    threadUserPromptTemplate: row.thread_user_prompt_template,
    syntheticSystemPrompt: row.synthetic_system_prompt,
    standardSystemPrompt: row.standard_system_prompt,
    usesDefaultPrompts: row.uses_default_prompts,
    isSystem: row.is_system,
  };
}

function mapSectionRow(row: PromptTemplateDb): LoadedSection {
  return {
    id: row.id,
    sectionKey: row.section_key,
    title: row.title,
    sectionOrder: row.section_order,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    syntheticFocus: row.synthetic_focus,
    standardFocus: row.standard_focus,
    inInternalReport: row.in_internal_report,
    inClientReport: row.in_client_report,
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
  };
}
