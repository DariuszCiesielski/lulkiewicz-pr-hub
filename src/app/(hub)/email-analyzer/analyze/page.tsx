'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Play, Pause, Clock, CheckCircle, AlertCircle, Loader2, FileText, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysisJob } from '@/hooks/useAnalysisJob';
import DatePresets from '@/components/analysis/DatePresets';
import AnalysisProgress from '@/components/analysis/AnalysisProgress';

interface MailboxOption {
  id: string;
  display_name: string | null;
  email_address: string;
}

interface AnalysisHistoryItem {
  id: string;
  status: string;
  total_threads: number;
  processed_threads: number;
  date_range_from: string | null;
  date_range_to: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  estimated_cost_usd: number | null;
  total_tokens: number | null;
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getStatusLabel(status: string): { label: string; color: string; icon: typeof CheckCircle } {
  switch (status) {
    case 'completed':
      return { label: 'Zakończona', color: '#22c55e', icon: CheckCircle };
    case 'processing':
    case 'pending':
      return { label: 'W toku', color: 'var(--accent-primary)', icon: Loader2 };
    case 'paused':
      return { label: 'Wstrzymana', color: '#f59e0b', icon: Pause };
    case 'failed':
      return { label: 'Błąd', color: '#ef4444', icon: AlertCircle };
    default:
      return { label: status, color: 'var(--text-muted)', icon: Clock };
  }
}

export default function AnalyzePage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const analysisJob = useAnalysisJob(() => {
    // Po zakończeniu odśwież historię
    if (selectedMailboxId) {
      fetchHistory(selectedMailboxId);
    }
  });

