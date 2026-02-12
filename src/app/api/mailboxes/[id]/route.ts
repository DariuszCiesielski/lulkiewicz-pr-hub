import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';

const MAILBOX_SELECT_COLUMNS = 'id, email_address, display_name, connection_type, tenant_id, client_id, sync_status, last_sync_at, total_emails, delta_link, created_at, updated_at';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('mailboxes')
    .select(MAILBOX_SELECT_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Verify mailbox exists
  const { data: mailbox, error: findError } = await adminClient
    .from('mailboxes')
    .select('id, email_address')
    .eq('id', id)
    .single();

  if (findError || !mailbox) {
    return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
  }

  // Delete mailbox (CASCADE will remove related sync_jobs and emails)
  const { error } = await adminClient
    .from('mailboxes')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Skrzynka ${mailbox.email_address} została usunięta` });
}
