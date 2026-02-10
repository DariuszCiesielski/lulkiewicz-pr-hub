# Technology Stack

**Project:** Lulkiewicz PR Hub -- Email Communication Analyzer
**Researched:** 2026-02-10
**Overall confidence:** MEDIUM-HIGH

---

## 1. Email Access: Microsoft Graph API + IMAP Dual Strategy

### Recommendation: Implement BOTH protocols behind a unified adapter

The mailbox type (O365 vs on-premise Exchange) is currently unknown. This is the single biggest architectural risk. The strategy must support both scenarios.

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| `@microsoft/microsoft-graph-client` | 3.0.7 | O365 mailbox access via Graph API | HIGH |
| `@azure/identity` | latest (4.x) | OAuth2 ClientSecretCredential for daemon auth | HIGH |
| `@microsoft/microsoft-graph-types` | latest | TypeScript types for Graph entities | HIGH |
| `imapflow` | 1.2.x | IMAP fallback for on-premise Exchange | HIGH |

### Microsoft Graph API (for O365 / Exchange Online)

**Why Graph API over IMAP for O365:**
- Microsoft deprecated Basic Auth for IMAP/POP on Exchange Online -- OAuth2 is required regardless
- Graph API provides richer message metadata (conversationId, conversationIndex, internetMessageHeaders)
- Graph API has built-in pagination via `@odata.nextLink`
- Graph API provides `conversationId` field natively -- simplifies threading
- Microsoft actively deprecating Outlook REST APIs; Graph is the only supported path forward

**Authentication pattern (daemon / server-side):**
```typescript
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from
  "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { Client } from "@microsoft/microsoft-graph-client";

const credential = new ClientSecretCredential(
  TENANT_ID, CLIENT_ID, CLIENT_SECRET
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});

const graphClient = Client.initWithMiddleware({ authProvider });
```

**Required Azure AD setup:**
- App Registration in Entra ID (Azure AD)
- Application permissions: `Mail.Read` (not delegated -- daemon app)
- Admin consent required
- Application Access Policy to restrict to specific 3 mailboxes (security best practice)

**Key API endpoint:**
```
GET /users/{user-id}/messages
  ?$select=id,subject,from,toRecipients,receivedDateTime,body,
           conversationId,internetMessageHeaders
  &$top=100
  &$orderby=receivedDateTime DESC
```

Pagination: follow `@odata.nextLink` URL in response. Default page: 10, max `$top`: 1000.

**Confidence:** HIGH -- verified with Microsoft Learn official documentation.

### IMAP via ImapFlow (for on-premise Exchange)

**When to use:** If mailboxes are on-premise Exchange Server (not O365). On-premise Exchange does NOT support Microsoft Graph API for mail access (this was deprecated in July 2023 and hybrid REST support was removed).

**Why ImapFlow:**
- Modern, promise-based API (vs legacy `node-imap` which is callback-based and unmaintained)
- Actively maintained (v1.2.x, published days ago)
- Supports OAuth2, PLAIN, LOGIN, NTLM, CRAM-MD5 authentication
- Streaming support for large mailboxes
- ~130K-240K weekly downloads

```typescript
import { ImapFlow } from "imapflow";

const client = new ImapFlow({
  host: "mail.example.com",
  port: 993,
  secure: true,
  auth: { user: "user@example.com", pass: "password" },
});

await client.connect();
const lock = await client.getMailboxLock("INBOX");
try {
  for await (const message of client.fetch("1:*", {
    envelope: true,
    headers: ["message-id", "in-reply-to", "references"],
    source: true,
  })) {
    // Process message
  }
} finally {
  lock.release();
}
```

**On-premise Exchange auth considerations:**
- On-premise MAY still support Basic Auth (username/password) -- unlike O365
- If Exchange 2016/2019 with updates, NTLM auth might be needed
- Must confirm with client which auth method their server supports

**Confidence:** HIGH for ImapFlow library choice. LOW for actual on-premise server auth -- requires discovery with client.

### Unified Adapter Pattern

