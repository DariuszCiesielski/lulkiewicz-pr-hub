'use client';

import {
  ClipboardList, Plus, FileText, Download, Trash2, Eye,
} from 'lucide-react';
import { mockReports } from '@/lib/mock/fb-mock-data';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function FbReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Raporty FB
          </h1>
        </div>
        <button
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Plus className="h-4 w-4" />
          Generuj raport
        </button>
      </div>

      <div className="space-y-3">
        {mockReports.map((report) => (
          <div
            key={report.id}
            className="rounded-lg border p-4"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {report.title}
                </p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: report.status === 'completed'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(234, 179, 8, 0.15)',
                  color: report.status === 'completed' ? '#22c55e' : '#eab308',
                }}
              >
                {report.status === 'completed' ? 'Gotowy' : 'Szkic'}
              </span>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatDate(report.created_at)}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Zakres: {formatDateShort(report.date_from)} — {formatDateShort(report.date_to)}
              </span>
            </div>

            {/* Groups badges */}
            <div className="flex flex-wrap gap-1 mb-3">
              {report.groups.map((group) => (
                <span
                  key={group}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    color: '#8b5cf6',
                  }}
                >
                  {group}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Eye className="h-3 w-3" />
                Otwórz
              </button>
              <button
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Download className="h-3 w-3" />
                Eksport DOCX
              </button>
              <button
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
              >
                <Trash2 className="h-3 w-3" />
                Usuń
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
