'use client';

import type { SyncStatus } from '@/types/email';

interface ConnectionStatusProps {
  status: SyncStatus;
  lastSyncAt: string | null;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'przed chwilą';
  if (diffMinutes < 60) return `${diffMinutes} min. temu`;
  if (diffHours < 24) return `${diffHours} godz. temu`;
  if (diffDays < 7) return `${diffDays} dni temu`;

  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_CONFIG: Record<SyncStatus, { color: string; pulse: boolean; label: string }> = {
  synced: { color: '#22c55e', pulse: false, label: 'Zsynchronizowano' },
  syncing: { color: '#f59e0b', pulse: true, label: 'Synchronizacja...' },
  error: { color: '#ef4444', pulse: false, label: 'Błąd' },
  never_synced: { color: '#6b7280', pulse: false, label: 'Nigdy nie synchronizowano' },
};

export default function ConnectionStatus({ status, lastSyncAt }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.never_synced;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.pulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: config.color }}
      />
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {config.label}
      </span>
      {lastSyncAt && status === 'synced' && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ({formatRelativeTime(lastSyncAt)})
        </span>
      )}
    </div>
  );
}
