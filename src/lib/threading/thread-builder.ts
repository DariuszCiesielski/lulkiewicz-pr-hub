/**
 * Email threading algorithm.
 *
 * Strategy (in priority order):
 * 1. Link via In-Reply-To / References headers
 * 2. Fallback: normalized subject match (max 30 days gap)
 *
 * Produces email_threads records and updates emails with thread_id.
 * Optionally generates AI summaries and smart status detection per thread.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAIConfig, callAI, type AIConfig } from '@/lib/ai/ai-provider';

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

/**
 * Extract domain from an email address.
 */
function getDomain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  return atIndex >= 0 ? email.slice(atIndex + 1).toLowerCase() : '';
}

/**
 * Determine if an email is incoming (from outside the organization).
 *
 * Uses domain comparison: emails from the same domain as the mailbox
 * are considered outgoing (from the organization / administration),
 * emails from other domains are incoming (from residents / external).
 *
 * This approach works even when we only sync the Inbox folder,
 * because outgoing replies from staff members within the same domain
 * (e.g. jan.kowalski@domain.pl replying from administracja@domain.pl)
 * are correctly identified as organizational / outgoing.
 */
export function isIncoming(
  fromAddress: string | null,
  mailboxEmail: string
): boolean {
  if (!fromAddress) return true;
  const fromDomain = getDomain(fromAddress);
  const mailboxDomain = getDomain(mailboxEmail);
  if (!fromDomain || !mailboxDomain) return true;
  return fromDomain !== mailboxDomain;
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
  from_name: string | null;
  sent_at: string | null;
  received_at: string;
  body_text: string | null;
  header_message_id: string | null;
  header_in_reply_to: string | null;
  header_references: string[];
  to_addresses: { address: string; name: string }[] | null;
}

interface ThreadGroup {
  emails: RawEmail[];
  subjectNormalized: string;
}

export interface BuildThreadsOptions {
  generateAiSummaries?: boolean;
}

// --- AI Summary types ---

interface ThreadSummaryResult {
  summary: string;
  status: 'open' | 'closed_positive' | 'closed_negative' | 'pending';
}

// --- AI Summary generation ---

const AI_SUMMARY_SYSTEM_PROMPT = `Jesteś asystentem zarządcy nieruchomości. Analizujesz wątki emailowe z administracji osiedli.

Dla każdego wątku musisz zwrócić JSON z dwoma polami:
1. "summary" — zwięzłe podsumowanie wątku w 1-2 zdaniach po polsku. Opisz główny temat i aktualny stan sprawy.
2. "status" — jeden z czterech statusów:
   - "open" — sprawa w toku, trwa wymiana wiadomości, obie strony aktywne
   - "pending" — ostatnia wiadomość jest od mieszkańca/zewnętrznej osoby, administracja jeszcze nie odpowiedziała
   - "closed_positive" — sprawa zakończona pozytywnie (problem rozwiązany, prośba spełniona, podziękowanie)
   - "closed_negative" — sprawa zakończona negatywnie (odmowa, brak rozwiązania, reklamacja odrzucona, eskalacja)

Zwracaj WYŁĄCZNIE prawidłowy JSON bez dodatkowego tekstu:
{"summary": "...", "status": "..."}`;

/**
 * Build a user prompt from thread emails for AI summary.
 * Includes first email body + last email body, max ~3000 chars total.
 */
function buildSummaryUserPrompt(
  threadEmails: RawEmail[],
  mailboxEmail: string
): string {
  const MAX_BODY_CHARS = 1200;

  function formatEmail(e: RawEmail): string {
    const direction = isIncoming(e.from_address, mailboxEmail) ? 'PRZYCHODZACY' : 'WYCHODZACY';
    const date = e.sent_at || e.received_at;
    const body = (e.body_text || '').slice(0, MAX_BODY_CHARS);
    return `[${direction}] Od: ${e.from_name || e.from_address || 'nieznany'} | Data: ${date}\n${body}`;
  }

  const parts: string[] = [];
  parts.push(`Temat: ${threadEmails[0].subject || '(brak tematu)'}`);
  parts.push(`Liczba wiadomości: ${threadEmails.length}`);
  parts.push('');

  // First email
  parts.push('--- Pierwsza wiadomość ---');
  parts.push(formatEmail(threadEmails[0]));

  // Last email (if different from first)
  if (threadEmails.length > 1) {
    const lastEmail = threadEmails[threadEmails.length - 1];
    parts.push('');
    parts.push('--- Ostatnia wiadomość ---');
    parts.push(formatEmail(lastEmail));
  }

  // Middle messages summary (if more than 2)
  if (threadEmails.length > 2) {
    const middleCount = threadEmails.length - 2;
    const middleIncoming = threadEmails.slice(1, -1).filter(e => isIncoming(e.from_address, mailboxEmail)).length;
    parts.push('');
    parts.push(`(Pominięto ${middleCount} wiadomości pośrednich: ${middleIncoming} przychodzących, ${middleCount - middleIncoming} wychodzących)`);
  }

  return parts.join('\n');
}

