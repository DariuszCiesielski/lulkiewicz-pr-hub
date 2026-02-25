'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3, Users, MessageSquare, AlertTriangle, Clock,
  TrendingUp, ArrowRight, Brain, ClipboardList, Plus,
  Building2, FileText, Loader2, Hash,
} from 'lucide-react';

interface DashboardData {
  kpi: {
    totalGroups: number;
    totalPosts: number;
    relevantPosts: number;
    negativePosts: number;
    lastScrape: string | null;
    avgRelevance: number;
  };
  developerSummaries: {
    developer: string;
    groups: number;
    relevantPosts: number;
    negativePosts: number;
  }[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'przed chwilą';
  if (min < 60) return `${min} min temu`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} godz. temu`;
  const days = Math.floor(hrs / 24);
  return `${days} dn. temu`;
}

export default function FbDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/fb-dashboard');
      if (!res.ok) throw new Error(`Błąd ${res.status}: ${res.statusText}`);
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const quickActions = [
    { href: '/fb-analyzer/posts', label: 'Przeglądaj posty', icon: MessageSquare, color: '#8b5cf6' },
    { href: '/fb-analyzer/analyze', label: 'Nowa analiza AI', icon: Brain, color: '#3b82f6' },
    { href: '/fb-analyzer/reports', label: 'Generuj raport', icon: ClipboardList, color: '#22c55e' },
    { href: '/fb-analyzer/groups', label: 'Dodaj grupę', icon: Plus, color: '#f97316' },
  ];

  const devColors = ['#3b82f6', '#8b5cf6'];

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl flex items-center justify-center py-24">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div
          className="rounded-lg border p-6 text-center"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" style={{ color: '#ef4444' }} />
          <p className="text-sm font-medium mb-1" style={{ color: '#ef4444' }}>
            Błąd ładowania dashboardu
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            {error}
          </p>
          <button
            onClick={fetchDashboard}
            className="rounded-md px-4 py-2 text-sm text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  const kpi = data!.kpi;
  const developerSummaries = data!.developerSummaries;

  const kpiTiles = [
    { label: 'Monitorowane grupy', value: kpi.totalGroups, icon: Users, color: '#3b82f6' },
    { label: 'Wszystkie posty', value: kpi.totalPosts, icon: Hash, color: '#6366f1' },
    { label: 'Istotne posty', value: kpi.relevantPosts, icon: MessageSquare, color: '#8b5cf6' },
    { label: 'Negatywne', value: kpi.negativePosts, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Ostatni scrape', value: kpi.lastScrape ? relativeTime(kpi.lastScrape) : '—', icon: Clock, color: '#22c55e' },
    { label: 'Śr. relevance', value: `${kpi.avgRelevance}%`, icon: TrendingUp, color: '#f97316' },
  ];

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
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
            {developerSummaries.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                Brak danych o deweloperach
              </p>
            ) : (
              developerSummaries.map((dev, i) => {
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
                        {dev.relevantPosts} istotnych · {dev.groups} {dev.groups === 1 ? 'grupa' : 'grupy'}
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
              })
            )}
          </div>
        </div>

        {/* Recent reports — empty state */}
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
          <div className="text-center py-8">
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Brak raportów. Generowanie raportów będzie dostępne wkrótce.
            </p>
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
