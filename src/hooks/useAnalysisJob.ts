'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type AnalysisUIStatus = 'idle' | 'starting' | 'processing' | 'paused' | 'completed' | 'error';

export interface AnalysisProgress {
  processedThreads: number;
  totalThreads: number;
  percentage: number;
}

export interface UseAnalysisJobReturn {
  startAnalysis: (mailboxId: string, dateFrom?: string, dateTo?: string, profileId?: string) => Promise<void>;
  resumeJob: (jobId: string, processedThreads: number, totalThreads: number, jobStartedAt?: string) => void;
  pauseJob: () => Promise<void>;
  status: AnalysisUIStatus;
  progress: AnalysisProgress;
  error: string | null;
  jobId: string | null;
  startedAt: Date | null;
  jobStartedAt: Date | null;
  processedAtStart: number;
  reset: () => void;
}

const BATCH_DELAY_MS = 800;
const MAX_NETWORK_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

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
  const [jobStartedAt, setJobStartedAt] = useState<Date | null>(null);
  const [processedAtStart, setProcessedAtStart] = useState(0);

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

  const networkRetryRef = useRef(0);

  const processBatch = useCallback(async (jId: string) => {
    if (!mountedRef.current) return;

    try {
      const res = await fetch('/api/analysis/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId }),
      });

      if (!mountedRef.current) return;

      // Reset retry counter on any successful HTTP response
      networkRetryRef.current = 0;

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

      if (data.status === 'paused') {
        setStatus('paused');
        return;
      }

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

      // Retry on network errors (Failed to fetch, timeout, connection reset)
      networkRetryRef.current += 1;
      if (networkRetryRef.current <= MAX_NETWORK_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, networkRetryRef.current - 1);
        console.warn(`Network error (attempt ${networkRetryRef.current}/${MAX_NETWORK_RETRIES}), retrying in ${delay}ms...`, err);
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) processBatch(jId);
        }, delay);
        return;
      }

      setStatus('error');
      setError(err instanceof Error ? err.message : 'Błąd połączenia z serwerem');
    }
  }, []);

  const startAnalysis = useCallback(async (
    mailboxId: string,
    dateFrom?: string,
    dateTo?: string,
    profileId?: string
  ) => {
    clearBatchTimeout();
    setJobId(null);
    setStatus('starting');
    setProgress({ processedThreads: 0, totalThreads: 0, percentage: 0 });
    setError(null);
    setStartedAt(null);
    setJobStartedAt(null);
    setProcessedAtStart(0);
    mountedRef.current = true;

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId,
          dateRangeFrom: dateFrom || undefined,
          dateRangeTo: dateTo || undefined,
          profileId: profileId || undefined,
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

      const now = new Date();
      setJobId(data.jobId);
      setStatus('processing');
      setStartedAt(now);
      setJobStartedAt(now);
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

  // Pause a running analysis
  const pauseJob = useCallback(async () => {
    const currentJobId = jobId;
    if (!currentJobId) return;

    // Immediately stop polling
    clearBatchTimeout();
    setStatus('paused');

    try {
      await fetch('/api/analysis/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId, action: 'pause' }),
      });
    } catch {
      // Even if API fails, we've already stopped polling locally
    }
  }, [jobId, clearBatchTimeout]);

  // Resume a processing job (e.g. after page reload / hot reload / manual resume from paused / error retry)
  const resumeJob = useCallback(async (jId: string, processedThreads: number, totalThreads: number, realStartedAt?: string) => {
    clearBatchTimeout();
    networkRetryRef.current = 0;
    setJobId(jId);
    setStatus('processing');
    setStartedAt(new Date()); // session start for ETA calculation
    setJobStartedAt(realStartedAt ? new Date(realStartedAt) : new Date()); // real job start for duration display
    setProcessedAtStart(processedThreads);
    setError(null);
    setProgress({
      processedThreads,
      totalThreads,
      percentage: totalThreads > 0 ? Math.round((processedThreads / totalThreads) * 100) : 0,
    });
    mountedRef.current = true;

    // Ensure DB status is 'processing' (handles resume from 'paused')
    try {
      await fetch('/api/analysis/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId, action: 'resume' }),
      });
    } catch {
      // Ignore — if status was already 'processing', the API returns 400 which is fine
    }

    processBatch(jId);
  }, [clearBatchTimeout, processBatch]);

  const reset = useCallback(() => {
    clearBatchTimeout();
    setJobId(null);
    setStatus('idle');
    setProgress({ processedThreads: 0, totalThreads: 0, percentage: 0 });
    setError(null);
    setStartedAt(null);
    setJobStartedAt(null);
  }, [clearBatchTimeout]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBatchTimeout();
    };
  }, [clearBatchTimeout]);

  return { startAnalysis, resumeJob, pauseJob, status, progress, error, jobId, startedAt, jobStartedAt, processedAtStart, reset };
}
