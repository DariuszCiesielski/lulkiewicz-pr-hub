'use client';

import { MessageSquare } from 'lucide-react';
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
