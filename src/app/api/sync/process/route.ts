import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto/encrypt';
import { getAccessToken } from '@/lib/email/graph-auth';
import { createGraphClient } from '@/lib/email/graph-client';
import { mapGraphMessageToEmail } from '@/lib/email/email-parser';
import { getExcludedFolderIds } from '@/lib/email/graph-folders';
import {
  fetchMessagesPage,
  fetchMessagesSince,
  upsertEmails,
  getMailboxMessageCount,
  filterExcludedFolders,
} from '@/lib/email/email-fetcher';
import { getAdminClient } from '@/lib/api/admin';
import {
  applyMailboxDemoScope,
  isMailboxInScope,
  verifyScopedAdminAccess,
} from '@/lib/api/demo-scope';
import type { MailboxCredentials, SyncJobStatus } from '@/types/email';

// Vercel function timeout — max 60s for processing a batch
export const maxDuration = 60;

// Safety timeout: stop processing if approaching Vercel limit
const SAFETY_TIMEOUT_MS = 50_000;

/**
 * POST /api/sync/process — Process the next batch of a sync job.
 *
 * Body: { jobId: string }
 * Returns: { status, fetched, totalFetched, estimatedTotal, hasMore }
 *
 * Fetches up to 100 messages per batch, upserts to DB, updates job state.
 * Safety timeout at 50s to avoid Vercel 60s hard limit.
 */
