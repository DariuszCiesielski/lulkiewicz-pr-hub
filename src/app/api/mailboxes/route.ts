import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto/encrypt';
import { getAdminClient } from '@/lib/api/admin';
import {
  applyMailboxDemoScope,
  ensureDemoMailboxDisplayName,
  isDemoMailboxDisplayName,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';
import type { ConnectionType } from '@/types/email';

// Columns to return in GET responses (never credentials_encrypted)
const MAILBOX_SELECT_COLUMNS = 'id, email_address, display_name, connection_type, tenant_id, client_id, sync_status, last_sync_at, total_emails, delta_link, created_at, updated_at, connection_tested_at, connection_test_ok, analysis_profile, default_profile_id, cc_filter_mode';

export async function GET() {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  // Fetch mailboxes
  let mailboxesQuery = adminClient
    .from('mailboxes')
    .select(MAILBOX_SELECT_COLUMNS)
    .order('created_at', { ascending: true });
  mailboxesQuery = applyMailboxDemoScope(mailboxesQuery, scope.isDemoUser);
  const { data: mailboxes, error } = await mailboxesQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each mailbox, get email count
  const mailboxesWithCount = await Promise.all(
    (mailboxes || []).map(async (mailbox) => {
      const { count } = await adminClient
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id);

      return {
        ...mailbox,
        email_count: count ?? 0,
      };
    })
  );

  return NextResponse.json(mailboxesWithCount);
}

export async function POST(request: Request) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

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

  const {
    email_address,
    display_name,
    connection_type = 'ropc',
    tenant_id,
    client_id,
    analysis_profile = 'communication_audit',
    default_profile_id,
    cc_filter_mode,
    username,
    password,
    client_secret,
  } = body;

  const normalizedDisplayName = display_name?.trim() || null;

  // Validation: email_address required
  if (!email_address || !email_address.includes('@')) {
    return NextResponse.json(
      { error: 'Adres email skrzynki jest wymagany' },
      { status: 400 }
    );
  }

  if (!scope.isDemoUser && isDemoMailboxDisplayName(normalizedDisplayName)) {
    return NextResponse.json(
      { error: 'Prefiks [MOCK] jest zarezerwowany dla konta demo' },
      { status: 400 }
    );
  }

  // Validation: connection-type specific fields
  if (connection_type === 'ropc') {
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Login i hasło są wymagane dla typu połączenia ROPC' },
        { status: 400 }
      );
    }
  } else if (connection_type === 'client_credentials') {
    if (!client_secret && !process.env.AZURE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Client Secret jest wymagany dla typu połączenia OAuth2 (podaj w formularzu lub ustaw AZURE_CLIENT_SECRET)' },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json(
      { error: 'Nieprawidłowy typ połączenia. Dozwolone: ropc, client_credentials' },
      { status: 400 }
    );
  }

  // Use env defaults if tenant_id / client_id / client_secret not provided
  const resolvedTenantId = tenant_id || process.env.AZURE_TENANT_ID;
  const resolvedClientId = client_id || process.env.AZURE_CLIENT_ID;
  const resolvedClientSecret = client_secret || process.env.AZURE_CLIENT_SECRET;

  if (!resolvedTenantId) {
    return NextResponse.json(
      { error: 'Tenant ID jest wymagany (podaj w formularzu lub ustaw AZURE_TENANT_ID)' },
      { status: 400 }
    );
  }

  if (!resolvedClientId) {
    return NextResponse.json(
      { error: 'Client ID jest wymagany (podaj w formularzu lub ustaw AZURE_CLIENT_ID)' },
      { status: 400 }
    );
  }

  // Encrypt credentials
  let credentialsEncrypted: string;
  try {
    if (connection_type === 'ropc') {
      credentialsEncrypted = encrypt(JSON.stringify({ username, password }));
    } else {
      credentialsEncrypted = encrypt(JSON.stringify({ clientSecret: resolvedClientSecret }));
    }
  } catch (err) {
    console.error('Encryption error:', err);
    return NextResponse.json(
      { error: 'Błąd szyfrowania danych logowania. Sprawdź konfigurację ENCRYPTION_KEY.' },
      { status: 500 }
    );
  }

  // Insert mailbox
  const { data, error } = await adminClient
    .from('mailboxes')
    .insert({
      email_address,
      display_name: scope.isDemoUser
        ? ensureDemoMailboxDisplayName(normalizedDisplayName, email_address)
        : normalizedDisplayName,
      connection_type,
      credentials_encrypted: credentialsEncrypted,
      tenant_id: resolvedTenantId,
      client_id: resolvedClientId,
      analysis_profile,
      default_profile_id: default_profile_id || null,
      cc_filter_mode: cc_filter_mode || (analysis_profile === 'case_analytics' ? 'never_in_to' : 'off'),
      sync_status: 'never_synced',
      total_emails: 0,
    })
    .select(MAILBOX_SELECT_COLUMNS)
    .single();

  if (error) {
    // Duplicate email check
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Skrzynka o tym adresie email już istnieje' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
