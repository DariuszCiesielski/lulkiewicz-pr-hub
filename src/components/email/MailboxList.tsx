'use client';

import { useState } from 'react';
import { Wifi, RefreshCw, Trash2, Mail } from 'lucide-react';
import ConnectionStatus from './ConnectionStatus';
import type { SyncStatus } from '@/types/email';

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
}

interface MailboxListProps {
  mailboxes: MailboxListItem[];
  onTestConnection: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function MailboxList({ mailboxes, onTestConnection, onDelete }: MailboxListProps) {
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
          Dodaj pierwszą skrzynkę aby rozpocząć.
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
      setTestResult((prev) => ({ ...prev, [id]: { success: false, message: 'Błąd połączenia z serwerem' } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, emailAddress: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć skrzynkę ${emailAddress}? Ta operacja jest nieodwracalna.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {mailboxes.map((mailbox) => (
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
                  {mailbox.email_count} wiadomości
                </span>
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
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleTestConnection(mailbox.id)}
                disabled={testingId === mailbox.id}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
                title="Testuj połączenie"
              >
                <Wifi className={`h-4 w-4 ${testingId === mailbox.id ? 'animate-pulse' : ''}`} />
                {testingId === mailbox.id ? 'Testowanie...' : 'Testuj'}
              </button>
              <button
                onClick={() => handleDelete(mailbox.id, mailbox.email_address)}
                disabled={deletingId === mailbox.id}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80 disabled:opacity-50"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
                title="Usuń skrzynkę"
              >
                <Trash2 className="h-4 w-4" />
                {deletingId === mailbox.id ? 'Usuwanie...' : 'Usuń'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
