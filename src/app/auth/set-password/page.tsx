'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email ?? null);
    };
    checkUser();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Lulkiewicz PR Hub</h1>
          <p className="mt-2 text-slate-400">Ustaw hasło do swojego konta</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-xl">
          {userEmail && (
            <p className="mb-4 text-sm text-slate-600 text-center">
              Konto: <strong>{userEmail}</strong>
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Nowe hasło
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min. 6 znaków"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Potwierdź hasło
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Powtórz hasło"
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
              {isLoading ? 'Zapisywanie...' : 'Ustaw hasło'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
