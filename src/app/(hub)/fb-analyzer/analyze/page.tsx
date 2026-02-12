'use client';

import { useState } from 'react';
import {
  Brain, Play, CheckCircle2, XCircle, Loader2, FileText,
} from 'lucide-react';
import {
  mockGroups, mockAnalysisJobs, defaultFbPrompt,
} from '@/lib/mock/fb-mock-data';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig = {
  completed: { label: 'Zakończona', icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  running: { label: 'W toku...', icon: Loader2, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  failed: { label: 'Błąd', icon: XCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

export default function FbAnalyzePage() {
  const [selectedGroup, setSelectedGroup] = useState('');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Analiza AI
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Run analysis card */}
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
            Uruchom analizę
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Wybierz grupę
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">— Wybierz grupę —</option>
                {mockGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {selectedGroup && (
              <div
                className="rounded-md border p-2 text-xs"
                style={{
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  color: '#3b82f6',
                }}
              >
                {mockGroups.find((g) => g.id === selectedGroup)?.relevant_posts || 0} nowych postów do analizy
              </div>
            )}

            <button
              disabled={!selectedGroup}
              className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Play className="h-4 w-4" />
              Analizuj
            </button>
          </div>
        </div>

        {/* Recent analyses */}
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
            Ostatnie analizy
          </h2>

          <div className="space-y-2">
            {mockAnalysisJobs.map((job) => {
              const status = statusConfig[job.status];
              const Icon = status.icon;
              const progress = job.total_posts > 0
                ? Math.round((job.analyzed_posts / job.total_posts) * 100)
                : 0;

              return (
                <div
                  key={job.id}
                  className="rounded-md px-3 py-2"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {job.group_name}
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      <Icon className={`h-3 w-3 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-1.5 rounded-full mb-1"
                    style={{ backgroundColor: 'var(--border-primary)' }}
                  >
                    <div
                      className={`h-1.5 rounded-full transition-all ${job.status === 'running' ? 'animate-pulse' : ''}`}
                      style={{
                        width: `${progress}%`,
                        backgroundColor: status.color,
                      }}
                    />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {job.analyzed_posts}/{job.total_posts} postów
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(job.started_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Prompt config */}
      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Konfiguracja promptu AI
          </h2>
          <button
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <FileText className="h-3 w-3" />
            Edytuj prompt
          </button>
        </div>

        <textarea
          readOnly
          value={defaultFbPrompt}
          rows={8}
          className="w-full rounded-md border p-3 text-xs font-mono resize-none"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        />

        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Ten prompt jest używany do analizy każdego postu. Możesz go dostosować do swoich potrzeb.
        </p>
      </div>
    </div>
  );
}