```typescript
interface EmailProvider {
  connect(): Promise<void>;
  fetchMessages(options: FetchOptions): AsyncGenerator<RawEmail>;
  fetchMessagesSince(date: Date): AsyncGenerator<RawEmail>;
  disconnect(): Promise<void>;
}

class GraphEmailProvider implements EmailProvider { /* ... */ }
class ImapEmailProvider implements EmailProvider { /* ... */ }
```

**Phase 1 recommendation:** Start with Graph API (more likely scenario for business mailboxes). Add IMAP adapter in Phase 2 if needed.

### What NOT to use

| Library | Why Not |
|---|---|
| `node-imap` (mscdex) | Unmaintained, callback-based, no TypeScript, last commit years ago |
| `@microsoft/msgraph-sdk` (new SDK) | Still in preview (v1.0.0-preview.77), not production-ready. Use stable `@microsoft/microsoft-graph-client` 3.0.7 instead |
| Outlook REST API | Fully deprecated and decommissioned since March 2024 |
| EWS (Exchange Web Services) | Being deprecated by Microsoft, replaced by Graph API |
| EmailEngine | Self-hosted email API gateway -- overkill for 3 mailboxes, adds infrastructure complexity |

---

## 2. Email Parsing & Threading

### Recommendation: Custom threading using Graph `conversationId` + JWZ fallback

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| `mailparser` | latest (3.x) | Parse raw MIME emails from IMAP | HIGH |
| Custom threading logic | - | Group emails by conversationId / References headers | HIGH |

### Threading Strategy

**For Graph API emails:** Use the `conversationId` field that Microsoft Graph provides natively. This groups all replies in a conversation automatically -- no need for manual header parsing.

```typescript
// Graph API returns conversationId natively
interface GraphMessage {
  id: string;
  conversationId: string;  // Thread grouping key
  subject: string;
  internetMessageHeaders: Array<{ name: string; value: string }>;
  // ...
}
```

**For IMAP emails:** Parse headers manually and implement simplified JWZ threading:

```typescript
// Extract threading headers from parsed email
const messageId = headers["message-id"];
const inReplyTo = headers["in-reply-to"];
const references = headers["references"]?.split(/\s+/);

// Threading algorithm:
// 1. Group by References chain (most reliable)
// 2. Fallback to In-Reply-To
// 3. Last resort: subject-based matching (strip Re:/Fwd:)
```

### mailparser (for IMAP path)

**Why:** Streaming email parser for Node.js, handles 100MB+ messages, extracts headers including Message-ID, In-Reply-To, References. Part of the Nodemailer ecosystem -- battle-tested.

**Usage modes:**
- `simpleParser(source)` -- buffers entire message, returns single object (fine for typical emails)
- `MailParser` class -- Transform stream for very large messages

### What NOT to use for threading

| Library | Why Not |
|---|---|
| `conversationThreading-js` | Last meaningful update ~2011, 88 stars, dormant project, no npm releases |
| Full JWZ algorithm implementation | Over-engineered for this use case. Graph API already provides conversationId. For IMAP, simplified References-based grouping is sufficient |
| `postal-mime` | Browser-focused, less suited for Node.js server-side bulk processing |

**Confidence:** HIGH for Graph threading (documented API). MEDIUM for IMAP threading (standard approach, but requires custom code).

---

## 3. AI Analysis: OpenAI GPT-4o with Structured Outputs

### Recommendation: OpenAI GPT-4o with Structured Outputs (response_format: json_schema)

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| `openai` (npm) | latest (5.x) | OpenAI API client | HIGH |
| GPT-4o | latest | Polish text analysis, tone classification, GDPR detection | MEDIUM |
| Structured Outputs | - | Guaranteed JSON schema adherence for classification | HIGH |

### Why GPT-4o for Polish text analysis

