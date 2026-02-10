# Phase 2: Email Connection & Fetching - Research

**Researched:** 2026-02-10
**Domain:** Microsoft Graph API email access, AES-256 encryption, chunked sync on Vercel, email parsing
**Confidence:** HIGH

## Summary

Phase 2 wymaga podlaczenia skrzynek Microsoft 365 do aplikacji, bezpiecznego przechowywania credentials, pobrania tysiecy maili z widocznym progressem i sparsowania naglowkow/tresci. Kluczowe wyzwania: autentykacja do Microsoft Graph API (ROPC vs client_credentials), limit 60s Vercel na API routes (wymaga chunked sync), oraz parsowanie HTML emaili Outlooka z polskimi znakami.

Decyzje z CONTEXT.md zamykaja scope: Microsoft Graph API jako protokol, login+haslo z AES-256 jako primary auth (OAuth2 jako upgrade path), polling-driven chunked sync z progress barem. Badanie skupilo sie na konkretnych bibliotekach, wzorcach implementacji i pulapkach.

Istotne odkrycie: ROPC (Resource Owner Password Credentials) flow, ktory umozliwia uzycie username+password z Graph API, jest oficjalnie odradzany przez Microsoft i moze byc zablokowany jesli tenant ma wlaczone MFA. Jednoczesnie Microsoft wymusza MFA na coraz wiekszej liczbie scenariuszy. Rekomendacja: implementuj ROPC jako primary (dziala gdy MFA wylaczone), ale przygotuj architekture na latwy upgrade do client_credentials flow (preferowane rozwiazanie produkcyjne).

**Primary recommendation:** Uzyj `@azure/msal-node` z ROPC flow do autentykacji username+password, `@microsoft/microsoft-graph-client` do API calls, polling-driven chunked sync (max 100 maili per batch), i `html-to-text` do konwersji HTML na plaintext.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@azure/msal-node` | 3.x | Autentykacja OAuth2 (ROPC + client_credentials) | Oficjalna biblioteka Microsoft do auth, obsluguje token cache, refresh |
| `@microsoft/microsoft-graph-client` | 3.0.7 | HTTP client do Graph API | Oficjalny SDK, middleware pattern, paginacja, retry |
| `@microsoft/microsoft-graph-types` | latest | TypeScript types dla Graph entities | Oficjalne typy, intellisense dla Message, MailFolder |
| `html-to-text` | latest (9.x) | Konwersja HTML emaili na plaintext | 1367 dependents, obsluguje tabele/listy/linki, aktywny rozwoj |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | - | AES-256-GCM encrypt/decrypt | Szyfrowanie credentials w bazie |
| `date-fns` | 3.x | Formatowanie dat (PL locale) | Wyswietlanie dat sync, email timestamps |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@azure/msal-node` | `@azure/identity` | `@azure/identity` nie obsluguje ROPC, tylko client_credentials/certificate. Uzyj jesli upgrade do OAuth2 client_credentials |
| `@microsoft/microsoft-graph-client` 3.x | `@microsoft/msgraph-sdk` 1.x | Nowy SDK (msgraph-sdk) jest nowszy ale mniej dojrzaly. 3.x jest stabilny i szeroko uzywany |
| `html-to-text` | Regex strip tags | Regex gubi strukture (listy, tabele, cytaty). `html-to-text` poprawnie konwertuje formatowanie |
| Polling | SSE (Server-Sent Events) | SSE wymaga utrzymywania polaczenia, problematyczne na Vercel serverless. Polling prostszy i niezawodny |

