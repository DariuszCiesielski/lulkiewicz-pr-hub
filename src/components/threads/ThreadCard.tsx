'use client';

import Link from 'next/link';
import { MessageSquare, Clock, Users, ArrowRight } from 'lucide-react';
import type { EmailThread } from '@/types/email';

interface ThreadCardProps {
  thread: EmailThread;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
};

export default function ThreadCard({ thread }: ThreadCardProps) {
  const status = STATUS_STYLES[thread.status] || STATUS_STYLES.open;

  return (
    <Link
      href={`/email-analyzer/threads/${thread.id}`}
      className="block rounded-lg border p-4 transition-all hover:shadow-md"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Subject */}
          <h3
            className="font-medium truncate text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            {thread.subject_normalized || '(brak tematu)'}
          </h3>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {/* Message count */}
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {thread.message_count} wiadomości
            </span>

            {/* Participants */}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {thread.participant_addresses.length} uczestników
            </span>

            {/* Avg response time */}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatResponseTime(thread.avg_response_time_minutes)}
            </span>

            {/* Status badge */}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              {status.label}
            </span>
          </div>

          {/* Date range */}
          <div className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDate(thread.first_message_at)} — {formatDate(thread.last_message_at)}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
      </div>
    </Link>
  );
}