/**
 * Parse AI response for thread summary.
 * Gracefully handles malformed JSON.
 */
function parseSummaryResponse(content: string): ThreadSummaryResult | null {
  try {
    // Try to extract JSON from possible markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const validStatuses = ['open', 'closed_positive', 'closed_negative', 'pending'];

    if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) return null;
    if (!validStatuses.includes(parsed.status)) return null;

    return {
      summary: parsed.summary.trim(),
      status: parsed.status,
    };
  } catch {
    return null;
  }
}

/**
 * Generate AI summaries for threads in batches.
 * Returns a map of threadIndex -> { summary, status }.
 * Graceful: if AI is not configured, returns empty map.
 */
async function generateThreadSummaries(
  supabase: SupabaseClient,
  threadGroups: { emails: RawEmail[]; index: number }[],
  mailboxEmail: string
): Promise<Map<number, ThreadSummaryResult>> {
  const results = new Map<number, ThreadSummaryResult>();

  // Try to load AI config — if not configured, skip silently
  let aiConfig: AIConfig;
  try {
    aiConfig = await loadAIConfig(supabase);
  } catch {
    return results;
  }

  const AI_BATCH_SIZE = 5;

  for (let i = 0; i < threadGroups.length; i += AI_BATCH_SIZE) {
    const batch = threadGroups.slice(i, i + AI_BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (group) => {
        const userPrompt = buildSummaryUserPrompt(group.emails, mailboxEmail);
        const response = await callAI(aiConfig, AI_SUMMARY_SYSTEM_PROMPT, userPrompt);
        const parsed = parseSummaryResponse(response.content);
        return { index: group.index, result: parsed };
      })
    );

    for (const settledResult of batchResults) {
      if (settledResult.status === 'fulfilled' && settledResult.value.result) {
        results.set(settledResult.value.index, settledResult.value.result);
      }
    }
  }

  return results;
}

// --- CC filter status computation ---

export type CcFilterStatusValue = 'direct' | 'cc_first_only' | 'cc_always';

/**
 * Determine if the mailbox is a direct recipient (To) or only CC/BCC in this thread.
 *
 * - 'direct': mailbox appears in To field in at least one email, including the first
 * - 'cc_first_only': first email has mailbox in CC/BCC only, but later emails have it in To
 * - 'cc_always': mailbox never appears in To field in any email
 */
export function computeCcFilterStatus(
  emails: RawEmail[],
  mailboxEmail: string
): CcFilterStatusValue {
  const mailboxAddr = mailboxEmail.toLowerCase();

  const firstEmailHasTo = emails[0]?.to_addresses
    ?.some((r) => r.address.toLowerCase() === mailboxAddr) ?? false;

  const anyEmailHasTo = emails.some(
    (e) => e.to_addresses?.some((r) => r.address.toLowerCase() === mailboxAddr) ?? false
  );

  if (anyEmailHasTo && firstEmailHasTo) return 'direct';
  if (anyEmailHasTo && !firstEmailHasTo) return 'cc_first_only';
  return 'cc_always';
}

// --- Main builder ---

