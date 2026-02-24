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

  // Get mailbox email address + cc_filter_mode
  let mailboxQuery = adminClient
    .from('mailboxes')
    .select('email_address, cc_filter_mode')
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

    const parts = [`Zbudowano ${result.threadsCreated} wątków z ${result.emailsUpdated} emaili`];
    if (result.emailsFiltered > 0) {
      parts.push(`pominięto ${result.emailsFiltered} śmieciowych`);
    }
    if (result.summariesGenerated > 0) {
      parts.push(`wygenerowano ${result.summariesGenerated} podsumowań AI`);
    }

    // Count visible threads after CC filter
    const ccFilterMode = mailbox.cc_filter_mode || 'off';
    let visibleThreads = result.threadsCreated;

    if (ccFilterMode !== 'off' && result.threadsCreated > 0) {
      let countQuery = adminClient
        .from('email_threads')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailboxId);

      if (ccFilterMode === 'never_in_to') {
        countQuery = countQuery.neq('cc_filter_status', 'cc_always');
      } else if (ccFilterMode === 'first_email_cc') {
        countQuery = countQuery.eq('cc_filter_status', 'direct');
      }

      const { count } = await countQuery;
      visibleThreads = count ?? result.threadsCreated;

      const hidden = result.threadsCreated - visibleThreads;
      if (hidden > 0) {
        parts.push(`${hidden} ukrytych filtrem CC`);
      }
    }

    return NextResponse.json({
      success: true,
      message: parts.join(', '),
      visibleThreads,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
