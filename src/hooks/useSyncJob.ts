'use client';

import { useState, useCallback, useRef } from 'react';
import type { SyncJobType } from '@/types/email';

// --- Types ---

export type SyncUIStatus = 'idle' | 'starting' | 'syncing' | 'completed' | 'error';

export interface SyncProgress {
  fetched: number;
  estimatedTotal: number | null;
  currentBatch: number;
}

export interface UseSyncJobReturn {
  startSync: (mailboxId: string, type?: SyncJobType) => Promise<void>;
  status: SyncUIStatus;
  progress: SyncProgress;
  error: string | null;
  jobId: string | null;
  syncType: SyncJobType | null;
  reset: () => void;
}

// --- Constants ---

const BATCH_DELAY_MS = 500;

// --- Hook ---

export function useSyncJob(onComplete?: () => void): UseSyncJobReturn {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncUIStatus>('idle');
  const [progress, setProgress] = useState<SyncProgress>({
    fetched: 0,
    estimatedTotal: null,
    currentBatch: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [syncType, setSyncType] = useState<SyncJobType | null>(null);

  // Ref for timeout cleanup on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track if component is still mounted
  const mountedRef = useRef(true);
  // Ref for onComplete to avoid stale closure
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Cleanup timeout helper
  const clearBatchTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Process a single batch
  const processBatch = useCallback(async (jId: string, batchNumber: number) => {
    if (!mountedRef.current) return;

    try {
      const res = await fetch('/api/sync/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Błąd HTTP ${res.status}` }));
        setStatus('error');
        setError(data.error || `Błąd synchronizacji (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      // Check for failed status in response
      if (data.status === 'failed') {
        setStatus('error');
        setError(data.error_message || data.error || 'Synchronizacja nie powiodła się');
        return;
      }

      // Update progress
      setProgress({
        fetched: data.totalFetched ?? 0,
        estimatedTotal: data.estimatedTotal ?? null,
        currentBatch: batchNumber,
      });

      if (data.status === 'has_more' || data.hasMore) {
        // More batches to process — delay then continue
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            processBatch(jId, batchNumber + 1);
          }
        }, BATCH_DELAY_MS);
      } else if (data.status === 'completed') {
        // Sync finished
        setStatus('completed');
        onCompleteRef.current?.();
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Błąd połączenia z serwerem');
    }
  }, []);

  // Start sync
  const startSync = useCallback(async (mailboxId: string, type: SyncJobType = 'full') => {
    // Reset previous state
    clearBatchTimeout();
    setJobId(null);
    setStatus('starting');
    setProgress({ fetched: 0, estimatedTotal: null, currentBatch: 0 });
    setError(null);
    setSyncType(type);
    mountedRef.current = true;

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailboxId, type }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Błąd HTTP ${res.status}` }));
        setStatus('error');
        setError(data.error || `Nie udało się rozpocząć synchronizacji (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setJobId(data.jobId);
      setStatus('syncing');

      // Start processing batches
      await processBatch(data.jobId, 1);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Błąd połączenia z serwerem');
    }
  }, [clearBatchTimeout, processBatch]);

  // Reset to idle
  const reset = useCallback(() => {
    clearBatchTimeout();
    mountedRef.current = false;
    setJobId(null);
    setStatus('idle');
    setProgress({ fetched: 0, estimatedTotal: null, currentBatch: 0 });
    setError(null);
    setSyncType(null);
  }, [clearBatchTimeout]);

  return {
    startSync,
    status,
    progress,
    error,
    jobId,
    syncType,
    reset,
  };
}
