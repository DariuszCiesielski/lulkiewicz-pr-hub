'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Handle invite/recovery tokens in URL hash
  useEffect(() => {
    const handleAuthEvent = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // Check if this is an invite flow (token in URL hash)
      const hash = window.location.hash;
      if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
        // Session was already established by detectSessionInUrl
        if (session) {
          router.push('/auth/set-password');
          return;
        }
      }

      // If already logged in (not from invite), go to dashboard
      if (session) {
        router.push('/dashboard');
        return;
      }

      setCheckingInvite(false);
    };

    handleAuthEvent();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Nieprawidłowy email lub hasło');
      setIsLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  if (checkingInvite) {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-slate-400">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">Lulkiewicz PR Hub</h1>
        <p className="mt-2 text-slate-400">Zaloguj się do swojego konta</p>
      </div>

      <div className="rounded-lg bg-white p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="twoj@email.pl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-white font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Nie masz konta?{' '}
          <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
            Zarejestruj się
          </Link>
        </p>
      </div>
    </div>
  );
}
