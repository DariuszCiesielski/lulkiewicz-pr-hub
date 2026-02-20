import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/**
 * GET /api/threads — list threads with pagination & filters.
 *
 * Query params:
 *   mailboxId  — filter by mailbox (required)
 *   status     — open | closed_all | closed_positive | closed_negative | pending
 *   search     — keyword search in subject
 *   from       — ISO date range start
 *   to         — ISO date range end
 *   page       — page number (1-based, default 1)
 *   limit      — per page (default 20, max 100)
 *   sort       — last_message_at | first_message_at | message_count (default last_message_at)
 *   order      — asc | desc (default desc)
 */
export async function GET(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const mailboxId = searchParams.get('mailboxId');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const sort = searchParams.get('sort') || 'last_message_at';
  const order = searchParams.get('order') === 'asc' ? true : false;

  if (!mailboxId) {
    return NextResponse.json({ error: 'mailboxId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const mailboxAllowed = await isMailboxInScope(adminClient, mailboxId, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
  }

  let query = adminClient
    .from('email_threads')
    .select('*', { count: 'exact' })
    .eq('mailbox_id', mailboxId);

  if (status === 'closed_all') {
    query = query.in('status', ['closed', 'closed_positive', 'closed_negative']);
  } else if (status) {
    query = query.eq('status', status);
  }
  if (search) query = query.ilike('subject_normalized', `%${search.toLowerCase()}%`);
  if (from) query = query.gte('last_message_at', from);
  if (to) query = query.lte('last_message_at', to);

  const offset = (page - 1) * limit;
  query = query.order(sort, { ascending: order }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    threads: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
