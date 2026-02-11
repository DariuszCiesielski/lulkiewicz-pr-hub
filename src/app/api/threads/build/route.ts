import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildThreadsForMailbox } from '@/lib/threading/thread-builder';

export const maxDuration = 60;

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

/**
 * POST /api/threads/build — build threads for a mailbox.
 *
 * Body: { mailboxId: string }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { mailboxId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { mailboxId } = body;
  if (!mailboxId) {
    return NextResponse.json({ error: 'mailboxId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Get mailbox email address
  const { data: mailbox, error: mailboxError } = await adminClient
    .from('mailboxes')
    .select('email_address')
    .eq('id', mailboxId)
    .single();

  if (mailboxError || !mailbox) {
    return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
  }

  try {
    const result = await buildThreadsForMailbox(
      adminClient,
      mailboxId,
      mailbox.email_address
    );

    return NextResponse.json({
      success: true,
      message: `Zbudowano ${result.threadsCreated} wątków, zaktualizowano ${result.emailsUpdated} emaili`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
