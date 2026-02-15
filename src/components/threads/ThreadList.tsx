'use client';

import { useState } from 'react';
import { MessageSquare, Info, ChevronDown, ChevronUp } from 'lucide-react';
import ThreadCard from './ThreadCard';
import type { EmailThread } from '@/types/email';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ThreadListProps {
  threads: EmailThread[];
  pagination: Pagination;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export default function ThreadList({ threads, pagination, isLoading, onPageChange }: ThreadListProps) {
  const [showLegend, setShowLegend] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border p-4 animate-pulse"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div className="h-4 rounded w-3/4 mb-3" style={{ backgroundColor: 'var(--border-primary)' }} />
            <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--border-primary)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <MessageSquare className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          Brak wątków
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Uruchom budowanie wątków, aby pogrupować emaile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legenda statusow */}
      <div className="mb-3">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <Info className="h-3.5 w-3.5" />
          Legenda statusów
          {showLegend ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showLegend && (
          <div
            className="mt-2 rounded-md border p-3 text-xs space-y-1.5"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                Oczekujący
              </span>
              <span>Ostatnia wiadomość od osoby zewnętrznej — czeka na odpowiedź administracji</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                Otwarty
              </span>
              <span>Ostatnia wiadomość od administracji — sprawa w toku</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' }}>
                Zamknięty
              </span>
              <span>Wątek oznaczony jako zamknięty</span>
            </div>
          </div>
        )}
      </div>

      {threads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} />
      ))}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {pagination.total} wątków ({pagination.page}/{pagination.totalPages})
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              Poprzednia
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              Następna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