**Installation:**
```bash
npm install @azure/msal-node @microsoft/microsoft-graph-client @microsoft/microsoft-graph-types html-to-text
npm install -D @types/html-to-text
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    email/
      graph-client.ts        # Microsoft Graph API client factory
      graph-auth.ts           # MSAL auth (ROPC + client_credentials)
      email-fetcher.ts        # Fetch messages with pagination
      email-parser.ts         # Parse headers + HTML to plaintext
    crypto/
      encrypt.ts              # AES-256-GCM (skopiowany wzorzec z Marketing Hub)
    supabase/
      client.ts               # (existing)
      server.ts               # (existing)
  app/
    api/
      mailboxes/
        route.ts              # CRUD skrzynek (GET list, POST create, DELETE)
        [id]/
          route.ts            # GET/PUT/DELETE single mailbox
          test-connection/
            route.ts          # POST test connection
      sync/
        route.ts              # POST start sync job
        process/
          route.ts            # POST process next batch
        status/
          [jobId]/
            route.ts          # GET sync job status
    (hub)/
      email-analyzer/
        mailboxes/
          page.tsx            # Mailbox management UI (admin only)
  components/
    email/
      MailboxList.tsx         # Lista skrzynek ze statusami
      MailboxForm.tsx         # Formularz dodawania skrzynki
      SyncProgress.tsx        # Progress bar synchronizacji
      ConnectionStatus.tsx    # Indicator polaczenia (zielony/czerwony)
  types/
    email.ts                  # TypeScript types for email domain
```

### Pattern 1: Two-Phase Auth Strategy (ROPC primary, Client Credentials upgrade)

**What:** Architektura autentykacji obslugujaca dwie sciezki: ROPC (username+password) i client_credentials (Azure App Registration).

**When to use:** Gdy czesc skrzynek moze miec dostep do Azure Portal (client_credentials), a czesc nie (ROPC).

**Example:**
```typescript
// src/lib/email/graph-auth.ts
import { ConfidentialClientApplication, PublicClientApplication } from '@azure/msal-node';

interface ROPCCredentials {
  type: 'ropc';
  tenantId: string;
  clientId: string;
  username: string;
  password: string;
}

interface ClientCredentials {
  type: 'client_credentials';
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

type MailboxCredentials = ROPCCredentials | ClientCredentials;

async function getAccessToken(credentials: MailboxCredentials): Promise<string> {
  if (credentials.type === 'ropc') {
    const pca = new PublicClientApplication({
      auth: {
        clientId: credentials.clientId,
        authority: `https://login.microsoftonline.com/${credentials.tenantId}`,
      },
    });

    const result = await pca.acquireTokenByUsernamePassword({
      scopes: ['https://graph.microsoft.com/Mail.Read'],
      username: credentials.username,
      password: credentials.password,
    });

    return result!.accessToken;
  }

  // Client credentials flow
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: credentials.clientId,
      authority: `https://login.microsoftonline.com/${credentials.tenantId}`,
      clientSecret: credentials.clientSecret,
    },
  });

  const result = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return result!.accessToken;
}
```

### Pattern 2: Polling-Driven Chunked Sync

**What:** Frontend inicjuje sync job, backend przetwarza po 1 stronie (max 100 maili), frontend polluje status i wywoluje kolejny batch.

**When to use:** Kazda operacja pobierania maili (bulk sync i delta sync).

**Example:**
```typescript
// POST /api/sync/route.ts - Start sync
export async function POST(request: Request) {
  const { mailboxId } = await request.json();

  // Create sync job in DB
  const { data: job } = await adminClient
    .from('sync_jobs')
    .insert({
      mailbox_id: mailboxId,
      status: 'pending',
      emails_fetched: 0,
    })
    .select()
    .single();

  return Response.json({ jobId: job.id });
}

// POST /api/sync/process/route.ts - Process next batch
export const maxDuration = 60; // Vercel timeout safety

