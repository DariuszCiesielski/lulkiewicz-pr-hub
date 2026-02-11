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
 * GET /api/threads — list threads with pagination & filters.
 *
 * Query params:
 *   mailboxId  — filter by mailbox (required)
 *   status     — open | closed | pending
 *   search     — keyword search in subject
 *   from       — ISO date range start
 *   to         — ISO date range end
 *   page       — page number (1-based, default 1)
 *   limit      — per page (default 20, max 100)
 *   sort       — last_message_at | first_message_at | message_count (default last_message_at)
 *   order      — asc | desc (default desc)
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
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

  let query = adminClient
    .from('email_threads')
    .select('*', { count: 'exact' })
    .eq('mailbox_id', mailboxId);

  if (status) query = query.eq('status', status);
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
