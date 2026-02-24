/**
 * Main seed function — inserts mock mailboxes and emails into Supabase.
 * Idempotent: uses upsert to avoid duplicates on re-run.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { MOCK_MAILBOXES } from './seed-mailboxes';
import { ALL_MOCK_EMAILS } from './seed-emails';
import { resetCounter } from './seed-utils';

export async function seedMockData(
  adminClient: SupabaseClient
) {
  resetCounter();

  // 1. Look up analysis profile UUIDs
  const { data: profiles } = await adminClient
    .from('analysis_profiles')
    .select('id, slug');

  const profileMap = new Map(
    (profiles || []).map((p: Record<string, unknown>) => [p.slug as string, p.id as string])
  );

  // 2. Upsert mailboxes
  const { error: mailboxError } = await adminClient
    .from('mailboxes')
    .upsert(
      MOCK_MAILBOXES.map((m) => ({
        id: m.id,
        email_address: m.email_address,
        display_name: m.display_name,
        connection_type: m.connection_type,
        tenant_id: m.tenant_id,
        client_id: m.client_id,
        sync_status: m.sync_status,
        last_sync_at: m.last_sync_at,
        total_emails: m.total_emails,
        analysis_profile: m.analysis_profile,
        default_profile_id: profileMap.get(m.analysis_profile) || null,
        credentials_encrypted: null,
        delta_link: null,
      })),
      { onConflict: 'id' }
    );

  if (mailboxError) {
    throw new Error(`Błąd seedowania skrzynek: ${mailboxError.message}`);
  }

  // 3. Upsert emails in batches of 50
  const BATCH_SIZE = 50;
  let totalUpserted = 0;

  for (let i = 0; i < ALL_MOCK_EMAILS.length; i += BATCH_SIZE) {
    const batch = ALL_MOCK_EMAILS.slice(i, i + BATCH_SIZE).map((e) => ({
      mailbox_id: e.mailbox_id,
      internet_message_id: e.internet_message_id,
      graph_id: e.graph_id,
      conversation_id: e.conversation_id,
      subject: e.subject,
      from_address: e.from_address,
      from_name: e.from_name,
      to_addresses: e.to_addresses,
      cc_addresses: e.cc_addresses,
      sent_at: e.sent_at,
      received_at: e.received_at,
      body_text: e.body_text,
      body_html: null,
      has_attachments: e.has_attachments,
      header_message_id: e.header_message_id,
      header_in_reply_to: e.header_in_reply_to,
      header_references: e.header_references,
      is_read: e.is_read,
      is_deleted: false,
    }));

    const { error: emailError } = await adminClient
      .from('emails')
      .upsert(batch, { onConflict: 'mailbox_id,internet_message_id' });

    if (emailError) {
      throw new Error(`Błąd seedowania emaili (batch ${i}): ${emailError.message}`);
    }

    totalUpserted += batch.length;
  }

  // 4. Update mailbox total_emails counts
  for (const mailbox of MOCK_MAILBOXES) {
    const count = ALL_MOCK_EMAILS.filter((e) => e.mailbox_id === mailbox.id).length;
    await adminClient
      .from('mailboxes')
      .update({ total_emails: count, last_sync_at: new Date().toISOString() })
      .eq('id', mailbox.id);
  }

  return {
    mailboxes: MOCK_MAILBOXES.length,
    emails: totalUpserted,
    threads: 13,
  };
}

export async function clearMockData(adminClient: SupabaseClient) {
  const mailboxIds = MOCK_MAILBOXES.map((m) => m.id);

  // Delete emails first (FK constraint)
  const { error: emailError } = await adminClient
    .from('emails')
    .delete()
    .in('mailbox_id', mailboxIds);

  if (emailError) {
    throw new Error(`Błąd usuwania emaili: ${emailError.message}`);
  }

  // Delete sync jobs
  await adminClient
    .from('sync_jobs')
    .delete()
    .in('mailbox_id', mailboxIds);

  // Delete mailboxes
  const { error: mailboxError } = await adminClient
    .from('mailboxes')
    .delete()
    .in('id', mailboxIds);

  if (mailboxError) {
    throw new Error(`Błąd usuwania skrzynek: ${mailboxError.message}`);
  }

  return { deleted: true };
}
