'use client';

import Link from 'next/link';
import {
  BarChart3, Users, MessageSquare, AlertTriangle, Clock,
  TrendingUp, ArrowRight, Brain, ClipboardList, Plus,
  Building2, FileText,
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

  const quickActions = [
    { href: '/fb-analyzer/posts', label: 'Przeglądaj posty', icon: MessageSquare, color: '#8b5cf6' },
    { href: '/fb-analyzer/analyze', label: 'Nowa analiza AI', icon: Brain, color: '#3b82f6' },
    { href: '/fb-analyzer/reports', label: 'Generuj raport', icon: ClipboardList, color: '#22c55e' },
    { href: '/fb-analyzer/groups', label: 'Dodaj grupę', icon: Plus, color: '#f97316' },
  ];

  const devColors = ['#3b82f6', '#8b5cf6'];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center rounded-xl p-2"
          style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
        >
          <BarChart3 className="h-6 w-6" style={{ color: '#3b82f6' }} />
        </div>
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
              className="rounded-lg border p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = tile.color;
                e.currentTarget.style.boxShadow = `0 4px 16px ${tile.color}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center rounded-lg p-1.5"
                  style={{ backgroundColor: `${tile.color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color: tile.color }} />
                </div>
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
            {mockDeveloperSummaries.map((dev, i) => {
              const devColor = devColors[i % devColors.length];
              return (
                <div
                  key={dev.developer}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg p-2 flex-shrink-0"
                    style={{ backgroundColor: `${devColor}15` }}
                  >
                    <Building2 className="h-4 w-4" style={{ color: devColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {dev.developer}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {dev.relevantPosts} istotnych · {dev.groups} grupa · Top: {dev.topIssue}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor: dev.negativePosts > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: dev.negativePosts > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {dev.negativePosts} neg.
                  </span>
                </div>
              );
            })}
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
            {mockReports.map((r) => {
              const statusColor = r.status === 'completed' ? '#22c55e' : '#eab308';
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg p-2 flex-shrink-0"
                    style={{ backgroundColor: `${statusColor}15` }}
                  >
                    <FileText className="h-4 w-4" style={{ color: statusColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {r.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor: `${statusColor}15`,
                      color: statusColor,
                    }}
                  >
                    {r.status === 'completed' ? 'Gotowy' : 'Szkic'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4">
        <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
          Szybkie akcje
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.boxShadow = `0 4px 16px ${action.color}25`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  className="flex items-center justify-center rounded-lg p-1.5"
                  style={{ backgroundColor: `${action.color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color: action.color }} />
                </div>
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