- GPT-4o is multilingual with strong Polish language support (trained on substantial Polish corpus)
- Structured Outputs guarantee 100% schema adherence (not just valid JSON, but exact schema match)
- For classification tasks (tone: professional/neutral/aggressive/passive-aggressive), structured outputs eliminate parsing errors
- Cost-effective for batch processing vs GPT-4 Turbo
- Supports `response_format: { type: "json_schema", json_schema: { ... } }`

### Analysis architecture (per-section prompts)

```typescript
// Each report section has its own prompt template
interface AnalysisSection {
  id: string;
  name: string;
  prompt: string;  // Editable by user
  outputSchema: z.ZodSchema;  // Zod schema for structured output
}

// Example: Communication tone analysis
const toneAnalysis: AnalysisSection = {
  id: "tone",
  name: "Analiza tonu komunikacji",
  prompt: `Przeanalizuj ponizszy watek emailowy...
    Ocen ton komunikacji na skali: profesjonalny, neutralny,
    nieformalny, agresywny, pasywno-agresywny.
    Podaj przyklady z cytatami.`,
  outputSchema: z.object({
    overallTone: z.enum(["profesjonalny", "neutralny", ...]),
    examples: z.array(z.object({
      quote: z.string(),
      tone: z.string(),
      explanation: z.string(),
    })),
    summary: z.string(),
  }),
};
```

### GDPR compliance analysis

GPT-4o can identify potential GDPR issues in communication:
- Personal data exposure in email chains
- Consent language analysis
- Data retention concerns

**IMPORTANT:** Email content sent to OpenAI API is processed by OpenAI. For GDPR compliance:
- Use API (not ChatGPT) -- API data is NOT used for training by default
- Consider OpenAI's Data Processing Agreement
- Document in privacy policy that AI analysis is performed
- Consider data minimization -- send only relevant email excerpts, not full chains

### Multi-model option

The architecture should support multiple AI providers (already established in Marketing Hub pattern):

| Model | Use Case | Why |
|---|---|---|
| GPT-4o (default) | Main analysis, Polish text | Best balance of quality/cost/speed for Polish |
| GPT-4o-mini | Simpler classifications, pre-filtering | 10x cheaper for routine tasks |
| Claude 3.5 Sonnet | Alternative for nuanced analysis | Strong multilingual, good at tone detection |

### Token cost estimation

For ~1000 email threads, average 5 emails per thread, ~500 tokens per email:
- Input: ~2.5M tokens total
- With GPT-4o at ~$2.50/1M input tokens: ~$6.25 per full analysis run
- Output (structured): ~500K tokens at ~$10/1M: ~$5.00
- **Total estimate per full run: ~$11** -- very manageable

### What NOT to use

| Option | Why Not |
|---|---|
| Local LLM (Ollama, llama.cpp) | Polish language quality significantly worse than GPT-4o. Not worth the infrastructure complexity for an internal tool |
| Fine-tuned model | Insufficient training data initially. Start with prompt engineering, fine-tune later if needed |
| Traditional NLP (spaCy, NLTK) | Polish language support is limited. LLM approach is simpler and more flexible for this use case |
| Azure OpenAI Service | Adds Azure dependency. Direct OpenAI API is simpler. Consider Azure only if data residency in EU is a hard requirement |

**Confidence:** MEDIUM -- GPT-4o's Polish quality is strong based on general knowledge, but specific tone analysis accuracy in Polish PR/real-estate domain needs empirical testing. Recommend building evaluation dataset early.

---

## 4. Document Export: .docx and .pdf

### Recommendation: `docx` (programmatic) + `@react-pdf/renderer` (server-side)

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| `docx` | 9.5.x | Programmatic .docx generation | HIGH |
| `@react-pdf/renderer` | 4.3.x | PDF generation from React components | MEDIUM |

### .docx Generation with `docx`

**Why `docx`:**
- Declarative TypeScript API -- build documents programmatically
- Works in Node.js (server-side, no browser needed)
- 379 dependents, actively maintained
- No template files needed -- pure code
- Supports tables, images, headers, footers, styles, page breaks

