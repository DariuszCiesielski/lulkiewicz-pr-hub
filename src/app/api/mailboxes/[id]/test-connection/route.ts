import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto/encrypt';
import { getAccessToken, parseGraphAuthError } from '@/lib/email/graph-auth';
import { createGraphClient } from '@/lib/email/graph-client';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import type { MailboxCredentials } from '@/types/email';

// Allow up to 30s for connection test (auth + Graph API call)
export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Fetch mailbox with encrypted credentials
  const { data: mailbox, error: findError } = await adminClient
    .from('mailboxes')
    .select('id, email_address, connection_type, credentials_encrypted, tenant_id, client_id')
    .eq('id', id)
    .single();

  if (findError || !mailbox) {
    return NextResponse.json(
      { success: false, message: 'Skrzynka nie została znaleziona' },
      { status: 404 }
    );
  }

  if (!mailbox.credentials_encrypted) {
    return NextResponse.json(
      { success: false, message: 'Brak zapisanych danych logowania dla tej skrzynki' },
      { status: 400 }
    );
  }

  // Decrypt credentials
  let decryptedCredentials: Record<string, string>;
  try {
    decryptedCredentials = JSON.parse(decrypt(mailbox.credentials_encrypted));
  } catch (err) {
    console.error('Decryption error:', err);
    return NextResponse.json(
      { success: false, message: 'Błąd odszyfrowywania danych logowania. Sprawdź ENCRYPTION_KEY.' },
      { status: 500 }
    );
  }

  // Build MailboxCredentials
  let credentials: MailboxCredentials;
  if (mailbox.connection_type === 'ropc') {
    credentials = {
      type: 'ropc',
      tenantId: mailbox.tenant_id,
      clientId: mailbox.client_id,
      username: decryptedCredentials.username,
      password: decryptedCredentials.password,
    };
  } else {
    credentials = {
      type: 'client_credentials',
      tenantId: mailbox.tenant_id,
      clientId: mailbox.client_id,
      clientSecret: decryptedCredentials.clientSecret,
    };
  }

  // Attempt authentication
  let accessToken: string;
  try {
    accessToken = await getAccessToken(credentials);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : parseGraphAuthError(error);
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }

  // Test Graph API access — get inbox folder info
  try {
    const client = createGraphClient(accessToken);
    const inbox = await client
      .api(`/users/${mailbox.email_address}/mailFolders/inbox`)
      .select('totalItemCount')
      .get();

    const messageCount = inbox?.totalItemCount ?? 0;

    // Save successful test result to DB
    await adminClient
      .from('mailboxes')
      .update({
        connection_tested_at: new Date().toISOString(),
        connection_test_ok: true,
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      message: `Połączenie udane. Skrzynka zawiera ${messageCount} wiadomości.`,
      messageCount,
    });
  } catch (error: unknown) {
    // Parse Graph API errors
    const graphError = error as { statusCode?: number; message?: string };
    const statusCode = graphError?.statusCode;

    let message: string;
    if (statusCode === 401) {
      message = 'Brak uprawnień do odczytu skrzynki. Sprawdź uprawnienia aplikacji w Azure Portal.';
    } else if (statusCode === 403) {
      message = 'Dostęp zabroniony. Aplikacja nie ma uprawnienia Mail.Read dla tej skrzynki.';
    } else if (statusCode === 404) {
      message = `Skrzynka ${mailbox.email_address} nie została znaleziona w Microsoft 365. Sprawdź adres email.`;
    } else {
      message = `Błąd Graph API: ${graphError?.message || 'Nieznany błąd'}`;
    }

    // Save failed test result to DB
    await adminClient
      .from('mailboxes')
      .update({
        connection_tested_at: new Date().toISOString(),
        connection_test_ok: false,
      })
      .eq('id', id);

    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
