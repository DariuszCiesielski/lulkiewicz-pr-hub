import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

/** GET /api/fb-reports/[id] — get report with sections */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const { data: report, error: reportError } = await adminClient
    .from('fb_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  const { data: sections } = await adminClient
    .from('fb_report_sections')
    .select('*')
    .eq('report_id', id)
    .order('section_order', { ascending: true });

  return NextResponse.json({
    report,
    sections: sections || [],
  });
}

/** PATCH /api/fb-reports/[id] — update report section content */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Verify report exists
  const { data: report } = await adminClient
    .from('fb_reports')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: 'Raport nie znaleziony' }, { status: 404 });
  }

  let body: { sectionId: string; content_markdown: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { error } = await adminClient
    .from('fb_report_sections')
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

/** DELETE /api/fb-reports/[id] — delete report and its sections */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Delete sections first (FK), then report
  await adminClient.from('fb_report_sections').delete().eq('report_id', id);
  const { error } = await adminClient.from('fb_reports').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
