import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Custom lock function — bypasses Web Locks API which can hang
// indefinitely when a lock is not properly released (browser crash,
// tab close, React StrictMode double-mount).
const customLockFunction = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => {
  return fn();
};

let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: customLockFunction,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'lulkiewicz-pr-hub-auth',
        flowType: 'pkce',
      },
    }
  );
  return client;
}
