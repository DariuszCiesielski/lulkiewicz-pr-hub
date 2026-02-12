'use client';

import { useState } from 'react';
import {
  Users, Plus, Play, Brain, Pencil, Trash2, ExternalLink,
  CheckCircle2, PauseCircle,
} from 'lucide-react';
import { mockGroups } from '@/lib/mock/fb-mock-data';

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nigdy';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  return `${Math.floor(hours / 24)} dni temu`;
}

export default function FbGroupsPage() {
  const [groups] = useState(mockGroups);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Grupy FB
          </h1>
        </div>
        <button
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Plus className="h-4 w-4" />
          Dodaj grupę
        </button>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-lg border p-4"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {group.name}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1"
                  style={{
                    backgroundColor: group.status === 'active'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(234, 179, 8, 0.15)',
                    color: group.status === 'active' ? '#22c55e' : '#eab308',
                  }}
                >
                  {group.status === 'active' ? (
                    <><CheckCircle2 className="h-3 w-3" /> Aktywna</>
                  ) : (
                    <><PauseCircle className="h-3 w-3" /> Wstrzymana</>
                  )}
                </span>
              </div>
              <a
                href={group.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs hover:opacity-80"
                style={{ color: 'var(--accent-primary)' }}
              >
                <ExternalLink className="h-3 w-3" />
                Facebook
              </a>
            </div>

            {/* Meta */}
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Deweloper: <span style={{ color: 'var(--text-secondary)' }}>{group.developer}</span>
              {' · '}
              {group.total_posts} postów ({group.relevant_posts} istotnych)
              {' · '}
              Ostatni scrape: {timeAgo(group.last_scrape_at)}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Play className="h-3 w-3" />
                Scrapuj
              </button>
              <button
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Brain className="h-3 w-3" />
                Analizuj
              </button>
              <button
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Pencil className="h-3 w-3" />
                Edytuj
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
