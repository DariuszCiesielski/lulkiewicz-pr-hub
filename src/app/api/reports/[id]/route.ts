import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/api/admin';
import {
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

/** GET /api/reports/[id] — get report with sections */
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

  const { data: report, error: reportError } = await adminClient
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  const mailboxAllowed = await isMailboxInScope(adminClient, report.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
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

/** DELETE /api/reports/[id] — delete report and its sections */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const { data: report } = await adminClient
    .from('reports')
    .select('mailbox_id')
    .eq('id', id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  const mailboxAllowed = await isMailboxInScope(adminClient, report.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  // Delete sections first (FK), then report
  await adminClient.from('report_sections').delete().eq('report_id', id);
  const { error } = await adminClient.from('reports').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** PATCH /api/reports/[id] — update report section content */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const { data: report } = await adminClient
    .from('reports')
    .select('mailbox_id')
    .eq('id', id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  const mailboxAllowed = await isMailboxInScope(adminClient, report.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  let body: { sectionId: string; content_markdown: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { error } = await adminClient
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
