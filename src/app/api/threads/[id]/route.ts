import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
 * GET /api/threads/[id] — thread detail with all emails.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Fetch thread
  const { data: thread, error: threadError } = await adminClient
    .from('email_threads')
    .select('*')
    .eq('id', id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: 'Wątek nie został znaleziony' }, { status: 404 });
  }

  // Fetch emails in thread (chronological)
  const { data: emails, error: emailsError } = await adminClient
    .from('emails')
    .select('id, subject, from_address, from_name, to_addresses, cc_addresses, sent_at, received_at, body_text, has_attachments, is_incoming, response_time_minutes, is_read')
    .eq('thread_id', id)
    .order('received_at', { ascending: true });

  if (emailsError) {
    return NextResponse.json({ error: emailsError.message }, { status: 500 });
  }

  // Fetch mailbox info
  const { data: mailbox } = await adminClient
    .from('mailboxes')
    .select('display_name, email_address')
    .eq('id', thread.mailbox_id)
    .single();

  return NextResponse.json({
    thread: { ...thread, mailbox },
    emails: emails || [],
  });
}
