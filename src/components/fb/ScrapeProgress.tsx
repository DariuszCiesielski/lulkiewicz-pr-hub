'use client';

import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { ScrapeUIStatus, ScrapeProgress as ScrapeProgressType, ScrapeErrorInfo } from '@/types/fb';

interface ScrapeProgressProps {
  status: ScrapeUIStatus;
  progress: ScrapeProgressType;
  error: ScrapeErrorInfo | null;
  onRetry?: () => void;
  onReset: () => void;
  cookieCheckWarning?: string | null;
  onProceedAnyway?: () => void;
}

function formatSeconds(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec}s`;
}

export default function ScrapeProgress({
  status,
  progress,
  error,
  onRetry,
  onReset,
  cookieCheckWarning,
  onProceedAnyway,
}: ScrapeProgressProps) {
  // Cookie health check in progress
  if (status === 'cookie_check') {
    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: '#eab308' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Sprawdzanie cookies Facebook...
          </p>
        </div>
      </div>
    );
  }

  // Cookie check warning — shown when check failed and user can proceed or cancel
  if (cookieCheckWarning && status === 'idle') {
    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'rgba(234, 179, 8, 0.3)',
          backgroundColor: 'rgba(234, 179, 8, 0.05)',
        }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#eab308' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: '#eab308' }}>
              Sprawdzanie cookies nie powiodlo sie
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {cookieCheckWarning}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {onProceedAnyway && (
                <button
                  onClick={onProceedAnyway}
                  className="rounded-md px-3 py-1 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#eab308' }}
                >
                  Kontynuuj mimo to
                </button>
              )}
              <button
                onClick={onReset}
                className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'idle' && !progress.isWaitingBetweenGroups) {
    return null;
  }

  // Waiting between groups
  if (progress.isWaitingBetweenGroups) {
    const waitPercent = progress.estimatedWaitSeconds
      ? Math.max(0, ((progress.estimatedWaitSeconds - progress.waitSecondsRemaining) / progress.estimatedWaitSeconds) * 100)
      : 0;

    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 flex-shrink-0" style={{ color: '#eab308' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Oczekiwanie {formatSeconds(progress.waitSecondsRemaining)} przed kolejna grupa...
            </p>
            {progress.groupsTotal > 1 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Grupa {progress.groupsCompleted}/{progress.groupsTotal} ukonczona
                {progress.currentGroup && ` — nastepna: ${progress.currentGroup}`}
              </p>
            )}
            {/* Countdown bar */}
            <div
              className="mt-2 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--border-primary)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${waitPercent}%`,
                  backgroundColor: '#eab308',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Starting
  if (status === 'starting') {
    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Rozpoczynanie scrapowania...
          </p>
        </div>
      </div>
    );
  }

  // Running
  if (status === 'running') {
    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Scrapowanie w toku...
              {progress.apifyStatus && (
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  ({progress.apifyStatus})
                </span>
              )}
            </p>
            {progress.groupsTotal > 1 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Grupa {progress.groupsCompleted + 1}/{progress.groupsTotal}: {progress.currentGroup}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Downloading
  if (status === 'downloading') {
    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Pobieranie wynikow... {progress.postsFound > 0 && `${progress.postsFound} postow`}
            </p>
            <div className="flex items-center gap-3 mt-1">
              {progress.postsNew > 0 && (
                <span className="text-xs" style={{ color: '#22c55e' }}>
                  {progress.postsNew} nowych
                </span>
              )}
              {progress.postsUpdated > 0 && (
                <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>
                  {progress.postsUpdated} zaktualizowanych
                </span>
              )}
            </div>
            {progress.groupsTotal > 1 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Grupa {progress.groupsCompleted + 1}/{progress.groupsTotal}: {progress.currentGroup}
              </p>
            )}
            {/* Animated progress bar */}
            <div
              className="mt-2 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--border-primary)' }}
            >
              <div
                className="h-full rounded-full animate-pulse"
                style={{
                  width: '60%',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed
  if (status === 'completed') {
    const noPostsWarning = progress.postsFound === 0;

    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: noPostsWarning ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)',
          backgroundColor: noPostsWarning ? 'rgba(234, 179, 8, 0.05)' : 'rgba(34, 197, 94, 0.05)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {noPostsWarning ? (
              <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: '#eab308' }} />
            ) : (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: '#22c55e' }} />
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {noPostsWarning ? 'Scrapowanie zakonczone — brak nowych postow' : 'Scrapowanie zakonczone'}
              </p>
              {!noPostsWarning && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {progress.postsFound} postow, {progress.postsNew} nowych, {progress.postsUpdated} zaktualizowanych
                </p>
              )}
              {noPostsWarning && (
                <p className="text-xs mt-0.5" style={{ color: '#eab308' }}>
                  Nie znaleziono nowych postow. Jesli grupa jest aktywna, moze to oznaczac wygasle cookies.
                </p>
              )}
              {progress.groupsTotal > 1 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {progress.groupsCompleted}/{progress.groupsTotal} grup ukonczone
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onReset}
            className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  // Error
  if (status === 'error' && error) {
    return (
      <div
        className="sticky top-0 z-10 rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
        }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
              {error.message}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {error.suggestion}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="rounded-md px-3 py-1 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  Sprobuj ponownie
                </button>
              )}
              <button
                onClick={onReset}
                className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
