'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import type { ThreadStatus } from '@/types/email';

export interface ThreadFilterValues {
  search: string;
  status: ThreadStatus | '';
  from: string;
  to: string;
}

interface ThreadFiltersProps {
  filters: ThreadFilterValues;
  onChange: (filters: ThreadFilterValues) => void;
}

const STATUS_OPTIONS: { value: ThreadStatus | ''; label: string }[] = [
  { value: '', label: 'Wszystkie statusy' },
  { value: 'pending', label: 'Oczekujący' },
  { value: 'open', label: 'Otwarty' },
  { value: 'closed', label: 'Zamknięty' },
];

export default function ThreadFilters({ filters, onChange }: ThreadFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = filters.status !== '' || filters.from !== '' || filters.to !== '';

  const clearFilters = () => {
    onChange({ search: '', status: '', from: '', to: '' });
  };

  return (
    <div className="space-y-3">
      {/* Search + expand toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Szukaj w tematach wątków..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80"
          style={{
            borderColor: hasActiveFilters ? 'var(--accent-primary)' : 'var(--border-primary)',
            color: hasActiveFilters ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}
        >
          <Filter className="h-4 w-4" />
          Filtry
          {hasActiveFilters && (
            <span
              className="ml-1 rounded-full px-1.5 py-0.5 text-xs"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
            >
              !
            </span>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div
          className="rounded-md border p-3 flex flex-wrap gap-3 items-end"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onChange({ ...filters, status: e.target.value as ThreadStatus | '' })}
              className="rounded-md border px-2 py-1.5 text-sm outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Od
            </label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
              className="rounded-md border px-2 py-1.5 text-sm outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Do
            </label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
              className="rounded-md border px-2 py-1.5 text-sm outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="h-3 w-3" />
              Wyczyść
            </button>
          )}
        </div>
      )}
    </div>
  );
}
