'use client';

import { useState } from 'react';
import { Wifi, Trash2, Mail, Play, RotateCcw, CheckCircle2, XCircle, CircleDashed, Pencil } from 'lucide-react';
import ConnectionStatus from './ConnectionStatus';
import SyncProgress from './SyncProgress';
import type { SyncStatus, SyncJobType } from '@/types/email';
import type { SyncUIStatus, SyncProgress as SyncProgressData } from '@/hooks/useSyncJob';

export interface MailboxListItem {
  id: string;
  email_address: string;
  display_name: string | null;
  connection_type: string;
  sync_status: SyncStatus;
  last_sync_at: string | null;
  total_emails: number;
  email_count: number;
  created_at: string;
  connection_tested_at: string | null;
  connection_test_ok: boolean | null;
}

export interface MailboxSyncState {
  mailboxId: string;
  status: SyncUIStatus;
  progress: SyncProgressData;
  error: string | null;
  syncType: SyncJobType | null;
}

interface MailboxListProps {
  mailboxes: MailboxListItem[];
  onTestConnection: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (mailbox: MailboxListItem) => void;
  onStartSync: (id: string) => void;
  onDeltaSync: (id: string) => void;
  onRetrySync: () => void;
  syncState: MailboxSyncState | null;
}

function formatTestDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MailboxList({
  mailboxes,
  onTestConnection,
  onDelete,
  onEdit,
  onStartSync,
  onDeltaSync,
  onRetrySync,
  syncState,
}: MailboxListProps) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (mailboxes.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <Mail className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          Brak skrzynek
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Dodaj pierwsza skrzynke aby rozpoczac.
        </p>
      </div>
    );
  }

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    try {
      const res = await fetch(`/api/mailboxes/${id}/test-connection`, { method: 'POST' });
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [id]: { success: data.success, message: data.message } }));
      await onTestConnection(id);
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, message: 'Blad polaczenia z serwerem' } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, emailAddress: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunac skrzynke ${emailAddress}? Ta operacja jest nieodwracalna.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Check if any sync is active (to disable buttons on other mailboxes)
  const isSyncActive = syncState !== null &&
    syncState.status !== 'idle' &&
    syncState.status !== 'completed' &&
    syncState.status !== 'error';

  return (
    <div className="space-y-3">
      {mailboxes.map((mailbox) => {
        const isThisMailboxSyncing = syncState?.mailboxId === mailbox.id;
        const showSyncProgress = isThisMailboxSyncing &&
          syncState.status !== 'idle';

        // Delta sync available only if mailbox was synced at least once
        const canDeltaSync = mailbox.sync_status === 'synced';
        // Full sync available when not currently syncing
        const canFullSync = mailbox.sync_status !== 'syncing' || isThisMailboxSyncing;
        // Disable actions on other mailboxes when sync is running
        const disableActions = isSyncActive && !isThisMailboxSyncing;

        return (
          <div
            key={mailbox.id}
            className="rounded-lg border p-4"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {mailbox.email_address}
                  </h3>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: 'var(--accent-light)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {mailbox.connection_type === 'ropc' ? 'ROPC' : 'OAuth2'}
                  </span>
                </div>
                {mailbox.display_name && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {mailbox.display_name}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-4 flex-wrap">
                  <ConnectionStatus status={mailbox.sync_status} lastSyncAt={mailbox.last_sync_at} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {mailbox.email_count} wiadomosci
                  </span>
                  {/* Persistent connection test indicator */}
                  {mailbox.connection_tested_at ? (
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{
                        color: mailbox.connection_test_ok ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {mailbox.connection_test_ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {mailbox.connection_test_ok ? 'Połączono' : 'Błąd połączenia'}
                      <span style={{ color: 'var(--text-muted)' }}>
                        · {formatTestDate(mailbox.connection_tested_at)}
                      </span>
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <CircleDashed className="h-3.5 w-3.5" />
                      Nie testowano
                    </span>
                  )}
                </div>

                {/* Test connection result */}
                {testResult[mailbox.id] && (
                  <div
                    className="mt-2 rounded-md px-3 py-2 text-sm"
                    style={{
                      backgroundColor: testResult[mailbox.id].success
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: testResult[mailbox.id].success ? '#22c55e' : '#ef4444',
                      border: `1px solid ${testResult[mailbox.id].success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {testResult[mailbox.id].message}
                  </div>
                )}

                {/* Sync progress (inline under mailbox info) */}
                {showSyncProgress && (
                  <SyncProgress
                    status={syncState.status}
                    progress={syncState.progress}
                    error={syncState.error}
                    syncType={syncState.syncType}
                    onRetry={onRetrySync}
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {/* Sync button — full sync */}
                {!showSyncProgress && canFullSync && (
                  <button
                    onClick={() => onStartSync(mailbox.id)}
                    disabled={disableActions}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: 'var(--accent-primary)',
                      color: 'var(--accent-primary)',
                    }}
                    title="Pelna synchronizacja"
                  >
                    <Play className="h-4 w-4" />
                    Synchronizuj
                  </button>
                )}

                {/* Delta sync button — only after first full sync */}
                {!showSyncProgress && canDeltaSync && (
                  <button
                    onClick={() => onDeltaSync(mailbox.id)}
                    disabled={disableActions}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-secondary)',
                    }}
                    title="Pobierz nowe wiadomosci (delta sync)"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Odswiez
                  </button>
                )}

                {/* Edit */}
                <button
                  onClick={() => onEdit(mailbox)}
                  disabled={disableActions}
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                  }}
                  title="Edytuj skrzynke"
                >
                  <Pencil className="h-4 w-4" />
                  Edytuj
                </button>

                {/* Test connection */}
                <button
                  onClick={() => handleTestConnection(mailbox.id)}
                  disabled={testingId === mailbox.id || disableActions}
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                  }}
                  title="Testuj polaczenie"
                >
                  <Wifi className={`h-4 w-4 ${testingId === mailbox.id ? 'animate-pulse' : ''}`} />
                  {testingId === mailbox.id ? 'Testowanie...' : 'Testuj'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(mailbox.id, mailbox.email_address)}
                  disabled={deletingId === mailbox.id || disableActions}
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                  }}
                  title="Usun skrzynke"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingId === mailbox.id ? 'Usuwanie...' : 'Usun'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
