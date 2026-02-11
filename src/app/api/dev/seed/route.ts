import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { seedMockData } from '@/lib/mock/seed-data';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyAdmin() {
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

export async function POST() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED) {
    return NextResponse.json(
      { error: 'Seed niedostępny w produkcji' },
      { status: 403 }
    );
  }

  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { error: 'Brak uprawnień — wymagana rola admin' },
      { status: 403 }
    );
  }

  try {
    const result = await seedMockData(getAdminClient());
    return NextResponse.json({
      success: true,
      message: `Seed zakończony: ${result.mailboxes} skrzynek, ${result.emails} emaili, ${result.threads} wątków`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
