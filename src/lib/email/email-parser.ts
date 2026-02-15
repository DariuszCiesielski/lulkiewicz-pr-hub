import { convert } from 'html-to-text';
import type { Email, EmailRecipient } from '@/types/email';

// --- Email body parsing ---

/**
 * Parse email body content to extract plaintext and optional HTML.
 * Uses html-to-text library for HTML -> plaintext conversion.
 */
export function parseEmailBody(
  bodyContent: string | null,
  bodyContentType: string | null
): { text: string; html: string | null } {
  if (!bodyContent || !bodyContentType) {
    return { text: '', html: null };
  }

  if (bodyContentType.toLowerCase() === 'text') {
    return { text: bodyContent, html: null };
  }

  if (bodyContentType.toLowerCase() === 'html') {
    const text = convert(bodyContent, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'script', format: 'skip' },
        {
          selector: 'a',
          options: { linkBrackets: ['(', ')'] },
        },
      ],
    });

    return { text, html: bodyContent };
  }

  // Unknown content type — treat as plaintext
  return { text: bodyContent, html: null };
}

// --- Threading headers extraction ---

/**
 * Extract threading headers (Message-ID, In-Reply-To, References) from
 * Graph API internetMessageHeaders array.
 *
 * NOTE: internetMessageHeaders are only available if explicitly requested
 * in $select when fetching messages from Graph API.
 */
export function extractThreadingHeaders(
  internetMessageHeaders: Array<{ name: string; value: string }> | null | undefined
): {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
} {
  const result: {
    messageId: string | null;
    inReplyTo: string | null;
    references: string[];
  } = {
    messageId: null,
    inReplyTo: null,
    references: [],
  };

  if (!internetMessageHeaders || !Array.isArray(internetMessageHeaders)) {
    return result;
  }

  for (const header of internetMessageHeaders) {
    const name = header.name?.toLowerCase();

    if (name === 'message-id') {
      result.messageId = header.value || null;
    } else if (name === 'in-reply-to') {
      result.inReplyTo = header.value || null;
    } else if (name === 'references') {
      // References header contains space-separated Message-IDs
      result.references = (header.value || '')
        .split(/\s+/)
        .filter((ref) => ref.length > 0);
    }
  }

  return result;
}

// --- Graph API Message -> Email mapper ---

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Map a Microsoft Graph API Message object to our Email type.
 * Returns a Partial<Email> suitable for upsert into the emails table.
 */
export function mapGraphMessageToEmail(
  msg: any,
  mailboxId: string
): Partial<Email> {
  const body = parseEmailBody(
    msg.body?.content || null,
    msg.body?.contentType || null
  );

  const threading = extractThreadingHeaders(msg.internetMessageHeaders);

  const toAddresses: EmailRecipient[] =
    msg.toRecipients?.map((r: any) => ({
      address: r.emailAddress?.address || '',
      name: r.emailAddress?.name || '',
    })) || [];

  const ccAddresses: EmailRecipient[] =
    msg.ccRecipients?.map((r: any) => ({
      address: r.emailAddress?.address || '',
      name: r.emailAddress?.name || '',
    })) || [];

  return {
    mailbox_id: mailboxId,
    internet_message_id: msg.internetMessageId || null,
    graph_id: msg.id,
    conversation_id: msg.conversationId || null,
    subject: msg.subject || null,
    from_address: msg.from?.emailAddress?.address || null,
    from_name: msg.from?.emailAddress?.name || null,
    to_addresses: toAddresses,
    cc_addresses: ccAddresses,
    sent_at: msg.sentDateTime || null,
    received_at: msg.receivedDateTime,
    body_text: body.text,
    body_html: body.html,
    has_attachments: msg.hasAttachments || false,
    header_message_id: threading.messageId,
    header_in_reply_to: threading.inReplyTo,
    header_references: threading.references,
    is_read: msg.isRead || false,
    folder_id: msg.parentFolderId || null,
  };
}
