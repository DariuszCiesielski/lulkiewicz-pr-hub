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

/** GET /api/reports/[id] — get report with sections */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const { data: report, error: reportError } = await adminClient
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  const { data: sections } = await adminClient
    .from('report_sections')
    .select('*')
    .eq('report_id', id)
    .order('section_order', { ascending: true });

  // Get mailbox info
  const { data: mailbox } = await adminClient
    .from('mailboxes')
    .select('display_name, email_address')
    .eq('id', report.mailbox_id)
    .single();

  return NextResponse.json({
    report: { ...report, mailbox },
    sections: sections || [],
  });
}

/** PATCH /api/reports/[id] — update report section content */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;

  let body: { sectionId: string; content_markdown: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { error } = await getAdminClient()
    .from('report_sections')
    .update({
      content_markdown: body.content_markdown,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.sectionId)
    .eq('report_id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
