/**
 * Email threading algorithm.
 *
 * Strategy (in priority order):
 * 1. Link via In-Reply-To / References headers
 * 2. Fallback: normalized subject match (max 30 days gap)
 *
 * Produces email_threads records and updates emails with thread_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// --- Subject normalization ---

const REPLY_PREFIXES = /^(re|odp|fwd|fw|pd|vs|sv|aw)\s*:\s*/i;
const BRACKET_TAGS = /\[.*?\]\s*/g; // [External], [SPAM], etc.

export function normalizeSubject(subject: string | null): string {
  if (!subject) return '';
  let normalized = subject.trim();
  // Remove bracket tags
  normalized = normalized.replace(BRACKET_TAGS, '');
  // Remove reply/forward prefixes (may be nested: Re: Re: Odp:)
  let prev = '';
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(REPLY_PREFIXES, '');
  }
  return normalized.trim().toLowerCase();
}

// --- Direction detection ---

export function isIncoming(
  fromAddress: string | null,
  mailboxEmail: string
): boolean {
  if (!fromAddress) return true;
  return fromAddress.toLowerCase() !== mailboxEmail.toLowerCase();
}

// --- Response time calculation ---

export function calcResponseTimeMinutes(
  sentAt: string,
  previousSentAt: string
): number {
  const diff = new Date(sentAt).getTime() - new Date(previousSentAt).getTime();
  return Math.max(0, diff / (1000 * 60));
}

// --- Types ---

interface RawEmail {
  id: string;
  mailbox_id: string;
  subject: string | null;
  from_address: string | null;
  sent_at: string | null;
  received_at: string;
  header_message_id: string | null;
  header_in_reply_to: string | null;
  header_references: string[];
}

interface ThreadGroup {
  emails: RawEmail[];
  subjectNormalized: string;
}

// --- Main builder ---

