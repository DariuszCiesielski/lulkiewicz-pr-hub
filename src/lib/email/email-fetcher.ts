import type { Client } from '@microsoft/microsoft-graph-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Email } from '@/types/email';

// Graph API $select fields for email messages
const MESSAGE_SELECT_FIELDS = [
  'id',
  'subject',
  'from',
  'toRecipients',
  'ccRecipients',
  'sentDateTime',
  'receivedDateTime',
  'body',
  'bodyPreview',
  'internetMessageId',
  'conversationId',
  'hasAttachments',
  'internetMessageHeaders',
  'isRead',
].join(',');

// --- Message count ---

/**
 * Get total message count in the inbox folder.
 */
export async function getMailboxMessageCount(
  graphClient: Client,
  emailAddress: string
): Promise<number> {
  const folder = await graphClient
    .api(`/users/${emailAddress}/mailFolders/inbox`)
    .select('totalItemCount')
    .get();

  return folder?.totalItemCount ?? 0;
}

// --- Full sync pagination ---

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fetch a single page of messages from Graph API.
 *
 * IMPORTANT: When pageUrl is provided (from @odata.nextLink), do NOT add
 * $select, $top, or other query params — they are already encoded in the URL.
 */
export async function fetchMessagesPage(
  graphClient: Client,
  emailAddress: string,
  pageUrl: string | null
): Promise<{ messages: any[]; nextLink: string | null }> {
  let response: any;

  if (pageUrl) {
    // Continue pagination — nextLink already contains all query params
    response = await graphClient.api(pageUrl).get();
  } else {
    // First page — build full query
    response = await graphClient
      .api(`/users/${emailAddress}/mailFolders/inbox/messages`)
      .top(100)
      .select(MESSAGE_SELECT_FIELDS)
      .header('Prefer', 'outlook.body-content-type="text"')
      .orderby('receivedDateTime DESC')
      .get();
  }

  return {
    messages: response?.value || [],
    nextLink: response?.['@odata.nextLink'] || null,
  };
}

// --- Delta sync pagination ---

/**
 * Fetch a delta page of messages (new/changed/removed since last sync).
 *
 * If deltaLink is provided, uses it directly (resume delta).
 * If null, initiates new delta query.
 * Removed messages are separated into removedIds array.
 */
export async function fetchDeltaPage(
  graphClient: Client,
  emailAddress: string,
  deltaLink: string | null
): Promise<{
  messages: any[];
  nextLink: string | null;
  deltaLink: string | null;
  removedIds: string[];
}> {
  let response: any;

  if (deltaLink) {
    // Resume delta from saved link
    response = await graphClient.api(deltaLink).get();
  } else {
    // Initiate new delta query
    response = await graphClient
      .api(`/users/${emailAddress}/mailFolders/inbox/messages/delta`)
      .top(100)
      .select(MESSAGE_SELECT_FIELDS)
      .header('Prefer', 'outlook.body-content-type="text"')
      .get();
  }

  const allItems: any[] = response?.value || [];

  // Separate removed messages from active ones
  const removedIds: string[] = [];
  const messages: any[] = [];

  for (const item of allItems) {
    if (item['@removed']) {
      removedIds.push(item.id);
    } else {
      messages.push(item);
    }
  }

  return {
    messages,
    nextLink: response?.['@odata.nextLink'] || null,
    deltaLink: response?.['@odata.deltaLink'] || null,
    removedIds,
  };
}

// --- Upsert emails to DB ---

/**
 * Upsert emails into the database.
 * Uses ON CONFLICT (mailbox_id, internet_message_id) DO UPDATE for deduplication.
 * Filters out emails without internet_message_id (cannot deduplicate).
 *
 * Returns count of upserted records.
 */
export async function upsertEmails(
  adminClient: SupabaseClient,
  mailboxId: string,
  emails: Partial<Email>[]
): Promise<number> {
  // Filter out emails without internet_message_id — cannot deduplicate
  const validEmails = emails.filter(
    (e) => e.internet_message_id && e.internet_message_id.length > 0
  );

  if (validEmails.length === 0) {
    return 0;
  }

  // Prepare rows for upsert
  const rows = validEmails.map((email) => ({
    mailbox_id: mailboxId,
    internet_message_id: email.internet_message_id,
    graph_id: email.graph_id,
    conversation_id: email.conversation_id,
    subject: email.subject,
    from_address: email.from_address,
    from_name: email.from_name,
    to_addresses: email.to_addresses,
    cc_addresses: email.cc_addresses,
    sent_at: email.sent_at,
    received_at: email.received_at,
    body_text: email.body_text,
    body_html: email.body_html,
    has_attachments: email.has_attachments ?? false,
    header_message_id: email.header_message_id,
    header_in_reply_to: email.header_in_reply_to,
    header_references: email.header_references ?? [],
    is_read: email.is_read ?? false,
  }));

  const { error } = await adminClient
    .from('emails')
    .upsert(rows, {
      onConflict: 'mailbox_id,internet_message_id',
    });

  if (error) {
    console.error('Upsert error:', error);
    throw new Error(`Błąd zapisu emaili do bazy: ${error.message}`);
  }

  return validEmails.length;
}