```typescript
import { Document, Packer, Paragraph, Table, TextRun, HeadingLevel } from "docx";

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        text: "Raport analizy komunikacji",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Wygenerowano: ", bold: true }),
          new TextRun(new Date().toLocaleDateString("pl-PL")),
        ],
      }),
      // Tables, charts, sections from AI analysis...
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
// Return as download or save to storage
```

**Why NOT `docxtemplater`:**
- Requires pre-made .docx template files -- adds template management complexity
- Core is open-source but many needed features (tables, images, charts) require paid modules
- For a report that's 100% generated from data, programmatic approach (`docx`) is cleaner

### .pdf Generation with @react-pdf/renderer

**Why `@react-pdf/renderer`:**
- Build PDFs using React components (JSX syntax -- familiar DX for the team)
- Server-side rendering via `renderToStream()` or `renderToBuffer()`
- No Chromium/Puppeteer dependency (pure JS PDF generation)
- No external browser process to manage
- Works within Vercel serverless function size limits
- Actively maintained (v4.3.2, published recently)

```typescript
import { Document, Page, Text, View, StyleSheet, renderToBuffer }
  from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica" },
  title: { fontSize: 24, marginBottom: 20 },
  section: { marginBottom: 15 },
});

const ReportPDF = ({ data }: { data: ReportData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Raport analizy komunikacji</Text>
      {data.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={{ fontSize: 16, fontWeight: "bold" }}>
            {section.title}
          </Text>
          <Text>{section.content}</Text>
        </View>
      ))}
    </Page>
  </Document>
);

// Server-side in API route:
const buffer = await renderToBuffer(<ReportPDF data={reportData} />);
```

**Polish font support:** `@react-pdf/renderer` supports custom fonts via `Font.register()`. Use a font that supports Polish diacritics (Roboto, Open Sans, Noto Sans -- all free via Google Fonts).

```typescript
import { Font } from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2",
});
```

### What NOT to use for PDF

| Option | Why Not |
|---|---|
| Puppeteer + @sparticuz/chromium | Heavy dependency (~50MB Chromium binary), slow on serverless (4-8x slower than local), Vercel 250MB bundle limit risk, complex setup |
| jsPDF | Client-side focused, manual coordinate-based layout, poor DX for complex reports |
| PDFKit | Lower-level API, no JSX/React components, more code for the same result |
| wkhtmltopdf | Legacy C binary, deployment complexity on serverless |
| html-pdf | Depends on PhantomJS (deprecated) |

**Confidence:** HIGH for `docx`. MEDIUM for `@react-pdf/renderer` -- works well but needs testing with complex Polish-language reports and custom fonts.

---

## 5. Long-Running Email Sync on Vercel

### Recommendation: Vercel Cron Jobs + chunked sync + Supabase pg_cron backup

| Technology | Purpose | Confidence |
|---|---|---|
| Vercel Cron Jobs | Trigger periodic email sync | HIGH |
| `maxDuration` export | Extend function timeout to 300-800s | HIGH |
| Supabase pg_cron | Database-level scheduled jobs (backup trigger) | MEDIUM |

### Vercel Function Duration Limits (with Fluid Compute -- default)

| Plan | Default | Maximum |
|---|---|---|
| Hobby | 300s (5 min) | 300s (5 min) |
| Pro | 300s (5 min) | 800s (13 min) |
| Enterprise | 300s (5 min) | 800s (13 min) |

**Without Fluid Compute (legacy):** Hobby 10s/60s, Pro 15s/300s.

### Sync Architecture

**Problem:** 3 mailboxes with thousands of emails each. Initial sync could take 30+ minutes. Subsequent delta syncs should be fast.

**Solution: Chunked sync with progress tracking**

```typescript
// app/api/sync/route.ts
export const maxDuration = 300; // 5 minutes per invocation

export async function POST(request: Request) {
  const { mailboxId } = await request.json();

  // Get sync cursor from DB (last synced message date/id)
  const cursor = await getSyncCursor(mailboxId);

  // Fetch next batch of messages (e.g., 100 at a time)
  const messages = await emailProvider.fetchMessagesSince(cursor);

  let processed = 0;
  for await (const message of messages) {
    await storeMessage(message);
    processed++;

    // Safety: stop before timeout, save cursor
    if (processed >= 500 || isApproachingTimeout()) {
      await saveSyncCursor(mailboxId, message.receivedDateTime);
      return Response.json({
        status: "partial",
        processed,
        hasMore: true,
      });
    }
  }

  return Response.json({ status: "complete", processed });
}
```

### Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/sync/cron",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

The cron endpoint triggers sync for all 3 mailboxes. Each sync call processes up to 500 messages or runs for up to ~4.5 minutes (leaving buffer before 5-min timeout). If more messages remain, the next cron invocation continues.

### Initial bulk import strategy

For the first-time import of thousands of emails:

1. **Manual trigger from UI** -- "Start import" button
2. **Chain of API calls** -- each processes a batch, returns `hasMore: true`
3. **Frontend polls** status endpoint, shows progress bar
4. **Estimated time:** 3000 emails / 500 per batch / 5 min each = ~30 min for initial import

### Supabase pg_cron as backup

If Vercel cron reliability is a concern, Supabase pg_cron can call the sync endpoint via pg_net:

```sql
SELECT cron.schedule(
  'email-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/sync/cron',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);
```

### What NOT to use

| Option | Why Not |
|---|---|
| Trigger.dev | Excellent tool but adds external service dependency and cost. Overkill for 3 mailboxes with periodic sync. Consider only if sync requirements grow significantly |
| Inngest | Same reasoning -- great for complex event-driven workflows, but unnecessary for simple periodic sync |
| BullMQ + Redis | Requires self-hosted Redis. Not compatible with Vercel serverless. Would need separate infrastructure |
| Supabase Edge Functions | 60-second timeout, DENO runtime (not Node.js), would require rewriting email logic |
| Self-hosted server | Defeats the purpose of Vercel/serverless deployment. Reserve as last resort |

**Confidence:** HIGH for Vercel Cron + chunked sync pattern. This is well-documented and widely used.

---

## 6. Core Framework (pre-decided, confirmed)

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.x (App Router) | Full-stack framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | latest | UI components |
| Supabase | - | Database (Postgres), Auth, Storage |

These are pre-decided based on Marketing Hub stack alignment. No changes recommended.

---

## 7. Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `zod` | 3.x | Schema validation for AI outputs, API inputs | Always -- validates structured outputs |
| `date-fns` | 3.x | Date formatting/manipulation (Polish locale) | Email date handling, report generation |
| `zustand` | 5.x | Client-side state management | Sync progress, UI state |
| `swr` or `@tanstack/react-query` | latest | Server state / data fetching with caching | Email list, thread views, report data |
| `@supabase/supabase-js` | 2.x | Supabase client | Database operations |
| `crypto` (built-in) | - | AES-256 encryption for API keys | Storing Graph API credentials |

---

## 8. Full Installation Commands

```bash
# Core framework (pre-existing from Next.js setup)
# npx create-next-app@latest --typescript --tailwind --app

# Email access -- Graph API
npm install @microsoft/microsoft-graph-client @azure/identity @microsoft/microsoft-graph-types

# Email access -- IMAP fallback
npm install imapflow

# Email parsing (for IMAP path)
npm install mailparser
npm install -D @types/mailparser

# AI
npm install openai zod

# Document export
npm install docx @react-pdf/renderer

# State & data fetching
npm install zustand @tanstack/react-query

# Utilities
npm install date-fns
```

---