export async function buildThreadsForMailbox(
  supabase: SupabaseClient,
  mailboxId: string,
  mailboxEmail: string
): Promise<{ threadsCreated: number; emailsUpdated: number }> {
  // 1. Fetch all emails for this mailbox
  const { data: emails, error } = await supabase
    .from('emails')
    .select('id, mailbox_id, subject, from_address, sent_at, received_at, header_message_id, header_in_reply_to, header_references')
    .eq('mailbox_id', mailboxId)
    .eq('is_deleted', false)
    .order('received_at', { ascending: true });

  if (error) throw new Error(`Błąd pobierania emaili: ${error.message}`);
  if (!emails || emails.length === 0) return { threadsCreated: 0, emailsUpdated: 0 };

  // 2. Build message-id index
  const messageIdMap = new Map<string, RawEmail>();
  for (const email of emails) {
    if (email.header_message_id) {
      messageIdMap.set(email.header_message_id, email);
    }
  }

  // 3. Group emails into threads using Union-Find
  const parent = new Map<string, string>(); // email.id -> root email.id

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    let root = parent.get(id)!;
    while (root !== parent.get(root)) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = id;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // Initialize all emails
  for (const email of emails) {
    find(email.id);
  }

  // Link via In-Reply-To
  for (const email of emails) {
    if (email.header_in_reply_to) {
      const replyTo = messageIdMap.get(email.header_in_reply_to);
      if (replyTo) union(email.id, replyTo.id);
    }
  }

  // Link via References
  for (const email of emails) {
    if (email.header_references && email.header_references.length > 0) {
      for (const ref of email.header_references) {
        const refEmail = messageIdMap.get(ref);
        if (refEmail) {
          union(email.id, refEmail.id);
          break; // Link to first found reference is enough
        }
      }
    }
  }

  // Subject fallback: group unlinked emails by normalized subject
  const MAX_GAP_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Build subject groups from emails not yet linked
  const subjectBuckets = new Map<string, RawEmail[]>();
  for (const email of emails) {
    const norm = normalizeSubject(email.subject);
    if (!norm) continue;
    const bucket = subjectBuckets.get(norm) || [];
    bucket.push(email);
    subjectBuckets.set(norm, bucket);
  }

  for (const [, bucket] of subjectBuckets) {
    if (bucket.length < 2) continue;
    // Sort by time
    bucket.sort((a, b) =>
      new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    );
    for (let i = 1; i < bucket.length; i++) {
      // Only link if they're not already in the same group
      if (find(bucket[i].id) === find(bucket[i - 1].id)) continue;
      const gap = new Date(bucket[i].received_at).getTime() -
        new Date(bucket[i - 1].received_at).getTime();
      if (gap <= MAX_GAP_MS) {
        union(bucket[i].id, bucket[i - 1].id);
      }
    }
  }

  // 4. Collect thread groups
  const groups = new Map<string, ThreadGroup>();
  for (const email of emails) {
    const root = find(email.id);
    if (!groups.has(root)) {
      groups.set(root, {
        emails: [],
        subjectNormalized: normalizeSubject(email.subject),
      });
    }
    groups.get(root)!.emails.push(email);
  }

  // 5. Delete existing threads for this mailbox (rebuild)
  await supabase
    .from('emails')
    .update({ thread_id: null })
    .eq('mailbox_id', mailboxId);

  await supabase
    .from('email_threads')
    .delete()
    .eq('mailbox_id', mailboxId);

  // 6. Create thread records and update emails
  let threadsCreated = 0;
  let emailsUpdated = 0;

  for (const [, group] of groups) {
    // Sort emails chronologically
    group.emails.sort((a, b) =>
      new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    );

    const firstEmail = group.emails[0];
    const lastEmail = group.emails[group.emails.length - 1];

    // Collect unique participants
    const participants = new Set<string>();
    for (const e of group.emails) {
      if (e.from_address) participants.add(e.from_address.toLowerCase());
    }

    // Calculate response times
    const responseTimes: number[] = [];
    for (let i = 1; i < group.emails.length; i++) {
      const prev = group.emails[i - 1];
      const curr = group.emails[i];
      const prevIsIncoming = isIncoming(prev.from_address, mailboxEmail);
      const currIsIncoming = isIncoming(curr.from_address, mailboxEmail);
      // Response = direction change
      if (prevIsIncoming !== currIsIncoming) {
        const rt = calcResponseTimeMinutes(
          curr.sent_at || curr.received_at,
          prev.sent_at || prev.received_at
        );
        responseTimes.push(rt);
      }
    }

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

    // Determine thread status
    const lastIsIncoming = isIncoming(lastEmail.from_address, mailboxEmail);
    const threadStatus = lastIsIncoming ? 'pending' : 'open';

    // Insert thread
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .insert({
        mailbox_id: mailboxId,
        subject_normalized: group.subjectNormalized || '(brak tematu)',
        first_message_at: firstEmail.sent_at || firstEmail.received_at,
        last_message_at: lastEmail.sent_at || lastEmail.received_at,
        message_count: group.emails.length,
        participant_addresses: Array.from(participants),
        status: threadStatus,
        avg_response_time_minutes: avgResponseTime,
      })
      .select('id')
      .single();

    if (threadError) {
      console.error(`Błąd tworzenia wątku: ${threadError.message}`);
      continue;
    }

    threadsCreated++;

    // Update emails with thread_id, subject_normalized, is_incoming, response_time
    for (let i = 0; i < group.emails.length; i++) {
      const email = group.emails[i];
      const incoming = isIncoming(email.from_address, mailboxEmail);

      let responseTime: number | null = null;
      if (i > 0) {
        const prev = group.emails[i - 1];
        const prevIncoming = isIncoming(prev.from_address, mailboxEmail);
        if (prevIncoming !== incoming) {
          responseTime = calcResponseTimeMinutes(
            email.sent_at || email.received_at,
            prev.sent_at || prev.received_at
          );
        }
      }

      const { error: updateError } = await supabase
        .from('emails')
        .update({
          thread_id: thread.id,
          subject_normalized: group.subjectNormalized,
          is_incoming: incoming,
          response_time_minutes: responseTime,
        })
        .eq('id', email.id);

      if (updateError) {
        console.error(`Błąd aktualizacji emaila ${email.id}: ${updateError.message}`);
      } else {
        emailsUpdated++;
      }
    }
  }

  return { threadsCreated, emailsUpdated };
}
