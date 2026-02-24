// Email domain types for Phase 2: Email Connection & Fetching

// --- Enums / Union Types ---

export type ConnectionType = 'ropc' | 'client_credentials';

export type SyncStatus = 'never_synced' | 'syncing' | 'synced' | 'error';

export type SyncJobStatus = 'pending' | 'processing' | 'has_more' | 'completed' | 'failed';

export type SyncJobType = 'full' | 'delta';

export type AnalysisProfileId = 'communication_audit' | 'case_analytics';

export type PromptTemplateTier = 'default' | 'global' | 'profile' | 'per_report';

// --- Analysis Profile DB row (analysis_profiles table) ---

export interface AnalysisProfileDb {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thread_section_key: string;
  thread_system_prompt: string;
  thread_user_prompt_template: string;
  synthetic_system_prompt: string | null;
  standard_system_prompt: string | null;
  uses_default_prompts: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// --- Prompt Template DB row (extended with profile columns) ---

export interface PromptTemplateDb {
  id: string;
  profile_id: string | null;
  section_key: string;
  tier: PromptTemplateTier;
  title: string;
  system_prompt: string;
  user_prompt_template: string;
  section_order: number;
  is_active: boolean;
  in_internal_report: boolean;
  in_client_report: boolean;
  synthetic_focus: string | null;
  standard_focus: string | null;
  model: string | null;
  temperature: number | null;
  max_tokens: number | null;
  created_at: string;
  updated_at: string;
}

export type CcFilterMode = 'off' | 'never_in_to' | 'first_email_cc';
export type CcFilterStatus = 'direct' | 'cc_first_only' | 'cc_always' | 'unknown';

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
  analysis_profile: AnalysisProfileId;
  default_profile_id: string | null;
  cc_filter_mode: CcFilterMode;
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
  folder_id: string | null;
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

// --- Thread types (Phase 3) ---

export type ThreadStatus = 'open' | 'closed' | 'closed_positive' | 'closed_negative' | 'pending';

export interface EmailThread {
  id: string;
  mailbox_id: string;
  subject_normalized: string;
  first_message_at: string;
  last_message_at: string;
  message_count: number;
  participant_addresses: string[];
  status: ThreadStatus;
  cc_filter_status: CcFilterStatus;
  summary: string | null;
  avg_response_time_minutes: number | null;
  created_at: string;
  updated_at: string;
  // Joined data (optional)
  mailbox?: Pick<Mailbox, 'display_name' | 'email_address'>;
}

export interface EmailWithThread extends Email {
  thread_id: string | null;
  subject_normalized: string | null;
  is_incoming: boolean;
  response_time_minutes: number | null;
}

// --- Form data (UI → API) ---

export interface MailboxFormData {
  email_address: string;
  display_name: string;
  connection_type: ConnectionType;
  tenant_id: string;
  client_id: string;
  analysis_profile: AnalysisProfileId;
  default_profile_id?: string;
  cc_filter_mode: CcFilterMode;
  // ROPC fields
  username: string;
  password: string;
  // Client credentials fields
  client_secret: string;
}
