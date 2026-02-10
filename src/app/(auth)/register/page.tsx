'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne');
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      setMessage('Sprawdź email, aby potwierdzić konto');
      setIsLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">Lulkiewicz PR Hub</h1>
        <p className="mt-2 text-slate-400">Utwórz nowe konto</p>
      </div>

      <div className="rounded-lg bg-white p-8 shadow-xl">
        {message ? (
          <div className="text-center">
            <p className="text-green-600 font-medium">{message}</p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Przejdź do logowania
            </Link>
          </div>
        ) : (
          <>
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
                {isLoading ? 'Rejestracja...' : 'Zarejestruj się'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-600">
              Masz już konto?{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Zaloguj się
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
