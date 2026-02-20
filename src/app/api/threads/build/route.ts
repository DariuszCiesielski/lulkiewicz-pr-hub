import { NextRequest, NextResponse } from 'next/server';
import { buildThreadsForMailbox } from '@/lib/threading/thread-builder';
import { getAdminClient } from '@/lib/api/admin';
import {
  applyMailboxDemoScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';

export const maxDuration = 60;

/**
 * POST /api/threads/build — build threads for a mailbox.
 *
 * Body: { mailboxId: string }
 */
export async function POST(request: NextRequest) {
  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  let body: { mailboxId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
  }

  const { mailboxId } = body;
  if (!mailboxId) {
    return NextResponse.json({ error: 'mailboxId jest wymagany' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Get mailbox email address
  let mailboxQuery = adminClient
    .from('mailboxes')
    .select('email_address')
    .eq('id', mailboxId);
  mailboxQuery = applyMailboxDemoScope(mailboxQuery, scope.isDemoUser);
  const { data: mailbox, error: mailboxError } = await mailboxQuery.single();

  if (mailboxError || !mailbox) {
    return NextResponse.json({ error: 'Skrzynka nie została znaleziona' }, { status: 404 });
  }

  try {
    const result = await buildThreadsForMailbox(
      adminClient,
      mailboxId,
      mailbox.email_address
    );

    const summaryInfo = result.summariesGenerated > 0
      ? `, wygenerowano ${result.summariesGenerated} podsumowań AI`
      : '';

    return NextResponse.json({
      success: true,
      message: `Zbudowano ${result.threadsCreated} wątków, zaktualizowano ${result.emailsUpdated} emaili${summaryInfo}`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
