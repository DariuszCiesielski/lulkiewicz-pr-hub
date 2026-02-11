'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, RefreshCw, Hammer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ThreadList from '@/components/threads/ThreadList';
import ThreadFilters, { type ThreadFilterValues } from '@/components/threads/ThreadFilters';
import type { EmailThread } from '@/types/email';

interface MailboxOption {
  id: string;
  display_name: string | null;
  email_address: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ThreadsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ThreadFilterValues>({
    search: '', status: '', from: '', to: '',
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  // Fetch mailboxes
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/mailboxes')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMailboxes(list);
        if (list.length > 0 && !selectedMailboxId) {
          setSelectedMailboxId(list[0].id);
        }
      })
      .catch(() => setMailboxes([]));
  }, [isAdmin, selectedMailboxId]);

  // Fetch threads
  const fetchThreads = useCallback(async (page = 1) => {
    if (!selectedMailboxId) return;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ mailboxId: selectedMailboxId, page: String(page) });
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', new Date(filters.from).toISOString());
    if (filters.to) params.set('to', new Date(filters.to + 'T23:59:59').toISOString());

    try {
      const res = await fetch(`/api/threads?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd pobierania wątków');
      }
      const data = await res.json();
      setThreads(data.threads);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMailboxId, filters]);

  useEffect(() => {
    if (selectedMailboxId) {
      fetchThreads(1);
    }
  }, [selectedMailboxId, fetchThreads]);

  // Build threads
  const handleBuildThreads = async () => {
    if (!selectedMailboxId) return;
    setIsBuilding(true);
    setBuildResult(null);
    setError(null);

    try {
      const res = await fetch('/api/threads/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailboxId: selectedMailboxId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd budowania wątków');
      setBuildResult(data.message);
      await fetchThreads(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsBuilding(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Wątki email
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchThreads(1)}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież
          </button>
          <button
            onClick={handleBuildThreads}
            disabled={isBuilding || !selectedMailboxId}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Hammer className={`h-4 w-4 ${isBuilding ? 'animate-spin' : ''}`} />
            {isBuilding ? 'Budowanie...' : 'Buduj wątki'}
          </button>
        </div>
      </div>

      {/* Mailbox selector */}
      <div className="mb-4">
        <select
          value={selectedMailboxId}
          onChange={(e) => setSelectedMailboxId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        >
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name || m.email_address}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <ThreadFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Notifications */}
      {buildResult && (
        <div
          className="mb-4 rounded-md border p-3 text-sm"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
          }}
        >
          {buildResult}
        </div>
      )}

      {error && (
        <div
          className="mb-4 rounded-md border p-3 text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Thread list */}
      <ThreadList
        threads={threads}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={(page) => fetchThreads(page)}
      />
    </div>
  );
}
