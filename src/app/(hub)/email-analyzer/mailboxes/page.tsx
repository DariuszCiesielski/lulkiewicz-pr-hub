'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MailboxList from '@/components/email/MailboxList';
import MailboxForm from '@/components/email/MailboxForm';
import type { MailboxEditData } from '@/components/email/MailboxForm';
import type { MailboxListItem } from '@/components/email/MailboxList';
import type { MailboxFormData } from '@/types/email';
import { useSyncJob } from '@/hooks/useSyncJob';

export default function MailboxesPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mailboxes, setMailboxes] = useState<MailboxListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<MailboxEditData | null>(null);

  // Sync state
  const [activeSyncMailboxId, setActiveSyncMailboxId] = useState<string | null>(null);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  const fetchMailboxes = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mailboxes');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Nie udalo sie pobrac skrzynek');
      }
      const data = await res.json();
      setMailboxes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blad');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // useSyncJob with onComplete callback to refresh mailbox list
  const syncJob = useSyncJob(fetchMailboxes);

  useEffect(() => {
    if (isAdmin) {
      fetchMailboxes();
    }
  }, [isAdmin, fetchMailboxes]);

  const handleCreateMailbox = async (formData: MailboxFormData) => {
    const res = await fetch('/api/mailboxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Nie udalo sie dodac skrzynki');
    }

    await fetchMailboxes();
  };

  const handleTestConnection = async (_id: string) => {
    // Test result is handled by MailboxList component directly
    // Silently refresh the list so we don't unmount MailboxList and lose test result
    await fetchMailboxes(true);
  };

  const handleEdit = (mailbox: MailboxListItem) => {
    setEditingMailbox({
      id: mailbox.id,
      email_address: mailbox.email_address,
      display_name: mailbox.display_name,
      connection_type: mailbox.connection_type as 'ropc' | 'client_credentials',
      tenant_id: '',
      client_id: '',
    });
  };

  const handleUpdateMailbox = async (formData: MailboxFormData) => {
    if (!editingMailbox) return;

    const res = await fetch(`/api/mailboxes/${editingMailbox.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Nie udało się zaktualizować skrzynki');
    }

    setEditingMailbox(null);
    await fetchMailboxes(true);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/mailboxes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Nie udalo sie usunac skrzynki');
    }
    await fetchMailboxes();
  };

  const handleStartSync = useCallback((mailboxId: string) => {
    setActiveSyncMailboxId(mailboxId);
    setSyncNotification(null);
    syncJob.startSync(mailboxId, 'full');
  }, [syncJob]);

  const handleDeltaSync = useCallback((mailboxId: string) => {
    setActiveSyncMailboxId(mailboxId);
    setSyncNotification(null);
    syncJob.startSync(mailboxId, 'delta');
  }, [syncJob]);

  const handleRetrySync = useCallback(() => {
    if (activeSyncMailboxId && syncJob.syncType) {
      syncJob.startSync(activeSyncMailboxId, syncJob.syncType);
    }
  }, [activeSyncMailboxId, syncJob]);

  // Show notification and auto-clear sync state when completed
  useEffect(() => {
    if (syncJob.status === 'completed') {
      // Show notification with actual fetched count
      setSyncNotification(
        `Synchronizacja zakonczona: ${syncJob.progress.fetched} wiadomosci`
      );
      // Auto-clear notification after 5s
      const notifTimer = setTimeout(() => setSyncNotification(null), 5000);
      // Auto-clear active sync after a delay so user sees the completed state
      const resetTimer = setTimeout(() => {
        setActiveSyncMailboxId(null);
        syncJob.reset();
      }, 3000);
      return () => {
        clearTimeout(notifTimer);
        clearTimeout(resetTimer);
      };
    }
  }, [syncJob.status, syncJob.progress.fetched, syncJob]);

  // Build sync state object to pass to MailboxList
  const syncState = activeSyncMailboxId
    ? {
        mailboxId: activeSyncMailboxId,
        status: syncJob.status,
        progress: syncJob.progress,
        error: syncJob.error,
        syncType: syncJob.syncType,
      }
    : null;

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ladowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Zarzadzanie skrzynkami
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchMailboxes()}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Odswiez
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Plus className="h-4 w-4" />
            Dodaj skrzynke
          </button>
        </div>
      </div>

      {/* Sync notification */}
      {syncNotification && (
        <div
          className="mb-4 rounded-md border p-3 text-sm"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
          }}
        >
          {syncNotification}
        </div>
      )}

      {error && (
        <div
          className="mb-4 rounded-md border p-3 text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          Ladowanie skrzynek...
        </p>
      ) : (
        <MailboxList
          mailboxes={mailboxes}
          onTestConnection={handleTestConnection}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onStartSync={handleStartSync}
          onDeltaSync={handleDeltaSync}
          onRetrySync={handleRetrySync}
          syncState={syncState}
        />
      )}

      {showForm && (
        <MailboxForm
          onSubmit={handleCreateMailbox}
          onClose={() => setShowForm(false)}
        />
      )}

      {editingMailbox && (
        <MailboxForm
          onSubmit={handleUpdateMailbox}
          onClose={() => setEditingMailbox(null)}
          initialData={editingMailbox}
        />
      )}
    </div>
  );
}