export async function POST(request: Request) {
  const { jobId } = await request.json();

  const job = await getJob(jobId);
  const credentials = await decryptCredentials(job.mailbox_id);
  const token = await getAccessToken(credentials);

  // Use page_token or build initial URL
  const url = job.page_token ||
    `/users/${job.email_address}/mailFolders/inbox/messages`;

  const response = await graphClient
    .api(url)
    .top(100)
    .select('id,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,body,internetMessageId,conversationId,hasAttachments,internetMessageHeaders')
    .header('Prefer', 'outlook.body-content-type="text"')
    .get();

  // Upsert emails
  await upsertEmails(job.mailbox_id, response.value);

  const hasMore = !!response['@odata.nextLink'];

  await updateJob(jobId, {
    status: hasMore ? 'has_more' : 'completed',
    page_token: response['@odata.nextLink'] || null,
    emails_fetched: job.emails_fetched + response.value.length,
  });

  return Response.json({
    status: hasMore ? 'has_more' : 'completed',
    fetched: response.value.length,
    totalFetched: job.emails_fetched + response.value.length,
  });
}
```

### Pattern 3: Frontend Sync Hook with Polling

**What:** React hook ktory zarzadza cyklem sync: start -> poll -> process -> repeat.

**When to use:** UI synchronizacji maili.

**Example:**
```typescript
// src/hooks/useSyncJob.ts
function useSyncJob() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState({ fetched: 0, total: 0 });

  const startSync = async (mailboxId: string) => {
    setStatus('syncing');
    const res = await fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ mailboxId }),
    });
    const { jobId } = await res.json();
    setJobId(jobId);
    processBatch(jobId);
  };

  const processBatch = async (jId: string) => {
    try {
      const res = await fetch('/api/sync/process', {
        method: 'POST',
        body: JSON.stringify({ jobId: jId }),
      });
      const data = await res.json();

      setProgress({ fetched: data.totalFetched, total: data.estimatedTotal || 0 });

      if (data.status === 'has_more') {
        // Small delay to avoid hammering, then continue
        setTimeout(() => processBatch(jId), 500);
      } else {
        setStatus('completed');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return { startSync, status, progress, jobId };
}
```

### Pattern 4: AES-256-GCM Credentials Encryption (Marketing Hub Pattern)

**What:** Identyczny wzorzec jak w Marketing Hub. Credentials szyfrowane przed zapisem do Supabase, deszyfrowane server-side w API routes.

**When to use:** Przechowywanie credentials skrzynek (password, client_secret).

**Example:**
```typescript
// src/lib/crypto/encrypt.ts
// Identyczny kod jak w Marketing Hub (juz istnieje i jest sprawdzony)
// Format: iv:authTag:ciphertext (base64)
// Env var: ENCRYPTION_KEY (64 hex chars = 32 bytes)

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivB64, authTagB64, ciphertext] = encrypted.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Anti-Patterns to Avoid

- **Przechowywanie Graph API access tokenow w bazie:** Tokeny wygasaja po ~3600s, nie ma sensu ich zapisywac. Pobieraj nowy token przed kazdym batch sync.
- **Uzywanie Graph API `id` jako primary key emaila:** Microsoft ostrzega: ID moze sie zmienic po migracji skrzynki. Uzywaj `internetMessageId` (RFC 822 Message-ID) jako natural key.
- **Dodawanie query params do URL z `@odata.nextLink`:** Parametry sa juz zakodowane w tokenie. Nie dodawaj `$select`, `$top` itp. do URL z `nextLink`.
- **Przetwarzanie calego body HTML regexem:** Email HTML z Outlooka zawiera `<o:p>`, `mso-*` styles, komentarze warunkowe `<!--[if gte mso 9]>`. Regex to nie obsluzy. Uzyj `html-to-text`.
- **Synchronizacja skrzynek rownolegle podczas initial sync:** Rate limiting Graph API jest per-app-per-tenant. Rownolegle zapytania do 3+ skrzynek szybko przekrocza limit. Synchronizuj sekwencyjnie.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token management | Custom HTTP token requests | `@azure/msal-node` | Obsluguje token cache, refresh, ROPC, client_credentials, retry |
| Graph API HTTP client | Custom fetch wrapper | `@microsoft/microsoft-graph-client` | Middleware pattern, paginacja, retry, auth provider integration |
| HTML to plaintext | Regex `/<[^>]+>/g` | `html-to-text` | Zachowuje formatowanie tabel/list, obsluguje Outlook-specific HTML |
| AES-256-GCM encryption | Custom crypto implementation | Wzorzec z Marketing Hub (Node.js `crypto`) | Sprawdzony pattern, poprawna obsluga IV + auth tag |
| Paginacja Graph API | Manual URL building | `@odata.nextLink` from response | Microsoft automatycznie koduje parametry w tokenach paginacji |

**Key insight:** Microsoft Graph SDK i MSAL juz obsluguja wiekszosci edge-casow (token expiry, throttling, pagination). Nie buduj wlasnych wrapperow na te mechanizmy.

## Common Pitfalls

### Pitfall 1: ROPC zablokowane przez MFA

**What goes wrong:** Tenant Microsoft 365 ma wlaczone MFA (Security Defaults lub Conditional Access). ROPC flow zwraca blad `AADSTS50076` lub `AADSTS50079` (MFA required).

**Why it happens:** Microsoft wymusza MFA na coraz wiekszej liczbie scenariuszy. Od lipca 2025 MFA enforcement rozszerzono na non-interactive flows. ROPC jest z definicji niekompatybilne z MFA.

**How to avoid:**
1. Przed implementacja zweryfikuj z administratorem tenanta czy MFA jest wlaczone na kontach skrzynek
2. Jesli MFA wlaczone: uzyj client_credentials flow (wymaga Azure App Registration z admin consent)
3. Jesli MFA wylaczone: ROPC zadziala, ale przygotuj upgrade path
4. W formularzu konfiguracji skrzynki dodaj toggle "Typ autentykacji" (login+haslo / OAuth2)
5. Test connection endpoint musi jasno komunikowac blad MFA

**Warning signs:** Blad 400 z trescia `AADSTS50076`, `AADSTS50079`, `AADSTS65001`

### Pitfall 2: Graph API Throttling (429 Too Many Requests)

**What goes wrong:** Przy initial sync 5000+ maili, agresywne zapytania powoduja blad 429 z headerem `Retry-After`.

**Why it happens:** Microsoft Graph ma limity per-app-per-tenant. Outlook API ma dodatkowe, niepublikowane limity per-mailbox.

**How to avoid:**
1. `$top=100` (nie wiecej) dla paginacji
2. Dodaj 200-500ms delay miedzy stronami
3. Implementuj exponential backoff z obsluga headera `Retry-After`
4. Synchronizuj skrzynki sekwencyjnie (nie rownolegle)
5. Uzywaj `$select` aby pobierac tylko potrzebne pola

**Warning signs:** HTTP 429, header `Retry-After`, header `x-ms-throttle-limit-percentage` blisko 1.0

### Pitfall 3: Delta token expiration

**What goes wrong:** `deltaToken` zapisany w bazie wygasa (czas nieudokumentowany oficjalnie). Nastepne zapytanie z wygaslym tokenem zwraca blad.

**Why it happens:** Delta query to stateful API. Tokeny maja ograniczony czas zycia.

**How to avoid:**
1. Implementuj fallback: jesli delta query zwroci blad (410 Gone), wykonaj full resync
2. Zapisuj `deltaLink` w tabeli `mailboxes` po kazdym ukonczonym cyklu sync
3. Przy full resync: usun stary `deltaLink`, zacznij od zera

**Warning signs:** HTTP 410 Gone, bledy paginacji

### Pitfall 4: Polskie znaki w tresci maili

**What goes wrong:** Graph API zwraca body jako HTML. Przy konwersji na plaintext, polskie znaki diakrytyczne (aczelnoszz) moga byc uszkodzone.

**Why it happens:** Graph API zwraca tresc w UTF-8, ale oryginalny email mogl byc w Windows-1250 lub ISO-8859-2. Graph normalizuje do UTF-8, wiec problem jest mniejszy niz przy IMAP. Glowne ryzyko to HTML entities (`&oacute;` zamiast `o`) i Outlook-specific encoding.

**How to avoid:**
1. Uzywaj headera `Prefer: outlook.body-content-type="text"` aby dostac plaintext od razu z Graph API (eliminuje koniecznosc konwersji HTML)
2. Jako fallback: `html-to-text` poprawnie dekoduje HTML entities
3. Zapisuj w bazie zarowno `body_html` jak i `body_text`
4. Testuj z prawdziwymi emailami od samego poczatku

**Warning signs:** Znaki `?`, `&#...;`, `\ufffd` w zapisanym tekscie

### Pitfall 5: Vercel timeout przy duzych batchach

**What goes wrong:** Pojedynczy batch (100 maili) moze przekroczyc 60s jesli Graph API jest wolne lub Supabase insert trwa dlugo.

**Why it happens:** Graph API latency jest zmienna (100ms-2s per request). Supabase upsert 100 rekordow to 200-500ms. W sumie moze byc blisko limitu.

**How to avoid:**
1. Ustaw `export const maxDuration = 60` w API route (Vercel Pro)
2. Zmniejsz batch size do 50 jesli timeouty wystepuja
3. Dodaj timeout safety: mierz czas od startu, przerwij przetwarzanie jesli zostalo < 10s do limitu
4. Zapisz cursor (page_token) po kazdym udanym batch, nie na koncu

**Warning signs:** `FUNCTION_INVOCATION_TIMEOUT` w logach Vercel

## Code Examples

### Microsoft Graph API - List Messages with Pagination

```typescript
// Source: Microsoft Learn — List messages API
// https://learn.microsoft.com/en-us/graph/api/user-list-messages

import { Client } from '@microsoft/microsoft-graph-client';

// Initialize client with access token
const graphClient = Client.init({
  authProvider: (done) => {
    done(null, accessToken);
  },
});

// Fetch first page of messages
const response = await graphClient
  .api(`/users/${userEmail}/mailFolders/inbox/messages`)
  .top(100)
  .select('id,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,body,bodyPreview,internetMessageId,conversationId,hasAttachments,internetMessageHeaders')
  .header('Prefer', 'outlook.body-content-type="text"')
  .orderby('receivedDateTime DESC')
  .get();

// response.value = Message[]
// response['@odata.nextLink'] = URL for next page (or undefined)

// Process messages
for (const msg of response.value) {
  const email = {
    internet_message_id: msg.internetMessageId,
    graph_id: msg.id,
    subject: msg.subject,
    from_address: msg.from?.emailAddress?.address,
    from_name: msg.from?.emailAddress?.name,
    to_addresses: msg.toRecipients?.map((r: any) => ({
      address: r.emailAddress.address,
      name: r.emailAddress.name,
    })),
    cc_addresses: msg.ccRecipients?.map((r: any) => ({
      address: r.emailAddress.address,
      name: r.emailAddress.name,
    })),
    sent_at: msg.sentDateTime,
    received_at: msg.receivedDateTime,
    body_text: msg.body?.content, // plaintext thanks to Prefer header
    body_html: null, // fetch separately if needed
    conversation_id: msg.conversationId,
    has_attachments: msg.hasAttachments,
  };
}

// Follow pagination
if (response['@odata.nextLink']) {
  // Save nextLink as page_token in sync_jobs
  // Frontend will call process endpoint again
}
```

### Delta Query for Incremental Sync

```typescript
// Source: Microsoft Learn — message: delta
// https://learn.microsoft.com/en-us/graph/api/message-delta

// Initial delta sync (first time)
const initialUrl = `/users/${userEmail}/mailFolders/inbox/messages/delta`;

// Subsequent delta sync (using saved deltaLink)
const deltaUrl = savedDeltaLink; // from mailboxes.delta_link column

const response = await graphClient
  .api(deltaUrl || initialUrl)
  .top(100)
  .select('id,subject,from,toRecipients,sentDateTime,receivedDateTime,body,internetMessageId,conversationId,hasAttachments')
  .header('Prefer', 'outlook.body-content-type="text"')
  .get();

// Process messages
for (const msg of response.value) {
  if (msg['@removed']) {
    // Email was deleted - mark as deleted in DB
    await markEmailDeleted(msg.id);
  } else {
    // New or updated email - upsert
    await upsertEmail(msg);
  }
}

// Check for more pages vs completion
if (response['@odata.nextLink']) {
  // More pages - save nextLink, continue
  await savePageToken(jobId, response['@odata.nextLink']);
} else if (response['@odata.deltaLink']) {
  // Sync complete - save deltaLink for next sync cycle
  await saveDeltaLink(mailboxId, response['@odata.deltaLink']);
}
```

### MSAL ROPC Authentication

```typescript
// Source: @azure/msal-node documentation
// https://github.com/AzureAD/microsoft-authentication-library-for-js

import { PublicClientApplication } from '@azure/msal-node';

const GRAPH_SCOPES_ROPC = ['https://graph.microsoft.com/Mail.Read'];

async function authenticateROPC(
  tenantId: string,
  clientId: string,
  username: string,
  password: string
): Promise<string> {
  const pca = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });

  const result = await pca.acquireTokenByUsernamePassword({
    scopes: GRAPH_SCOPES_ROPC,
    username,
    password,
  });

  if (!result) {
    throw new Error('Authentication failed - no token returned');
  }

  return result.accessToken;
}
```

### MSAL Client Credentials Authentication (Upgrade Path)

```typescript
// Source: Microsoft Learn — Get access without a user
// https://learn.microsoft.com/en-us/graph/auth-v2-service

import { ConfidentialClientApplication } from '@azure/msal-node';

const GRAPH_SCOPES_APP = ['https://graph.microsoft.com/.default'];

async function authenticateClientCredentials(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  });

  const result = await cca.acquireTokenByClientCredential({
    scopes: GRAPH_SCOPES_APP,
  });

  if (!result) {
    throw new Error('Client credentials authentication failed');
  }

  return result.accessToken;
}
```

### Test Connection Endpoint

```typescript
// POST /api/mailboxes/[id]/test-connection/route.ts
export async function POST(request: Request) {
  // 1. Verify admin
  // 2. Get mailbox from DB
  // 3. Decrypt credentials
  // 4. Try to get access token
  try {
    const token = await getAccessToken(credentials);

    // 5. Try a simple Graph API call (list 1 message)
    const graphClient = Client.init({
      authProvider: (done) => done(null, token),
    });

    const test = await graphClient
      .api(`/users/${mailbox.email_address}/mailFolders/inbox/messages`)
      .top(1)
      .select('id,subject')
      .get();

    return Response.json({
      success: true,
      message: `Polaczenie udane. Znaleziono wiadomosci w skrzynce.`,
      messageCount: test['@odata.count'] || 'nieznana',
    });
  } catch (error: any) {
    // Parse specific error codes
    const errorMessage = parseGraphError(error);
    return Response.json({
      success: false,
      message: errorMessage,
    }, { status: 400 });
  }
}

function parseGraphError(error: any): string {
  const code = error?.statusCode || error?.code;

  if (code === 'AADSTS50076' || code === 'AADSTS50079') {
    return 'Konto wymaga uwierzytelniania wieloskladnikowego (MFA). Uzyj metody OAuth2 (App Registration) zamiast loginu i hasla.';
  }
  if (code === 'AADSTS50126') {
    return 'Nieprawidlowy login lub haslo.';
  }
  if (code === 'AADSTS50034') {
    return 'Konto nie istnieje w tym tenancie Microsoft 365.';
  }
  if (code === 'AADSTS700016') {
    return 'Nieprawidlowy Client ID aplikacji Azure.';
  }
  if (code === 401) {
    return 'Brak uprawnien do odczytu skrzynki. Sprawdz uprawnienia aplikacji w Azure AD.';
  }
  if (code === 403) {
    return 'Dostep zabroniony. Aplikacja nie ma uprawnien Mail.Read.';
  }

  return `Blad polaczenia: ${error?.message || 'Nieznany blad'}`;
}
```

### HTML to Plaintext Conversion

```typescript
// Source: html-to-text npm
// https://github.com/html-to-text/node-html-to-text

import { convert } from 'html-to-text';

function emailHtmlToPlaintext(html: string): string {
  return convert(html, {
    wordwrap: false, // Don't wrap lines - let the UI handle it
    selectors: [
      // Remove images (inline attachments)
      { selector: 'img', format: 'skip' },
      // Skip style/script tags
      { selector: 'style', format: 'skip' },
      { selector: 'script', format: 'skip' },
      // Format links: show URL in parentheses
      { selector: 'a', options: { linkBrackets: ['(', ')'] } },
    ],
    // Preserve table structure
    preserveNewlines: true,
  });
}
```

## Supabase Schema for Phase 2

### Tables to Create/Modify

```sql
-- Modify existing mailboxes table (add new columns)
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'ropc';
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS credentials_encrypted TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS total_emails INTEGER DEFAULT 0;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS delta_link TEXT;
ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'never_synced';
-- sync_status: 'never_synced' | 'syncing' | 'synced' | 'error'

-- Sync jobs table (new)
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'processing' | 'has_more' | 'completed' | 'failed'
  job_type TEXT NOT NULL DEFAULT 'full',
  -- job_type: 'full' | 'delta'
  page_token TEXT,
  emails_fetched INTEGER DEFAULT 0,
  emails_total_estimate INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails table (modify existing or create new)
-- NOTE: Check existing emails table structure first and adapt
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  internet_message_id TEXT NOT NULL,
  graph_id TEXT,
  conversation_id TEXT,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses JSONB DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  -- Threading headers (for Phase 3)
  header_message_id TEXT,
  header_in_reply_to TEXT,
  header_references TEXT[],
  -- Metadata
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mailbox_id, internet_message_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_mailbox_id ON sync_jobs(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

-- RLS policies
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (API routes use service role key)
-- No public access to these tables
CREATE POLICY "Service role full access sync_jobs"
  ON sync_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access emails"
  ON emails FOR ALL
  USING (true)
  WITH CHECK (true);
```

### ROPC Auth Requirements - Azure App Registration

Dla ROPC flow potrzebna jest Azure App Registration z nastepujacymi ustawieniami:

| Setting | Value | Notes |
|---------|-------|-------|
| App type | Public client (allow public client flows = YES) | ROPC wymaga public client |
| API permissions | `Mail.Read` (delegated) | Delegated, nie Application - ROPC uzywa delegated permissions |
| Supported account types | Accounts in this organizational directory only (single tenant) | Tenant-specific |
| Platform | Mobile and desktop applications | Redirect URI: `https://login.microsoftonline.com/common/oauth2/nativeclient` |

Dla client_credentials flow (upgrade path):

| Setting | Value | Notes |
|---------|-------|-------|
| App type | Confidential client (web app) | Client secret wymagany |
| API permissions | `Mail.Read` (application) | Application permission + admin consent |
| Client secret | Generated in Certificates & secrets | Wygasa po 6/12/24 miesiace |
| Application Access Policy | Ograniczony do konkretnych skrzynek | Security best practice |

### Environment Variables (new for Phase 2)

```env
# Existing
ENCRYPTION_KEY=           # 64 hex chars (32 bytes) for AES-256-GCM

# New for Phase 2 - Default Azure App Registration for ROPC
# (Can be overridden per mailbox if needed)
AZURE_TENANT_ID=          # Microsoft 365 tenant ID
AZURE_CLIENT_ID=          # Azure App Registration client ID
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IMAP + Basic Auth | Microsoft Graph API + OAuth2 | 2023 (Basic Auth deprecated for Exchange Online) | Nie mozna uzyc IMAP z plain password na Exchange Online |
| EWS (Exchange Web Services) | Microsoft Graph API | 2022 (EWS deprecated) | Graph jest jedynym wspieranym API |
| `node-imap` | `imapflow` | ~2022 | `node-imap` unmaintained, callback-based |
| `@microsoft/msgraph-sdk` 1.x (preview) | `@microsoft/microsoft-graph-client` 3.x | ongoing | Nowy SDK nadal w preview, stary jest stabilny |
| ROPC freely available | ROPC restricted by MFA enforcement | 2025 (July) | ROPC moze byc zablokowane na kontach z MFA |
| Vercel 10s timeout | Vercel Fluid Compute (300s default) | 2024 | Chunked sync dalej potrzebny ale z wieksym buforem |

**Deprecated/outdated:**
- **Basic Auth for Exchange Online:** Calkowicie wylaczone. Nie proponuj IMAP z login+password dla M365.
- **EWS (Exchange Web Services):** Deprecated, replaced by Graph API.
- **Outlook REST API:** Decommissioned since March 2024.
- **`node-imap`:** Unmaintained, callback-based, no TypeScript.

## Open Questions

1. **Azure App Registration access**
   - What we know: ROPC wymaga App Registration w Azure AD klienta (lub wspoldzielonej).
   - What's unclear: Czy klient (Lulkiewicz PR) ma dostep do Azure Portal swojego tenanta lub tenanta skrzynek?
   - Recommendation: W formularzu konfiguracji daj mozliwosc podania tenant_id i client_id. Jesli klient nie ma wlasnej App Registration, nalezy ja zalozyc.

2. **MFA status na kontach skrzynek**
   - What we know: ROPC nie dziala z MFA. Microsoft wymusza MFA coraz szerzej.
   - What's unclear: Czy konta skrzynek (administracja osiedli) maja wlaczone MFA?
   - Recommendation: Test connection endpoint musi jasno komunikowac blad MFA i sugerowac upgrade do client_credentials.

3. **Istniejace tabele Supabase**
   - What we know: Istnieja tabele `mailboxes`, `mailbox_credentials`, `emails` z poprzedniej wersji.
   - What's unclear: Dokladna struktura tych tabel, czy zawieraja dane.
   - Recommendation: Plan 02-01 powinien zaczac od zbadania istniejacych tabel i zdecydowania: ALTER vs DROP+CREATE.

4. **Graph API body content - text vs HTML**
   - What we know: Header `Prefer: outlook.body-content-type="text"` zwraca plaintext zamiast HTML.
   - What's unclear: Czy plaintext z Graph API jest wystarczajacej jakosci (czy zachowuje strukture paragraflow)?
   - Recommendation: Pobieraj plaintext jako primary, HTML jako backup. Testuj z prawdziwymi mailami.

5. **Estimated total emails count**
   - What we know: Graph API nie zwraca calkowitej liczby maili w standardowym response.
   - What's unclear: Jak uzyskac estimated total dla progress baru.
   - Recommendation: Uzyj `$count=true` query param lub osobnego zapytania `GET /users/{id}/mailFolders/inbox` ktory zwraca `totalItemCount`.

## Sources

### Primary (HIGH confidence)
- [Microsoft Graph List Messages API](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0) - pagination, $select, $top
- [Microsoft Graph Message Resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0) - all fields, internetMessageHeaders
- [Microsoft Graph Delta Query](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0) - incremental sync, deltaLink, skipToken
- [Microsoft ROPC Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth-ropc) - parameters, limitations, tenant requirements
- [Microsoft Client Credentials Flow](https://learn.microsoft.com/en-us/graph/auth-v2-service) - app-only access, admin consent
- [Microsoft Application RBAC for Exchange](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access) - limiting app permissions to specific mailboxes
- [MSAL Node.js GitHub](https://github.com/AzureAD/microsoft-authentication-library-for-js) - username-password samples, ConfidentialClientApplication
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) - maxDuration, Fluid Compute
- Marketing Hub `src/lib/crypto/encrypt.ts` - AES-256-GCM proven pattern

### Secondary (MEDIUM confidence)
- [Microsoft MFA Enforcement Plan](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mandatory-multifactor-authentication) - Phase 1/2 enforcement scope
- [ROPC after July 2025 discussion](https://learn.microsoft.com/en-us/answers/questions/2285608/do-ropc-works-flow-after-july-4-2025-if-i-disable) - still works with MFA disabled
- [html-to-text npm](https://www.npmjs.com/package/html-to-text) - 1367 dependents, active development
- [Inngest - Solving Next.js Timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts) - patterns for long-running tasks

### Tertiary (LOW confidence)
- Graph API exact throttling limits per mailbox - Microsoft does not publish specific per-mailbox limits
- Delta token expiration time - not officially documented
- Vercel Fluid Compute exact behavior with network-bound operations - needs empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - official Microsoft libraries, verified docs
- Architecture (chunked sync + polling): HIGH - established pattern, Vercel-recommended
- Auth (ROPC): MEDIUM - works but fragile (MFA dependency), upgrade path needed
- Auth (client_credentials): HIGH - recommended by Microsoft for server-to-server
- Email parsing: HIGH - `html-to-text` well-established, Graph API text body available
- Pitfalls: HIGH - documented by Microsoft + confirmed in prior research

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - Microsoft Graph API is stable, auth landscape evolving)
