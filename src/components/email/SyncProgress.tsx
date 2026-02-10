'use client';

import { Check, X, RefreshCw, Loader2 } from 'lucide-react';
import type { SyncUIStatus, SyncProgress as SyncProgressData } from '@/hooks/useSyncJob';
import type { SyncJobType } from '@/types/email';

interface SyncProgressProps {
  status: SyncUIStatus;
  progress: SyncProgressData;
  error: string | null;
  syncType: SyncJobType | null;
  onRetry?: () => void;
}

export default function SyncProgress({ status, progress, error, syncType, onRetry }: SyncProgressProps) {
  const { fetched, estimatedTotal } = progress;

  // Calculate percentage (0-100)
  const percentage = estimatedTotal && estimatedTotal > 0
    ? Math.min(Math.round((fetched / estimatedTotal) * 100), 100)
    : null;

  // Determine if bar is indeterminate (no estimated total)
  const isIndeterminate = status === 'syncing' && percentage === null;

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-primary)' }}>
      {/* Starting state */}
      {status === 'starting' && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Rozpoczynanie synchronizacji...
          </span>
        </div>
      )}

      {/* Syncing state */}
      {status === 'syncing' && (
        <div>
          {/* Progress bar */}
          <div
            className="h-2.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-tertiary, rgba(0,0,0,0.1))' }}
          >
            {isIndeterminate ? (
              <div
                className="h-full w-1/3 rounded-full animate-pulse"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  animation: 'syncPulse 1.5s ease-in-out infinite',
                }}
              />
            ) : (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: 'var(--accent-primary)',
                  transition: 'width 300ms ease-in-out',
                }}
              />
            )}
          </div>

          {/* Progress text */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {syncType === 'delta' ? (
                <>Pobieranie nowych wiadomości... ({fetched} nowych)</>
              ) : estimatedTotal && estimatedTotal > 0 ? (
                <>Pobrano {fetched} z ~{estimatedTotal} wiadomości</>
              ) : (
                <>Pobrano {fetched} wiadomości...</>
              )}
            </span>
            {percentage !== null && (
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {percentage}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Completed state */}
      {status === 'completed' && (
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" style={{ color: '#22c55e' }} />
          <span className="text-sm" style={{ color: '#22c55e' }}>
            Synchronizacja zakończona. Pobrano {fetched} wiadomości.
          </span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <X className="h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
            <span className="text-sm truncate" style={{ color: '#ef4444' }}>
              Błąd synchronizacji: {error}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 shrink-0 rounded-md border px-2 py-1 text-xs transition-colors hover:opacity-80"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
              }}
            >
              <RefreshCw className="h-3 w-3" />
              Ponów
            </button>
          )}
        </div>
      )}

      {/* CSS animation for indeterminate bar */}
      <style jsx>{`
        @keyframes syncPulse {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
