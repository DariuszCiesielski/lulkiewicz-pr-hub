import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/**
 * GET /api/threads/[id] — thread detail with all emails.
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

  // Fetch thread
  const { data: thread, error: threadError } = await adminClient
    .from('email_threads')
    .select('*')
    .eq('id', id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: 'Wątek nie został znaleziony' }, { status: 404 });
  }

  const mailboxAllowed = await isMailboxInScope(adminClient, thread.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
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
