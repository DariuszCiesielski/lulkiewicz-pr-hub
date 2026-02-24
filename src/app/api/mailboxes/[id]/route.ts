import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto/encrypt';
import { getAdminClient } from '@/lib/api/admin';
import {
  applyMailboxDemoScope,
  ensureDemoMailboxDisplayName,
  isDemoMailboxDisplayName,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';
import type { ConnectionType } from '@/types/email';

const MAILBOX_SELECT_COLUMNS = 'id, email_address, display_name, connection_type, tenant_id, client_id, sync_status, last_sync_at, total_emails, delta_link, created_at, updated_at, connection_tested_at, connection_test_ok, analysis_profile, default_profile_id, cc_filter_mode';

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

  let mailboxQuery = adminClient
    .from('mailboxes')
    .select(MAILBOX_SELECT_COLUMNS)
    .eq('id', id);
  mailboxQuery = applyMailboxDemoScope(mailboxQuery, scope.isDemoUser);
  const { data, error } = await mailboxQuery.single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

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

  let body: {
    email_address?: string;
    display_name?: string;
    connection_type?: ConnectionType;
    tenant_id?: string;
    client_id?: string;
    analysis_profile?: string;
    default_profile_id?: string;
    cc_filter_mode?: string;
    username?: string;
    password?: string;
    client_secret?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  // Verify mailbox exists
  let existingQuery = adminClient
    .from('mailboxes')
    .select('id, connection_type, email_address, display_name')
    .eq('id', id);
  existingQuery = applyMailboxDemoScope(existingQuery, scope.isDemoUser);
  const { data: existing, error: findError } = await existingQuery.single();

  if (findError || !existing) {
    return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
  }

  // Build update object — only include provided fields
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.email_address !== undefined) {
    if (!body.email_address.includes('@')) {
      return NextResponse.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
    }
    update.email_address = body.email_address;
  }

  if (body.display_name !== undefined) {
    const normalizedDisplayName = body.display_name?.trim() || null;

    if (!scope.isDemoUser && isDemoMailboxDisplayName(normalizedDisplayName)) {
      return NextResponse.json(
        { error: 'Prefiks [MOCK] jest zarezerwowany dla konta demo' },
        { status: 400 }
      );
    }

    update.display_name = scope.isDemoUser
      ? ensureDemoMailboxDisplayName(
          normalizedDisplayName,
          body.email_address || existing.email_address
        )
      : normalizedDisplayName;
  }
  if (body.connection_type !== undefined) update.connection_type = body.connection_type;
  if (body.analysis_profile !== undefined) update.analysis_profile = body.analysis_profile;
  if (body.default_profile_id !== undefined) update.default_profile_id = body.default_profile_id || null;
  if (body.cc_filter_mode !== undefined) update.cc_filter_mode = body.cc_filter_mode;
  // Only update tenant_id / client_id if non-empty value provided (empty = keep existing)
  if (body.tenant_id) update.tenant_id = body.tenant_id;
  if (body.client_id) update.client_id = body.client_id;

  // Re-encrypt credentials if provided
  const connectionType = body.connection_type || existing.connection_type;

  if (connectionType === 'ropc' && body.username && body.password) {
    try {
      update.credentials_encrypted = encrypt(JSON.stringify({
        username: body.username,
        password: body.password,
      }));
    } catch {
      return NextResponse.json({ error: 'Błąd szyfrowania danych logowania' }, { status: 500 });
    }
  } else if (connectionType === 'client_credentials' && body.client_secret) {
    try {
      update.credentials_encrypted = encrypt(JSON.stringify({
        clientSecret: body.client_secret,
      }));
    } catch {
      return NextResponse.json({ error: 'Błąd szyfrowania danych logowania' }, { status: 500 });
    }
  }

  // Reset test status when credentials change
  if (update.credentials_encrypted || body.tenant_id || body.client_id || body.connection_type) {
    update.connection_tested_at = null;
    update.connection_test_ok = null;
  }

  const { data, error } = await adminClient
    .from('mailboxes')
    .update(update)
    .eq('id', id)
    .select(MAILBOX_SELECT_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Skrzynka o tym adresie email już istnieje' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

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

  // Verify mailbox exists
  let mailboxQuery = adminClient
    .from('mailboxes')
    .select('id, email_address')
    .eq('id', id);
  mailboxQuery = applyMailboxDemoScope(mailboxQuery, scope.isDemoUser);
  const { data: mailbox, error: findError } = await mailboxQuery.single();

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
