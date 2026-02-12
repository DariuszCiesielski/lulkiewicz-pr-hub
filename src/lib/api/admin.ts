import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

/**
 * Tworzy klienta Supabase z service_role_key (admin access, pomija RLS).
 * WAZNE: Lazy init — NIE tworzyc na top-level (wymog Vercel cold start).
 */
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Weryfikuje czy aktualnie zalogowany uzytkownik ma role admin.
 * Sprawdza tabele app_allowed_users.
 * @returns true jesli user jest adminem, false w przeciwnym razie
 */
export async function verifyAdmin(): Promise<boolean> {
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
