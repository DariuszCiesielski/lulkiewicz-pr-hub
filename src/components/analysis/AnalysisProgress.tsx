'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, RefreshCw, FileText, Loader2, Pause } from 'lucide-react';
import type { AnalysisUIStatus, AnalysisProgress as AnalysisProgressData } from '@/hooks/useAnalysisJob';

interface AnalysisProgressProps {
  status: AnalysisUIStatus;
  progress: AnalysisProgressData;
  error: string | null;
  startedAt: Date | null;
  jobStartedAt: Date | null;
  processedAtStart?: number;
  onReset: () => void;
}

function getETA(processed: number, total: number, startedAt: Date | null, processedAtStart: number): string {
  const processedInSession = processed - processedAtStart;
  if (!startedAt || processedInSession <= 0) return 'Obliczanie...';
  const elapsedMs = Date.now() - startedAt.getTime();
  const avgPerThread = elapsedMs / processedInSession;
  const remainingMs = avgPerThread * (total - processed);
  const remainingMin = Math.ceil(remainingMs / 60000);
  if (remainingMin <= 1) return 'Mniej niż minuta';
  return `~${remainingMin} min`;
}

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.value = 0.3;

    oscillator.start();
    // Two short beeps
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + 0.4);

    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch {
    // Ignoruj błędy autoplay / brak Web Audio API
  }
}

export default function AnalysisProgress({
  status,
  progress,
  error,
  startedAt,
  jobStartedAt,
  processedAtStart = 0,
  onReset,
}: AnalysisProgressProps) {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ea-sound-enabled') === '1';
    }
    return false;
  });
  const soundPlayedRef = useRef(false);
  const prevStatusRef = useRef<AnalysisUIStatus>(status);

  // Play sound on completion
  useEffect(() => {
    if (
      status === 'completed' &&
      prevStatusRef.current !== 'completed' &&
      soundEnabled &&
      !soundPlayedRef.current
    ) {
      soundPlayedRef.current = true;
      playBeep();
    }
    if (status !== 'completed') {
      soundPlayedRef.current = false;
    }
    prevStatusRef.current = status;
  }, [status, soundEnabled]);

  const getDurationText = useCallback((): string => {
    const ref = jobStartedAt || startedAt;
    if (!ref) return '';
    const elapsedMs = Date.now() - ref.getTime();
    const minutes = Math.round(elapsedMs / 60000);
    if (minutes < 1) return 'mniej niż minuta';
    if (minutes === 1) return '1 minuta';
    if (minutes < 5) return `${minutes} minuty`;
    return `${minutes} minut`;
  }, [jobStartedAt, startedAt]);

  const isRunning = status === 'starting' || status === 'processing';

  if (status === 'idle') return null;

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Header with status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning && (
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: 'var(--accent-primary)' }}
            />
          )}
          {status === 'paused' && (
            <Pause className="h-4 w-4" style={{ color: '#f59e0b' }} />
          )}
          {status === 'completed' && (
            <CheckCircle className="h-4 w-4" style={{ color: '#22c55e' }} />
          )}
          {status === 'error' && (
            <AlertCircle className="h-4 w-4" style={{ color: '#ef4444' }} />
          )}
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {status === 'starting' && 'Inicjalizacja...'}
            {status === 'processing' && 'Przetwarzanie wątków...'}
            {status === 'paused' && 'Analiza wstrzymana'}
            {status === 'completed' && 'Analiza zakończona!'}
            {status === 'error' && 'Wystąpił błąd'}
          </span>
        </div>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {progress.processedThreads}/{progress.totalThreads}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full overflow-hidden mb-3"
        style={{ backgroundColor: 'var(--border-primary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress.percentage}%`,
            backgroundColor:
              status === 'error'
                ? '#ef4444'
                : status === 'completed'
                  ? '#22c55e'
                  : status === 'paused'
                    ? '#f59e0b'
                    : 'var(--accent-primary)',
          }}
        />
      </div>

      {/* Paused info */}
      {status === 'paused' && (
        <p className="text-xs mb-3" style={{ color: '#f59e0b' }}>
          Analiza została wstrzymana. Możesz ją wznowić w dowolnym momencie — kontynuuje od miejsca przerwania.
        </p>
      )}

      {/* ETA */}
      {isRunning && (
        <div className="space-y-1 mb-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Szacowany czas:{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              {getETA(progress.processedThreads, progress.totalThreads, startedAt, processedAtStart)}
            </span>
          </p>
          {progress.processedThreads >= 3 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Możesz opuścić stronę — analiza kontynuuje się w tle.
            </p>
          )}
        </div>
      )}

      {/* Sound checkbox */}
      {isRunning && (
        <label
          className="flex items-center gap-2 text-xs cursor-pointer mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => {
              setSoundEnabled(e.target.checked);
              localStorage.setItem('ea-sound-enabled', e.target.checked ? '1' : '0');
            }}
            className="rounded"
          />
          Powiadom dźwiękiem po zakończeniu
        </label>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}

      {/* Completion summary */}
      {status === 'completed' && (
        <div className="mt-2">
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            Przeanalizowano {progress.totalThreads}{' '}
            {progress.totalThreads === 1
              ? 'wątek'
              : progress.totalThreads < 5
                ? 'wątki'
                : 'wątków'}{' '}
            w {getDurationText()}.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/email-analyzer/reports')}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <FileText className="h-3.5 w-3.5" />
              Zobacz raporty
            </button>
            <button
              onClick={onReset}
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
        </div>
      )}
    </div>
  );
}
