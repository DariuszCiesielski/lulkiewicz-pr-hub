'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MailboxList from '@/components/email/MailboxList';
import MailboxForm from '@/components/email/MailboxForm';
import type { MailboxListItem } from '@/components/email/MailboxList';
import type { MailboxFormData } from '@/types/email';

export default function MailboxesPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mailboxes, setMailboxes] = useState<MailboxListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  const fetchMailboxes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mailboxes');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Nie udało się pobrać skrzynek');
      }
      const data = await res.json();
      setMailboxes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      throw new Error(data.error || 'Nie udało się dodać skrzynki');
    }

    await fetchMailboxes();
  };

  const handleTestConnection = async (_id: string) => {
    // Test result is handled by MailboxList component directly
    // Just refresh the list afterwards
    await fetchMailboxes();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/mailboxes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Nie udało się usunąć skrzynki');
    }
    await fetchMailboxes();
  };

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
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
            Zarządzanie skrzynkami
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMailboxes}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Plus className="h-4 w-4" />
            Dodaj skrzynkę
          </button>
        </div>
      </div>

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
          Ładowanie skrzynek...
        </p>
      ) : (
        <MailboxList
          mailboxes={mailboxes}
          onTestConnection={handleTestConnection}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <MailboxForm
          onSubmit={handleCreateMailbox}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
