'use client';

import { Mail, ArrowDownLeft, ArrowUpRight, Clock, Paperclip } from 'lucide-react';

interface EmailMessageProps {
  email: {
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
  };
  isFirst: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} godz.`;
  return `${(minutes / 1440).toFixed(1)} dni`;
}

export default function EmailMessage({ email, isFirst }: EmailMessageProps) {
  const DirectionIcon = email.is_incoming ? ArrowDownLeft : ArrowUpRight;
  const directionColor = email.is_incoming ? '#3b82f6' : '#22c55e';

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 px-4 py-3"
        style={{
          borderBottom: '1px solid var(--border-primary)',
          backgroundColor: email.is_incoming
            ? 'rgba(59, 130, 246, 0.05)'
            : 'rgba(34, 197, 94, 0.05)',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <DirectionIcon className="h-4 w-4 shrink-0" style={{ color: directionColor }} />
            <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {email.from_name || email.from_address || 'Nieznany nadawca'}
            </span>
            {email.from_name && email.from_address && (
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                &lt;{email.from_address}&gt;
              </span>
            )}
          </div>

          {/* To/CC */}
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Do: {email.to_addresses.map((a) => a.name || a.address).join(', ')}</span>
            {email.cc_addresses.length > 0 && (
              <span className="ml-2">
                CC: {email.cc_addresses.map((a) => a.name || a.address).join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDateTime(email.sent_at || email.received_at)}
          </span>

          {/* Response time badge */}
          {!isFirst && email.response_time_minutes !== null && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: email.response_time_minutes < 240
                  ? 'rgba(34, 197, 94, 0.15)'
                  : email.response_time_minutes < 2880
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color: email.response_time_minutes < 240
                  ? '#22c55e'
                  : email.response_time_minutes < 2880
                    ? '#eab308'
                    : '#ef4444',
              }}
            >
              <Clock className="h-3 w-3" />
              {formatResponseTime(email.response_time_minutes)}
            </span>
          )}

          {email.has_attachments && (
            <Paperclip className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <pre
          className="whitespace-pre-wrap text-sm font-sans leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {email.body_text || '(brak treści)'}
        </pre>
      </div>
    </div>
  );
}
