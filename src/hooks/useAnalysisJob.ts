'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type AnalysisUIStatus = 'idle' | 'starting' | 'processing' | 'completed' | 'error';

export interface AnalysisProgress {
  processedThreads: number;
  totalThreads: number;
  percentage: number;
}

export interface UseAnalysisJobReturn {
  startAnalysis: (mailboxId: string, dateFrom?: string, dateTo?: string) => Promise<void>;
  status: AnalysisUIStatus;
  progress: AnalysisProgress;
  error: string | null;
  jobId: string | null;
  startedAt: Date | null;
  reset: () => void;
}

const BATCH_DELAY_MS = 800;

export function useAnalysisJob(onComplete?: () => void): UseAnalysisJobReturn {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisUIStatus>('idle');
  const [progress, setProgress] = useState<AnalysisProgress>({
    processedThreads: 0,
    totalThreads: 0,
    percentage: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearBatchTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const processBatch = useCallback(async (jId: string) => {
    if (!mountedRef.current) return;

    try {
      const res = await fetch('/api/analysis/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Błąd HTTP ${res.status}` }));
        setStatus('error');
        setError(data.error || `Błąd analizy (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      if (data.status === 'failed') {
        setStatus('error');
        setError(data.error || 'Analiza nie powiodła się');
        return;
      }

      setProgress({
        processedThreads: data.processedThreads ?? 0,
        totalThreads: data.totalThreads ?? 0,
        percentage: data.totalThreads > 0
          ? Math.round((data.processedThreads / data.totalThreads) * 100)
          : 0,
      });

      if (data.hasMore) {
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) processBatch(jId);
        }, BATCH_DELAY_MS);
      } else if (data.status === 'completed') {
        setStatus('completed');
        onCompleteRef.current?.();
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Błąd połączenia z serwerem');
    }
  }, []);

  const startAnalysis = useCallback(async (
    mailboxId: string,
    dateFrom?: string,
    dateTo?: string
  ) => {
    clearBatchTimeout();
    setJobId(null);
    setStatus('starting');
    setProgress({ processedThreads: 0, totalThreads: 0, percentage: 0 });
    setError(null);
    setStartedAt(null);
    mountedRef.current = true;

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId,
          dateRangeFrom: dateFrom || undefined,
          dateRangeTo: dateTo || undefined,
        }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Błąd HTTP ${res.status}` }));
        setStatus('error');
        setError(data.error || 'Nie udało się rozpocząć analizy');
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setJobId(data.jobId);
      setStatus('processing');
      setStartedAt(new Date());
      setProgress({
        processedThreads: 0,
        totalThreads: data.totalThreads || 0,
        percentage: 0,
      });

      await processBatch(data.jobId);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Błąd połączenia z serwerem');
    }
  }, [clearBatchTimeout, processBatch]);

  const reset = useCallback(() => {
    clearBatchTimeout();
    setJobId(null);
    setStatus('idle');
    setProgress({ processedThreads: 0, totalThreads: 0, percentage: 0 });
    setError(null);
    setStartedAt(null);
  }, [clearBatchTimeout]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBatchTimeout();
    };
  }, [clearBatchTimeout]);

  return { startAnalysis, status, progress, error, jobId, startedAt, reset };
}
