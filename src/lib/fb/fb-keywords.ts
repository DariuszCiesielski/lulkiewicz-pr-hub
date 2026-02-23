/**
 * FB Keywords — matching i loading slow kluczowych z fb_settings.
 * Slowa kluczowe sa uzywane do pre-AI boostu relevance_score.
 * Per-group override: fb_keywords:{groupId}, fallback: fb_keywords (global).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dopasowuje slowa kluczowe do tresci postu (case-insensitive).
 * @param content - Tresc postu
 * @param keywords - Lista slow kluczowych
 * @returns Trafienia (slowa kluczowe znalezione w tresci)
 */
export function matchKeywords(content: string, keywords: string[]): string[] {
  if (!content || !keywords || keywords.length === 0) {
    return [];
  }

  const lowerContent = content.toLowerCase();
  return keywords.filter((kw) => lowerContent.includes(kw.toLowerCase()));
}

/**
 * Laduje slowa kluczowe z fb_settings.
 * 1. Probuje fb_keywords:{groupId} (per-group override)
 * 2. Fallback na fb_keywords (global)
 * 3. Zwraca [] jesli brak ustawien lub blad parsowania (graceful fallback)
 *
 * @param adminClient - Supabase admin client
 * @param groupId - ID grupy FB
 * @returns Lista slow kluczowych
 */
export async function loadKeywords(
  adminClient: SupabaseClient,
  groupId: string
): Promise<string[]> {
  try {
    // 1. Per-group override
    const { data: perGroup } = await adminClient
      .from('fb_settings')
      .select('value_plain')
      .eq('key', `fb_keywords:${groupId}`)
      .single();

    if (perGroup?.value_plain) {
      try {
        const parsed = JSON.parse(perGroup.value_plain);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Blad parsowania per-group — fallback na global
      }
    }

    // 2. Global fallback
    const { data: globalSetting } = await adminClient
      .from('fb_settings')
      .select('value_plain')
      .eq('key', 'fb_keywords')
      .single();

    if (globalSetting?.value_plain) {
      try {
        const parsed = JSON.parse(globalSetting.value_plain);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Blad parsowania global — zwroc pusta tablice
      }
    }

    return [];
  } catch {
    // Graceful fallback — brak konfiguracji lub blad DB
    return [];
  }
}