## 9. Alternatives Considered (Full Matrix)

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Email API (O365) | Microsoft Graph API | IMAP + OAuth2 | Graph provides richer metadata, conversationId, Microsoft-recommended path |
| Email API (on-prem) | ImapFlow | node-imap | node-imap is unmaintained, callback-based |
| Graph SDK | @microsoft/microsoft-graph-client 3.0.7 | @microsoft/msgraph-sdk 1.0.0-preview | Preview SDK not production-ready |
| Email parsing | mailparser | postal-mime | mailparser is Node.js native, streaming, battle-tested |
| Threading | Graph conversationId + custom References parser | JWZ library (conversationThreading-js) | JWZ lib is dormant since 2011; Graph gives threading for free |
| AI model | GPT-4o | Claude 3.5 Sonnet, Gemini | GPT-4o has structured outputs guarantee, good Polish support, best cost/quality |
| .docx generation | docx (programmatic) | docxtemplater | No template management, all features in core (free) |
| .pdf generation | @react-pdf/renderer | Puppeteer + @sparticuz/chromium | No Chromium binary, works in serverless, JSX DX |
| Background jobs | Vercel Cron + chunked sync | Trigger.dev, Inngest | External service unnecessary for 3 mailboxes |
| Job scheduling | Vercel Cron + pg_cron backup | BullMQ + Redis | No self-hosted Redis needed |

---

## 10. Key Technical Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Email protocol priority | Graph API first, IMAP fallback | O365 is most likely; Graph provides superior metadata |
| Threading approach | Use Graph conversationId when available | Zero custom code for the common path |
| AI provider | OpenAI GPT-4o with Structured Outputs | Schema-guaranteed JSON, good Polish, cost-effective |
| PDF approach | React-based (no Chromium) | Serverless-compatible, familiar DX |
| Sync pattern | Chunked batches via Vercel Cron | Works within 5-min timeout, resumable |
| Auth for Graph | ClientSecretCredential (daemon app) | No user interaction needed, server-to-server |

---

## Sources

### Official Documentation (HIGH confidence)
- [Microsoft Graph Mail API Overview](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview?view=graph-rest-1.0)
- [Microsoft Graph List Messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0)
- [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Microsoft Graph Authentication Providers](https://learn.microsoft.com/en-us/graph/sdks/choose-authentication-providers)
- [Graph API Hybrid REST Support (deprecated)](https://learn.microsoft.com/en-us/graph/hybrid-rest-support)
- [Vercel Functions Duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)

### npm Packages (HIGH confidence)
- [@microsoft/microsoft-graph-client 3.0.7](https://www.npmjs.com/package/@microsoft/microsoft-graph-client)
- [@microsoft/msgraph-sdk preview](https://www.npmjs.com/package/@microsoft/msgraph-sdk)
- [imapflow](https://www.npmjs.com/package/imapflow) -- v1.2.x, actively maintained
- [mailparser](https://www.npmjs.com/package/mailparser) -- part of Nodemailer ecosystem
- [docx 9.5.x](https://www.npmjs.com/package/docx)
- [@react-pdf/renderer 4.3.x](https://www.npmjs.com/package/@react-pdf/renderer)

### Community Sources (MEDIUM confidence)
- [JWZ Threading Algorithm](https://www.jwz.org/doc/threading.html)
- [ImapFlow Documentation](https://imapflow.com/)
- [docx.js.org](https://docx.js.org/)
- [React-pdf.org](https://react-pdf.org/)

### Background Jobs Research (MEDIUM confidence)
- [Next.js Background Jobs Discussion #33989](https://github.com/vercel/next.js/discussions/33989)
- [Inngest + Vercel Integration](https://www.inngest.com/blog/vercel-integration)
- [Trigger.dev Next.js Guide](https://trigger.dev/docs/guides/frameworks/nextjs)
- [Deploying Puppeteer on Vercel](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel)

---

## Open Questions (require client input)

1. **Mailbox type confirmation:** Are the 3 mailboxes on Office 365 or on-premise Exchange? This determines Graph API vs IMAP path.
2. **Azure AD access:** Does the client have admin access to Azure AD / Entra ID for app registration? (Required for Graph API daemon auth)
3. **Vercel plan:** Hobby (5 min max) or Pro (13 min max)? Pro recommended for email sync reliability.
4. **Data residency:** Any GDPR requirement that email content stays within EU? If so, consider Azure OpenAI with EU region instead of direct OpenAI API.
5. **Existing email credentials:** What format? Username/password, OAuth tokens, or app registration already exists?
