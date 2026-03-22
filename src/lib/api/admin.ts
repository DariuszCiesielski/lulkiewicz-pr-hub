import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

interface AllowedUserAccess {
  userId: string;
  email: string;
  role: string;
}

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

async function getAllowedUserAccess(): Promise<AllowedUserAccess | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const email = user.email.trim();
  const adminClient = getAdminClient();
  const { data: exactMatch } = await adminClient
    .from('app_allowed_users')
    .select('role')
    .eq('email', email)
    .maybeSingle();

  let data = exactMatch;

  if (!data?.role && email !== email.toLowerCase()) {
    const { data: normalizedMatch } = await adminClient
      .from('app_allowed_users')
      .select('role')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    data = normalizedMatch;
  }

  if (!data?.role) {
    return null;
  }

  return {
    userId: user.id,
    email,
    role: data.role,
  };
}

/**
 * Weryfikuje czy aktualnie zalogowany uzytkownik ma role admin.
 * Sprawdza tabele app_allowed_users.
 * @returns true jesli user jest adminem, false w przeciwnym razie
 */
export async function verifyAdmin(): Promise<boolean> {
  const access = await getAllowedUserAccess();
  return access?.role === 'admin';
}

export async function verifyAuthenticatedUser(): Promise<Pick<AllowedUserAccess, 'userId' | 'email'> | null> {
  const access = await getAllowedUserAccess();

  if (!access) {
    return null;
  }

  return {
    userId: access.userId,
    email: access.email,
  };
}