export async function POST(request: Request) {
  const batchStartTime = Date.now();

  const scope = await verifyScopedAdminAccess();
  if (!scope) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Nieprawidłowy format danych' },
      { status: 400 }
    );
  }

  const { jobId } = body;

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId jest wymagany' },
      { status: 400 }
    );
  }

  // Fetch sync job
  const { data: job, error: jobError } = await adminClient
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: 'Zadanie synchronizacji nie zostało znalezione' },
      { status: 404 }
    );
  }

  const mailboxAllowed = await isMailboxInScope(adminClient, job.mailbox_id, scope.isDemoUser);
  if (!mailboxAllowed) {
    return NextResponse.json(
      { error: 'Zadanie synchronizacji nie zostało znalezione' },
      { status: 404 }
    );
  }

  // Validate job status
  const allowedStatuses: SyncJobStatus[] = ['pending', 'processing', 'has_more'];
  if (!allowedStatuses.includes(job.status)) {
    return NextResponse.json(
      { error: `Zadanie ma status '${job.status}' — nie można kontynuować` },
      { status: 400 }
    );
  }

  // Fetch mailbox
  let mailboxQuery = adminClient
    .from('mailboxes')
    .select('id, email_address, connection_type, credentials_encrypted, tenant_id, client_id, last_sync_at')
    .eq('id', job.mailbox_id);
  mailboxQuery = applyMailboxDemoScope(mailboxQuery, scope.isDemoUser);
  const { data: mailbox, error: mailboxError } = await mailboxQuery.single();

  if (mailboxError || !mailbox) {
    await failJob(adminClient, jobId, job.mailbox_id, 'Skrzynka nie została znaleziona');
    return NextResponse.json(
      { error: 'Skrzynka powiązana z zadaniem nie istnieje' },
      { status: 404 }
    );
  }

  if (!mailbox.credentials_encrypted) {
    await failJob(adminClient, jobId, job.mailbox_id, 'Brak danych logowania');
    return NextResponse.json(
      { error: 'Brak zapisanych danych logowania' },
      { status: 400 }
    );
  }

  // Decrypt credentials and get access token
  let accessToken: string;
  try {
    const decrypted = JSON.parse(decrypt(mailbox.credentials_encrypted));

    let credentials: MailboxCredentials;
    if (mailbox.connection_type === 'ropc') {
      credentials = {
        type: 'ropc',
        tenantId: mailbox.tenant_id,
        clientId: mailbox.client_id,
        username: decrypted.username,
        password: decrypted.password,
      };
    } else {
      credentials = {
        type: 'client_credentials',
        tenantId: mailbox.tenant_id,
        clientId: mailbox.client_id,
        clientSecret: decrypted.clientSecret,
      };
    }

    accessToken = await getAccessToken(credentials);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    await failJob(adminClient, jobId, job.mailbox_id, `Błąd autentykacji: ${msg}`);
    return NextResponse.json(
      { error: `Błąd autentykacji: ${msg}` },
      { status: 500 }
    );
  }

  // Safety timeout check before Graph API call
  if (Date.now() - batchStartTime > SAFETY_TIMEOUT_MS) {
    await saveProgress(adminClient, jobId, job.page_token, job.emails_fetched, 'has_more');
    return NextResponse.json({
      status: 'has_more',
      fetched: 0,
      totalFetched: job.emails_fetched,
      estimatedTotal: job.emails_total_estimate,
      hasMore: true,
      message: 'Limit czasu — kontynuuj następnym batchem',
    });
  }

  const graphClient = createGraphClient(accessToken);

  // Get excluded folder IDs (cached in job metadata for subsequent batches)
  let excludedFolderIds: string[] = [];
  const jobMetadata = job.metadata as { excludedFolderIds?: string[] } | null;

  if (jobMetadata?.excludedFolderIds) {
    // Reuse from previous batch
    excludedFolderIds = jobMetadata.excludedFolderIds;
  } else {
    // First batch — fetch from Graph API and cache in job metadata
    try {
      excludedFolderIds = await getExcludedFolderIds(graphClient, mailbox.email_address);
      await adminClient
        .from('sync_jobs')
        .update({ metadata: { excludedFolderIds } })
        .eq('id', jobId);
    } catch {
      console.warn('Could not fetch excluded folders — syncing all folders');
    }
  }

  try {
    // Mark job as processing
    await adminClient
      .from('sync_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Get estimated total on first batch of full sync
    let estimatedTotal = job.emails_total_estimate;
    if (!job.page_token && job.job_type === 'full' && !estimatedTotal) {
      try {
        estimatedTotal = await getMailboxMessageCount(graphClient, mailbox.email_address);
        await adminClient
          .from('sync_jobs')
          .update({ emails_total_estimate: estimatedTotal })
          .eq('id', jobId);
      } catch {
        // Non-critical — continue without estimate
        console.warn('Could not get message count estimate');
      }
    }

    let fetchedCount = 0;
    let newPageToken: string | null = null;

    if (job.job_type === 'full') {
      // Full sync — paginated fetch
      const result = await fetchMessagesPage(
        graphClient,
        mailbox.email_address,
        job.page_token
      );

      // Filter out excluded folders (spam, drafts, deleted items)
      const filteredMessages = filterExcludedFolders(result.messages, excludedFolderIds);
      const parsed = filteredMessages.map((msg) =>
        mapGraphMessageToEmail(msg, mailbox.id)
      );

      if (parsed.length > 0) {
        fetchedCount = await upsertEmails(adminClient, mailbox.id, parsed);
      }

      newPageToken = result.nextLink;
    } else {
      // Delta sync — fetch messages since last sync date (all folders)
      const sinceDate = mailbox.last_sync_at || new Date(0).toISOString();

      const result = await fetchMessagesSince(
        graphClient,
        mailbox.email_address,
        sinceDate,
        job.page_token
      );

      // Filter out excluded folders
      const filteredMessages = filterExcludedFolders(result.messages, excludedFolderIds);
      const parsed = filteredMessages.map((msg) =>
        mapGraphMessageToEmail(msg, mailbox.id)
      );

      if (parsed.length > 0) {
        fetchedCount = await upsertEmails(adminClient, mailbox.id, parsed);
      }

      newPageToken = result.nextLink;
    }

    const totalFetched = (job.emails_fetched || 0) + fetchedCount;
    const hasMore = newPageToken !== null;
    const newStatus: SyncJobStatus = hasMore ? 'has_more' : 'completed';

    // Update sync job
    const jobUpdate: Record<string, unknown> = {
      status: newStatus,
      emails_fetched: totalFetched,
      page_token: newPageToken,
    };

    if (newStatus === 'completed') {
      jobUpdate.completed_at = new Date().toISOString();
    }

    await adminClient
      .from('sync_jobs')
      .update(jobUpdate)
      .eq('id', jobId);

    // If completed, update mailbox
    if (newStatus === 'completed') {
      // Count total emails for this mailbox
      const { count: emailCount } = await adminClient
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .eq('is_deleted', false);

      const mailboxUpdate: Record<string, unknown> = {
        sync_status: 'synced',
        last_sync_at: new Date().toISOString(),
        total_emails: emailCount ?? 0,
      };

      await adminClient
        .from('mailboxes')
        .update(mailboxUpdate)
        .eq('id', mailbox.id);
    }

    // Include total emails in database when completed
    let totalInDatabase: number | null = null;
    if (newStatus === 'completed') {
      const { count } = await adminClient
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('mailbox_id', mailbox.id)
        .eq('is_deleted', false);
      totalInDatabase = count ?? null;
    }

    return NextResponse.json({
      status: newStatus,
      fetched: fetchedCount,
      totalFetched,
      estimatedTotal,
      hasMore,
      totalInDatabase,
    });
  } catch (error: unknown) {
    // Handle Graph API errors
    const graphError = error as { statusCode?: number; message?: string; code?: string };

    // 429 — Throttled by Microsoft
    if (graphError?.statusCode === 429) {
      const retryAfter = (error as { headers?: Record<string, string> })?.headers?.['retry-after'];
      await failJob(
        adminClient,
        jobId,
        job.mailbox_id,
        `Throttling (429) — Microsoft ograniczył liczbę zapytań. Spróbuj ponownie za ${retryAfter || '60'} sekund.`
      );
      return NextResponse.json(
        {
          error: 'Throttling — zbyt wiele zapytań do Microsoft Graph API',
          retryAfter: retryAfter ? parseInt(retryAfter) : 60,
        },
        { status: 429 }
      );
    }

    const msg = graphError?.message || (error instanceof Error ? error.message : String(error));
    await failJob(adminClient, jobId, job.mailbox_id, `Błąd Graph API: ${msg}`);

    return NextResponse.json(
      { error: `Błąd synchronizacji: ${msg}` },
      { status: 500 }
    );
  }
}

// --- Helper functions ---

/**
 * Mark a sync job as failed and update mailbox status to error.
 */
async function failJob(
  adminClient: ReturnType<typeof getAdminClient>,
  jobId: string,
  mailboxId: string,
  errorMessage: string
) {
  await adminClient
    .from('sync_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  await adminClient
    .from('mailboxes')
    .update({ sync_status: 'error' })
    .eq('id', mailboxId);
}

/**
 * Save progress (page_token) and set status to has_more.
 * Used when hitting safety timeout.
 */
async function saveProgress(
  adminClient: ReturnType<typeof getAdminClient>,
  jobId: string,
  pageToken: string | null,
  emailsFetched: number,
  status: SyncJobStatus
) {
  await adminClient
    .from('sync_jobs')
    .update({
      status,
      page_token: pageToken,
      emails_fetched: emailsFetched,
    })
    .eq('id', jobId);
}
