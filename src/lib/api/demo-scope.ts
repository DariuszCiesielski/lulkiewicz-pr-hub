import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from './admin';

const DEFAULT_DEMO_EMAIL = 'demo@demo.pl';
const DEMO_MAILBOX_PREFIX = '[MOCK]';

export interface ScopedAdminAccess {
  email: string;
  isDemoUser: boolean;
}

function getDemoEmail(): string {
  return (process.env.DEMO_USER_EMAIL || DEFAULT_DEMO_EMAIL).trim().toLowerCase();
}

export function isDemoMailboxDisplayName(displayName?: string | null): boolean {
  if (!displayName) return false;
  return displayName.trim().toUpperCase().startsWith(DEMO_MAILBOX_PREFIX);
}

export function ensureDemoMailboxDisplayName(
  displayName: string | null | undefined,
  fallbackLabel: string
): string {
  const normalized = (displayName || '').trim();
  const base = normalized || fallbackLabel.trim() || 'Demo mailbox';

  if (isDemoMailboxDisplayName(base)) {
    return base;
  }

  return `${DEMO_MAILBOX_PREFIX} ${base}`;
}

/**
 * Admin access used by tool routes.
 * Returns null when user is unauthenticated or not an admin in app_allowed_users.
 */
export async function verifyScopedAdminAccess(): Promise<ScopedAdminAccess | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const email = user.email.trim().toLowerCase();

  const { data } = await getAdminClient()
    .from('app_allowed_users')
    .select('role')
    .eq('email', email)
    .maybeSingle();

  if (data?.role !== 'admin') {
    return null;
  }

  return {
    email,
    isDemoUser: email === getDemoEmail(),
  };
}

/**
 * Apply mailbox scope:
 * - demo account sees only demo mailboxes (display_name starts with [MOCK])
 * - normal admins do not see demo mailboxes
 */
export function applyMailboxDemoScope<T>(query: T, isDemoUser: boolean): T {
  if (isDemoUser) {
    return (query as { ilike: (column: string, pattern: string) => unknown })
      .ilike('display_name', `${DEMO_MAILBOX_PREFIX}%`) as T;
  }
  return (query as { or: (filters: string) => unknown })
    .or(`display_name.is.null,display_name.not.ilike.${DEMO_MAILBOX_PREFIX}%`) as T;
}

export async function getScopedMailboxIds(
  adminClient: SupabaseClient,
  isDemoUser: boolean
): Promise<string[]> {
  let query = adminClient.from('mailboxes').select('id');
  query = applyMailboxDemoScope(query, isDemoUser);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Nie udało się pobrać zakresu skrzynek: ${error.message}`);
  }

  return (data || []).map((row: { id: string }) => row.id);
}

export async function isMailboxInScope(
  adminClient: SupabaseClient,
  mailboxId: string,
  isDemoUser: boolean
): Promise<boolean> {
  let query = adminClient
    .from('mailboxes')
    .select('id')
    .eq('id', mailboxId);
  query = applyMailboxDemoScope(query, isDemoUser);

  const { data, error } = await query.maybeSingle();
  if (error) {
    return false;
  }

  return !!data;
}
