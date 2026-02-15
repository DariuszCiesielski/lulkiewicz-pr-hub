'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, MessageSquare, Clock, Users, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import EmailMessage from '@/components/threads/EmailMessage';
import type { EmailThread } from '@/types/email';

interface ThreadEmail {
  id: string;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: { address: string; name: string }[];
  cc_addresses: { address: string; name: string }[];
  sent_at: string | null;
  received_at: string;
  body_text: string | null;
  has_attachments: boolean;
  is_incoming: boolean;
  response_time_minutes: number | null;
  is_read: boolean;
}

interface ThreadWithMailbox extends EmailThread {
  mailbox?: { display_name: string | null; email_address: string };
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} godz.`;
  return `${(minutes / 1440).toFixed(1)} dni`;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', label: 'Oczekujący' },
  open: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Otwarty' },
  closed: { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280', label: 'Zamknięty' },
  closed_positive: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Zamknięty (pozytywnie)' },
  closed_negative: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Zamknięty (negatywnie)' },
};

export default function ThreadDetailPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const threadId = params.id as string;

  const [thread, setThread] = useState<ThreadWithMailbox | null>(null);
  const [emails, setEmails] = useState<ThreadEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin || !threadId) return;

    setIsLoading(true);
    setError(null);

    fetch(`/api/threads/${threadId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Błąd pobierania wątku');
        }
        return res.json();
      })
      .then((data) => {
        setThread(data.thread);
        setEmails(data.emails);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Błąd');
      })
      .finally(() => setIsLoading(false));
  }, [isAdmin, threadId]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push('/email-analyzer/threads')}
          className="flex items-center gap-1.5 mb-4 text-sm hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Powrót do wątków
        </button>
        <div
          className="rounded-md border p-3 text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!thread) return null;

  const status = STATUS_STYLES[thread.status] || STATUS_STYLES.open;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <button
        onClick={() => router.push('/email-analyzer/threads')}
        className="flex items-center gap-1.5 mb-4 text-sm hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Powrót do wątków
      </button>

      {/* Thread header */}
      <div
        className="rounded-lg border p-4 mb-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {thread.subject_normalized || '(brak tematu)'}
        </h1>

        {thread.mailbox && (
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Skrzynka: {thread.mailbox.display_name || thread.mailbox.email_address}
          </p>
        )}

        {/* AI Summary */}
        {thread.summary && (
          <div
            className="rounded-md border p-3 mb-3"
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.06)',
              borderColor: 'rgba(139, 92, 246, 0.2)',
            }}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#8b5cf6' }} />
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#8b5cf6' }}>
                  Podsumowanie AI
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {thread.summary}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {thread.message_count} wiadomości
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {thread.participant_addresses.length} uczestników
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Śr. czas odpowiedzi: {formatResponseTime(thread.avg_response_time_minutes)}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>

        {/* Participants */}
        <div className="mt-3">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Uczestnicy:
          </p>
          <div className="flex flex-wrap gap-1">
            {thread.participant_addresses.map((addr) => (
              <span
                key={addr}
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {addr}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Email messages */}
      <div className="space-y-3">
        {emails.map((email, index) => (
          <EmailMessage key={email.id} email={email} isFirst={index === 0} />
        ))}
      </div>
    </div>
  );
}
