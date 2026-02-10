// Email domain types for Phase 2: Email Connection & Fetching

// --- Enums / Union Types ---

export type ConnectionType = 'ropc' | 'client_credentials';

export type SyncStatus = 'never_synced' | 'syncing' | 'synced' | 'error';

export type SyncJobStatus = 'pending' | 'processing' | 'has_more' | 'completed' | 'failed';

export type SyncJobType = 'full' | 'delta';

// --- Database row interfaces ---

export interface Mailbox {
  id: string;
  email_address: string;
  display_name: string | null;
  connection_type: ConnectionType;
  credentials_encrypted: string | null;
  tenant_id: string;
  client_id: string;
  sync_status: SyncStatus;
  last_sync_at: string | null;
  total_emails: number;
  delta_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: string;
  mailbox_id: string;
  status: SyncJobStatus;
  job_type: SyncJobType;
  page_token: string | null;
  emails_fetched: number;
  emails_total_estimate: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EmailRecipient {
  address: string;
  name: string;
}

export interface Email {
  id: string;
  mailbox_id: string;
  internet_message_id: string | null;
  graph_id: string;
  conversation_id: string | null;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: EmailRecipient[];
  cc_addresses: EmailRecipient[];
  sent_at: string | null;
  received_at: string;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean;
  header_message_id: string | null;
  header_in_reply_to: string | null;
  header_references: string[];
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
}

// --- Credentials types (used in auth, never stored in plain text) ---

export interface ROPCCredentials {
  type: 'ropc';
  tenantId: string;
  clientId: string;
  username: string;
  password: string;
}

export interface ClientCredentialsConfig {
  type: 'client_credentials';
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export type MailboxCredentials = ROPCCredentials | ClientCredentialsConfig;

// --- Form data (UI → API) ---

export interface MailboxFormData {
  email_address: string;
  display_name: string;
  connection_type: ConnectionType;
  tenant_id: string;
  client_id: string;
  // ROPC fields
  username: string;
  password: string;
  // Client credentials fields
  client_secret: string;
}