  const fetchHistory = useCallback((mailboxId: string) => {
    if (!mailboxId) return;
    setHistoryLoading(true);
    fetch(`/api/analysis?mailboxId=${mailboxId}`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.jobs || []);
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  // Auto-resume: when history loads and there's an active job, resume polling
  const hasAutoResumed = useRef(false);
  useEffect(() => {
    if (hasAutoResumed.current) return;
    if (analysisJob.status !== 'idle') return;
    const activeJob = history.find((j) => j.status === 'processing' || j.status === 'pending');
    if (activeJob) {
      hasAutoResumed.current = true;
      analysisJob.resumeJob(activeJob.id, activeJob.processed_threads, activeJob.total_threads, activeJob.started_at || activeJob.created_at);
    }
  }, [history, analysisJob]);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  // Fetch mailboxes + restore persisted selection
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/mailboxes')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMailboxes(list);
        if (list.length > 0 && !selectedMailboxId) {
          const saved = localStorage.getItem('ea-selected-mailbox');
          const validSaved = saved && list.some((m: MailboxOption) => m.id === saved);
          setSelectedMailboxId(validSaved ? saved : list[0].id);
        }
      })
      .catch(() => setMailboxes([]));
  }, [isAdmin, selectedMailboxId]);

  // Persist mailbox selection
  useEffect(() => {
    if (selectedMailboxId) {
      localStorage.setItem('ea-selected-mailbox', selectedMailboxId);
    }
  }, [selectedMailboxId]);

  // Pobierz historię przy zmianie skrzynki
  useEffect(() => {
    if (selectedMailboxId) {
      fetchHistory(selectedMailboxId);
    }
  }, [selectedMailboxId, fetchHistory]);

  // Auto-refresh historii podczas trwającej analizy (co 15s)
  useEffect(() => {
    const isRunning = analysisJob.status === 'processing' || analysisJob.status === 'starting';
    if (!isRunning || !selectedMailboxId) return;

    const interval = setInterval(() => {
      fetchHistory(selectedMailboxId);
    }, 15_000);

    return () => clearInterval(interval);
  }, [analysisJob.status, selectedMailboxId, fetchHistory]);

  const handleStart = useCallback(() => {
    if (!selectedMailboxId) return;
    analysisJob.startAnalysis(
      selectedMailboxId,
      dateFrom || undefined,
      dateTo || undefined
    );
  }, [selectedMailboxId, dateFrom, dateTo, analysisJob]);

  const handlePause = useCallback(() => {
    analysisJob.pauseJob();
  }, [analysisJob]);

  const handleResume = useCallback(() => {
    if (analysisJob.jobId) {
      analysisJob.resumeJob(
        analysisJob.jobId,
        analysisJob.progress.processedThreads,
        analysisJob.progress.totalThreads,
        analysisJob.jobStartedAt?.toISOString()
      );
    }
  }, [analysisJob]);

  const handleResumeFromHistory = useCallback((job: AnalysisHistoryItem) => {
    analysisJob.resumeJob(job.id, job.processed_threads, job.total_threads, job.started_at || job.created_at);
  }, [analysisJob]);

  const handleCancel = useCallback(async (jobId: string) => {
    try {
      const res = await fetch('/api/analysis/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'cancel' }),
      });
      if (res.ok) {
        analysisJob.reset();
        if (selectedMailboxId) fetchHistory(selectedMailboxId);
      }
    } catch { /* ignore */ }
  }, [analysisJob, selectedMailboxId, fetchHistory]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const isRunning = analysisJob.status === 'starting' || analysisJob.status === 'processing';
  const isPaused = analysisJob.status === 'paused';

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
            disabled={isRunning || isPaused}
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
              disabled={isRunning || isPaused}
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
              disabled={isRunning || isPaused}
              className="rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Date presets */}
        <DatePresets
          onSelect={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
          disabled={isRunning || isPaused}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isRunning && !isPaused && (
            <button
              onClick={handleStart}
              disabled={!selectedMailboxId}
              className="flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Play className="h-4 w-4" />
              Rozpocznij analizę
            </button>
          )}

          {isRunning && (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#f59e0b' }}
            >
              <Pause className="h-4 w-4" />
              Wstrzymaj analizę
            </button>
          )}

          {isPaused && (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Play className="h-4 w-4" />
              Wznów analizę
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {analysisJob.status !== 'idle' && (
        <div className="mb-6">
          <AnalysisProgress
            status={analysisJob.status}
            progress={analysisJob.progress}
            error={analysisJob.error}
            startedAt={analysisJob.startedAt}
            jobStartedAt={analysisJob.jobStartedAt}
            processedAtStart={analysisJob.processedAtStart}
            onReset={analysisJob.reset}
          />
        </div>
      )}

      {/* Historia analiz */}
      <div
        className="rounded-lg border p-6"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Historia analiz
          </h2>
        </div>

        {historyLoading && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ładowanie...
          </p>
        )}

        {!historyLoading && history.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Brak wcześniejszych analiz dla tej skrzynki.
          </p>
        )}

        {!historyLoading && history.length > 0 && (
          <div className="space-y-2">
            {history.map((job) => {
              const statusInfo = getStatusLabel(job.status);
              const StatusIcon = statusInfo.icon;
              const dateRange = job.date_range_from || job.date_range_to
                ? `${job.date_range_from ? formatShortDate(job.date_range_from) : '...'} — ${job.date_range_to ? formatShortDate(job.date_range_to) : '...'}`
                : 'Cały zakres';

              return (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon
                      className={`h-3.5 w-3.5 shrink-0 ${(job.status === 'processing' || job.status === 'pending') ? 'animate-spin' : ''}`}
                      style={{ color: statusInfo.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {statusInfo.label}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {job.processed_threads}/{job.total_threads} wątków
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>{formatHistoryDate(job.created_at)}</span>
                        <span>{dateRange}</span>
                        {job.estimated_cost_usd !== null && (
                          <span
                            className="font-medium"
                            style={{ color: 'var(--text-secondary)' }}
                            title={job.total_tokens ? `${job.total_tokens.toLocaleString('pl-PL')} tokenów` : ''}
                          >
                            ${job.estimated_cost_usd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.error_message && (
                      <span
                        className="text-xs truncate max-w-[150px]"
                        style={{ color: '#ef4444' }}
                        title={job.error_message}
                      >
                        {job.error_message}
                      </span>
                    )}
                    {(job.status === 'processing' || job.status === 'pending' || job.status === 'paused') && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: '#ef4444',
                          color: '#fff',
                        }}
                      >
                        <XCircle className="h-3 w-3" />
                        Anuluj
                      </button>
                    )}
                    {job.status === 'paused' && analysisJob.status === 'idle' && (
                      <button
                        onClick={() => handleResumeFromHistory(job)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#fff',
                        }}
                      >
                        <Play className="h-3 w-3" />
                        Wznów
                      </button>
                    )}
                    {job.status === 'completed' && (
                      <button
                        onClick={() => router.push('/email-analyzer/reports')}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#fff',
                        }}
                      >
                        <FileText className="h-3 w-3" />
                        Generuj raport
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
