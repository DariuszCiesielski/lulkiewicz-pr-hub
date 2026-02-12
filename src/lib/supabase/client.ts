import { createBrowserClient } from '@supabase/ssr';

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

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: customLockFunction,
      } as Record<string, unknown>,
    }
  );
  return client;
}
