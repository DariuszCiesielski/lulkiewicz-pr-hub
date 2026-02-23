'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// --- Types ---

export type FbAnalysisUIStatus = 'idle' | 'starting' | 'processing' | 'paused' | 'completed' | 'error';

export interface FbAnalysisProgress {
  analyzedPosts: number;
  totalPosts: number;
  percentage: number;
}

export interface UseFbAnalysisJobReturn {
  startAnalysis: (groupId: string, forceReanalyze?: boolean) => Promise<void>;
  pauseJob: () => Promise<void>;
  resumeJob: (jobId: string, analyzedPosts: number, totalPosts: number) => void;
  status: FbAnalysisUIStatus;
  progress: FbAnalysisProgress;
  error: string | null;
  jobId: string | null;
  reset: () => void;
}

// --- Constants ---

const BATCH_DELAY_MS = 800;

// --- Hook ---

export function useFbAnalysisJob(onComplete?: () => void): UseFbAnalysisJobReturn {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<FbAnalysisUIStatus>('idle');
  const [progress, setProgress] = useState<FbAnalysisProgress>({
    analyzedPosts: 0,
    totalPosts: 0,
    percentage: 0,
  });
  const [error, setError] = useState<string | null>(null);

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

  // --- Process batch (polling loop) ---

  const processBatch = useCallback(async (jId: string) => {
    if (!mountedRef.current) return;

    try {
      const res = await fetch('/api/fb/analysis/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Blad HTTP ${res.status}` }));
        setStatus('error');
        setError(data.error || `Blad analizy (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      if (data.status === 'failed') {
        setStatus('error');
        setError(data.error || 'Analiza nie powiodla sie');
        return;
      }

      setProgress({
        analyzedPosts: data.analyzedPosts ?? 0,
        totalPosts: data.totalPosts ?? 0,
        percentage: data.totalPosts > 0
          ? Math.round((data.analyzedPosts / data.totalPosts) * 100)
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
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Blad polaczenia z serwerem');
    }
  }, []);

  // --- Start analysis ---

  const startAnalysis = useCallback(async (groupId: string, forceReanalyze?: boolean) => {
    clearBatchTimeout();
    setJobId(null);
    setStatus('starting');
    setProgress({ analyzedPosts: 0, totalPosts: 0, percentage: 0 });
    setError(null);
    mountedRef.current = true;

    try {
      const res = await fetch('/api/fb/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, forceReanalyze: forceReanalyze === true }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Blad HTTP ${res.status}` }));
        setStatus('error');
        setError(data.error || 'Nie udalo sie rozpoczac analizy');
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setJobId(data.jobId);
      setStatus('processing');
      setProgress({
        analyzedPosts: 0,
        totalPosts: data.totalPosts || 0,
        percentage: 0,
      });

      await processBatch(data.jobId);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Blad polaczenia z serwerem');
    }
  }, [clearBatchTimeout, processBatch]);

  // --- Pause job ---

  const pauseJob = useCallback(async () => {
    const currentJobId = jobId;
    if (!currentJobId) return;

    // Immediately stop polling
    clearBatchTimeout();
    setStatus('paused');

    try {
      await fetch('/api/fb/analysis/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId, action: 'pause' }),
      });
    } catch {
      // Even if API fails, we've already stopped polling locally
    }
  }, [jobId, clearBatchTimeout]);

  // --- Resume job ---

  const resumeJob = useCallback(async (jId: string, analyzedPosts: number, totalPosts: number) => {
    clearBatchTimeout();
    setJobId(jId);
    setStatus('processing');
    setError(null);
    setProgress({
      analyzedPosts,
      totalPosts,
      percentage: totalPosts > 0 ? Math.round((analyzedPosts / totalPosts) * 100) : 0,
    });
    mountedRef.current = true;

    // Ensure DB status is 'running' (handles resume from 'paused')
    try {
      await fetch('/api/fb/analysis/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId, action: 'resume' }),
      });
    } catch {
      // Ignore — if status was already 'running', the API returns 400 which is fine
    }

    processBatch(jId);
  }, [clearBatchTimeout, processBatch]);

  // --- Reset ---

  const reset = useCallback(() => {
    clearBatchTimeout();
    setJobId(null);
    setStatus('idle');
    setProgress({ analyzedPosts: 0, totalPosts: 0, percentage: 0 });
    setError(null);
  }, [clearBatchTimeout]);

  // --- Cleanup on unmount ---

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBatchTimeout();
    };
  }, [clearBatchTimeout]);

  return {
    startAnalysis,
    pauseJob,
    resumeJob,
    status,
    progress,
    error,
    jobId,
    reset,
  };
}