export async function buildThreadsForMailbox(
  supabase: SupabaseClient,
  mailboxId: string,
  mailboxEmail: string,
  options: BuildThreadsOptions = {}
): Promise<{ threadsCreated: number; emailsUpdated: number; summariesGenerated: number }> {
  // 1. Fetch all emails for this mailbox (paginated — Supabase returns max 1000 per query)
  const PAGE_SIZE = 1000;
  const emails: RawEmail[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('emails')
      .select('id, mailbox_id, subject, from_address, from_name, sent_at, received_at, body_text, header_message_id, header_in_reply_to, header_references, to_addresses')
      .eq('mailbox_id', mailboxId)
      .eq('is_deleted', false)
      .order('received_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Blad pobierania emaili: ${error.message}`);
    if (!data || data.length === 0) break;

    emails.push(...data);

    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  if (emails.length === 0) return { threadsCreated: 0, emailsUpdated: 0, summariesGenerated: 0 };

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

  // 5. Compute all thread metadata in memory before DB operations
  interface ThreadRow {
    mailbox_id: string;
    subject_normalized: string;
    first_message_at: string;
    last_message_at: string;
    message_count: number;
    participant_addresses: string[];
    status: string;
    summary: string | null;
    avg_response_time_minutes: number | null;
    cc_filter_status: string;
  }

  interface EmailUpdate {
    id: string;
    threadIndex: number; // maps to thread insert order
    subject_normalized: string;
    is_incoming: boolean;
    response_time_minutes: number | null;
  }

  const threadRows: ThreadRow[] = [];
  const emailUpdates: EmailUpdate[] = [];
  const threadGroupsForAI: { emails: RawEmail[]; index: number }[] = [];

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

    const lastIsIncoming = isIncoming(lastEmail.from_address, mailboxEmail);
    const threadIndex = threadRows.length;

    threadRows.push({
      mailbox_id: mailboxId,
      subject_normalized: group.subjectNormalized || '(brak tematu)',
      first_message_at: firstEmail.sent_at || firstEmail.received_at,
      last_message_at: lastEmail.sent_at || lastEmail.received_at,
      message_count: group.emails.length,
      participant_addresses: Array.from(participants),
      status: lastIsIncoming ? 'pending' : 'open',
      summary: null,
      avg_response_time_minutes: avgResponseTime,
      cc_filter_status: computeCcFilterStatus(group.emails, mailboxEmail),
    });

    // Collect thread groups for AI summary generation
    threadGroupsForAI.push({ emails: group.emails, index: threadIndex });

    // Prepare email updates
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

      emailUpdates.push({
        id: email.id,
        threadIndex,
        subject_normalized: group.subjectNormalized,
        is_incoming: incoming,
        response_time_minutes: responseTime,
      });
    }
  }

  // 5b. Generate AI summaries (graceful — skips if AI not configured)
  const summaries = options.generateAiSummaries === false
    ? new Map<number, ThreadSummaryResult>()
    : await generateThreadSummaries(
      supabase,
      threadGroupsForAI,
      mailboxEmail
    );

  // Apply AI summaries and status to thread rows
  let summariesGenerated = 0;
  for (const [index, result] of summaries) {
    threadRows[index].summary = result.summary;
    threadRows[index].status = result.status;
    summariesGenerated++;
  }

  // 6. Delete existing threads for this mailbox (rebuild)
  await supabase
    .from('emails')
    .update({ thread_id: null })
    .eq('mailbox_id', mailboxId);

  await supabase
    .from('email_threads')
    .delete()
    .eq('mailbox_id', mailboxId);

  // 7. Batch insert threads (in chunks of 500)
  const THREAD_BATCH_SIZE = 500;
  const allThreadIds: string[] = [];

  for (let i = 0; i < threadRows.length; i += THREAD_BATCH_SIZE) {
    const batch = threadRows.slice(i, i + THREAD_BATCH_SIZE);
    const { data, error: insertError } = await supabase
      .from('email_threads')
      .insert(batch)
      .select('id');

    if (insertError) {
      throw new Error(`Blad tworzenia watkow: ${insertError.message}`);
    }

    for (const row of data) {
      allThreadIds.push(row.id);
    }
  }

  // 8. Batch update emails in parallel (chunks of 100 concurrent)
  const EMAIL_BATCH_SIZE = 100;
  let emailsUpdated = 0;

  for (let i = 0; i < emailUpdates.length; i += EMAIL_BATCH_SIZE) {
    const batch = emailUpdates.slice(i, i + EMAIL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((update) =>
        supabase
          .from('emails')
          .update({
            thread_id: allThreadIds[update.threadIndex],
            subject_normalized: update.subject_normalized,
            is_incoming: update.is_incoming,
            response_time_minutes: update.response_time_minutes,
          })
          .eq('id', update.id)
      )
    );

    emailsUpdated += results.filter((r) => !r.error).length;
  }

  return { threadsCreated: allThreadIds.length, emailsUpdated, summariesGenerated };
}
