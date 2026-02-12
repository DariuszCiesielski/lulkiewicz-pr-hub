'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Play, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysisJob } from '@/hooks/useAnalysisJob';

interface MailboxOption {
  id: string;
  display_name: string | null;
  email_address: string;
}

export default function AnalyzePage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const analysisJob = useAnalysisJob(() => {
    // On complete — could navigate to reports
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

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

  const handleStart = useCallback(() => {
    if (!selectedMailboxId) return;
    analysisJob.startAnalysis(
      selectedMailboxId,
      dateFrom || undefined,
      dateTo || undefined
    );
  }, [selectedMailboxId, dateFrom, dateTo, analysisJob]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const isRunning = analysisJob.status === 'starting' || analysisJob.status === 'processing';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Analiza AI
        </h1>
      </div>

      {/* Config */}
      <div
        className="rounded-lg border p-6 space-y-4 mb-6"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Mailbox selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Skrzynka
          </label>
          <select
            value={selectedMailboxId}
            onChange={(e) => setSelectedMailboxId(e.target.value)}
            disabled={isRunning}
            className="rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
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

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Od (opcjonalnie)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={isRunning}
              className="rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Do (opcjonalnie)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={isRunning}
              className="rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={isRunning || !selectedMailboxId}
          className="flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Play className={`h-4 w-4 ${isRunning ? 'animate-pulse' : ''}`} />
          {isRunning ? 'Analiza w toku...' : 'Rozpocznij analizę'}
        </button>
      </div>

      {/* Progress */}
      {analysisJob.status !== 'idle' && (
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {analysisJob.status === 'starting' && 'Inicjalizacja...'}
              {analysisJob.status === 'processing' && 'Przetwarzanie wątków...'}
              {analysisJob.status === 'completed' && 'Analiza zakończona!'}
              {analysisJob.status === 'error' && 'Wystąpił błąd'}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {analysisJob.progress.processedThreads}/{analysisJob.progress.totalThreads}
            </span>
          </div>

          {(analysisJob.status === 'starting' || analysisJob.status === 'processing') && (
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Analiza każdego wątku wymaga wielu zapytań do AI — cały proces może potrwać kilka minut. Nie zamykaj tej strony.
            </p>
          )}

          {/* Progress bar */}
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--border-primary)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${analysisJob.progress.percentage}%`,
                backgroundColor: analysisJob.status === 'error'
                  ? '#ef4444'
                  : analysisJob.status === 'completed'
                    ? '#22c55e'
                    : 'var(--accent-primary)',
              }}
            />
          </div>

          {analysisJob.error && (
            <p className="mt-2 text-sm" style={{ color: '#ef4444' }}>
              {analysisJob.error}
            </p>
          )}

          {analysisJob.status === 'completed' && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => router.push('/email-analyzer/reports')}
                className="rounded-md px-3 py-1.5 text-sm text-white hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                Zobacz raporty
              </button>
              <button
                onClick={analysisJob.reset}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Nowa analiza
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
