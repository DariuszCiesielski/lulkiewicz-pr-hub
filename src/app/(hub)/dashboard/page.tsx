'use client';

import { useAuth } from '@/contexts/AuthContext';
import ToolsGrid from '@/components/dashboard/ToolsGrid';

export default function DashboardPage() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Witaj w Lulkiewicz PR Hub
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
          Wybierz narzędzie z którym chcesz pracować
        </p>
      </div>

      <ToolsGrid />
    </div>
  );
}
