'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-400">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-white">
        Witaj w Lulkiewicz PR Hub
      </h1>
      <p className="mt-2 text-slate-400">
        Zalogowano jako: {user?.email}
      </p>
      <button
        onClick={handleSignOut}
        className="mt-6 rounded-md bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
      >
        Wyloguj się
      </button>
    </div>
  );
}
