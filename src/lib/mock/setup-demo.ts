import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ToolId } from '@/types';
import { buildThreadsForMailbox } from '@/lib/threading/thread-builder';
import { clearMockData, seedMockData } from './seed-data';
import { MOCK_MAILBOXES } from './seed-mailboxes';

const DEFAULT_DEMO_EMAIL = 'demo@demo.pl';
const DEFAULT_DEMO_DISPLAY_NAME = 'Konto demo';
const DEFAULT_DEMO_TOOLS: ToolId[] = ['email-analyzer', 'fb-analyzer'];
const AUTH_USERS_PAGE_SIZE = 200;

export interface SetupDemoOptions {
  email?: string;
  password: string;
  displayName?: string;
  allowedTools?: ToolId[];
  resetMockData?: boolean;
}

export interface SetupDemoResult {
  demoEmail: string;
  userCreated: boolean;
  mailboxesSeeded: number;
  emailsSeeded: number;
  threadsBuilt: number;
  emailsThreaded: number;
  allowedTools: ToolId[];
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findAuthUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<User | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Nie udało się pobrać użytkowników auth: ${error.message}`);
    }

    const users = data?.users || [];
    const existing = users.find((user) => normalizeEmail(user.email || '') === email);
    if (existing) {
      return existing;
    }

    if (users.length < AUTH_USERS_PAGE_SIZE) {
      return null;
    }
  }
}

async function ensureDemoAuthUser(
  adminClient: SupabaseClient,
  email: string,
  password: string
): Promise<{ userId: string; userCreated: boolean }> {
  const existing = await findAuthUserByEmail(adminClient, email);

  if (existing) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      throw new Error(`Nie udało się zaktualizować hasła konta demo: ${updateError.message}`);
    }

    return { userId: existing.id, userCreated: false };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Nie udało się utworzyć konta demo: ${error?.message || 'brak user.id'}`);
  }

  return { userId: data.user.id, userCreated: true };
}

async function ensureAllowedUser(
  adminClient: SupabaseClient,
  params: {
    email: string;
    userId: string;
    displayName: string;
    allowedTools: ToolId[];
  }
): Promise<void> {
  const { email, userId, displayName, allowedTools } = params;

  const { data: existing, error: findError } = await adminClient
    .from('app_allowed_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) {
    throw new Error(`Nie udało się sprawdzić uprawnień konta demo: ${findError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await adminClient
      .from('app_allowed_users')
      .update({
        user_id: userId,
        role: 'admin',
        allowed_tools: allowedTools,
        display_name: displayName,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Nie udało się zaktualizować uprawnień konta demo: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await adminClient
    .from('app_allowed_users')
    .insert({
      email,
      user_id: userId,
      role: 'admin',
      allowed_tools: allowedTools,
      display_name: displayName,
    });

  if (insertError) {
    throw new Error(`Nie udało się nadać uprawnień kontu demo: ${insertError.message}`);
  }
}

export async function setupDemoEnvironment(
  adminClient: SupabaseClient,
  options: SetupDemoOptions
): Promise<SetupDemoResult> {
  const demoEmail = normalizeEmail(options.email || DEFAULT_DEMO_EMAIL);
  const password = options.password.trim();
  const displayName = options.displayName?.trim() || DEFAULT_DEMO_DISPLAY_NAME;
  const allowedTools = options.allowedTools?.length
    ? options.allowedTools
    : DEFAULT_DEMO_TOOLS;
  const resetMockData = options.resetMockData ?? true;

  if (!demoEmail) {
    throw new Error('Email konta demo nie może być pusty');
  }

  if (!password) {
    throw new Error('Hasło konta demo nie może być puste');
  }

  const { userId, userCreated } = await ensureDemoAuthUser(adminClient, demoEmail, password);
  await ensureAllowedUser(adminClient, {
    email: demoEmail,
    userId,
    displayName,
    allowedTools,
  });

  if (resetMockData) {
    await clearMockData(adminClient);
  }

  const seedResult = await seedMockData(adminClient);

  let threadsBuilt = 0;
  let emailsThreaded = 0;

  for (const mailbox of MOCK_MAILBOXES) {
    const threadResult = await buildThreadsForMailbox(
      adminClient,
      mailbox.id,
      mailbox.email_address,
      { generateAiSummaries: false }
    );

    threadsBuilt += threadResult.threadsCreated;
    emailsThreaded += threadResult.emailsUpdated;
  }

  return {
    demoEmail,
    userCreated,
    mailboxesSeeded: seedResult.mailboxes,
    emailsSeeded: seedResult.emails,
    threadsBuilt,
    emailsThreaded,
    allowedTools,
  };
}
