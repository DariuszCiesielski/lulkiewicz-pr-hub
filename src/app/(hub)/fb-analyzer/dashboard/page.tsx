'use client';

import Link from 'next/link';
import {
  BarChart3, Users, MessageSquare, AlertTriangle, Clock,
  TrendingUp, ArrowRight, Brain, ClipboardList, Plus,
} from 'lucide-react';
import {
  mockKpi, mockDeveloperSummaries, mockReports,
} from '@/lib/mock/fb-mock-data';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function FbDashboardPage() {
  const kpiTiles = [
    { label: 'Monitorowane grupy', value: mockKpi.totalGroups, icon: Users, color: '#3b82f6' },
    { label: 'Istotne posty', value: mockKpi.relevantPosts, icon: MessageSquare, color: '#8b5cf6' },
    { label: 'Negatywne', value: mockKpi.negativePosts, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Ostatni scrape', value: mockKpi.lastScrape, icon: Clock, color: '#22c55e' },
    { label: 'Śr. relevance', value: `${mockKpi.avgRelevance}%`, icon: TrendingUp, color: '#f97316' },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Dashboard FB
        </h1>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {kpiTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="rounded-lg border p-4"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4" style={{ color: tile.color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {tile.label}
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {tile.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Developer summary */}
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Podsumowanie per deweloper
            </h2>
            <Link
              href="/fb-analyzer/groups"
              className="flex items-center gap-1 text-xs hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              Grupy <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {mockDeveloperSummaries.map((dev) => (
              <div
                key={dev.developer}
                className="flex items-center justify-between rounded-md px-3 py-2"
                style={{ backgroundColor: 'var(--bg-primary)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {dev.developer}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {dev.relevantPosts} istotnych postów · {dev.groups} grupa
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: dev.negativePosts > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: dev.negativePosts > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {dev.negativePosts} neg.
                  </span>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Top: {dev.topIssue}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent reports */}
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Ostatnie raporty
            </h2>
            <Link
              href="/fb-analyzer/reports"
              className="flex items-center gap-1 text-xs hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              Wszystkie <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {mockReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md px-3 py-2"
                style={{ backgroundColor: 'var(--bg-primary)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {r.title}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(r.created_at)}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: r.status === 'completed'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(234, 179, 8, 0.15)',
                    color: r.status === 'completed' ? '#22c55e' : '#eab308',
                  }}
                >
                  {r.status === 'completed' ? 'Gotowy' : 'Szkic'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4">
        <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
          Szybkie akcje
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/fb-analyzer/posts', label: 'Przeglądaj posty', icon: MessageSquare },
            { href: '/fb-analyzer/analyze', label: 'Nowa analiza AI', icon: Brain },
            { href: '/fb-analyzer/reports', label: 'Generuj raport', icon: ClipboardList },
            { href: '/fb-analyzer/groups', label: 'Dodaj grupę', icon: Plus },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-all hover:shadow-md"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Icon className="h-4 w-4" style={{ color: 'var(--accent-primary)' }} />
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
