'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Mail, MessageSquare, Clock, AlertCircle,
  ArrowRight, FileText, Brain, Inbox,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface KPI {
  totalMailboxes: number;
  totalEmails: number;
  totalThreads: number;
  pendingThreads: number;
  avgResponseTimeMinutes: number | null;
}

interface MailboxSummary {
  id: string;
  display_name: string | null;
  email_address: string;
  sync_status: string;
  last_sync_at: string | null;
  total_emails: number;
}

interface RecentReport {
  id: string;
  title: string;
  template_type: string;
  status: string;
  created_at: string;
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} godz.`;
  return `${(minutes / 1440).toFixed(1)} dni`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [kpi, setKpi] = useState<KPI>({
    totalMailboxes: 0,
    totalEmails: 0,
    totalThreads: 0,
    pendingThreads: 0,
    avgResponseTimeMinutes: null,
  });
  const [mailboxes, setMailboxes] = useState<MailboxSummary[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    setIsLoading(true);
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((data) => {
        setKpi(data.kpi || {});
        setMailboxes(data.mailboxes || []);
        setRecentReports(data.recentReports || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isAdmin]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const kpiTiles = [
    {
      label: 'Skrzynki',
      value: kpi.totalMailboxes,
      icon: Inbox,
      color: '#3b82f6',
    },
    {
      label: 'Emaile',
      value: kpi.totalEmails,
      icon: Mail,
      color: '#8b5cf6',
    },
    {
      label: 'Wątki',
      value: kpi.totalThreads,
      icon: MessageSquare,
      color: '#22c55e',
    },
    {
      label: 'Oczekujące',
      value: kpi.pendingThreads,
      icon: AlertCircle,
      color: '#eab308',
    },
    {
      label: 'Śr. czas odpowiedzi',
      value: formatResponseTime(kpi.avgResponseTimeMinutes),
      icon: Clock,
      color: '#f97316',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Dashboard Analizatora
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
        {/* Mailbox summary */}
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Skrzynki
            </h2>
            <Link
              href="/email-analyzer/mailboxes"
              className="flex items-center gap-1 text-xs hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              Zarządzaj <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {mailboxes.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              Brak skrzynek. Dodaj pierwszą skrzynkę.
            </p>
          ) : (
            <div className="space-y-2">
              {mailboxes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md px-3 py-2"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {m.display_name || m.email_address}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {m.total_emails} emaili
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: m.sync_status === 'synced'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(234, 179, 8, 0.15)',
                      color: m.sync_status === 'synced' ? '#22c55e' : '#eab308',
                    }}
                  >
                    {m.sync_status === 'synced' ? 'Zsync.' : m.sync_status}
                  </span>
                </div>
              ))}
            </div>
          )}
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
              href="/email-analyzer/reports"
              className="flex items-center gap-1 text-xs hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              Wszystkie <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              Brak raportów. Uruchom analizę AI, aby wygenerować raport.
            </p>
          ) : (
            <div className="space-y-2">
              {recentReports.map((r) => (
                <Link
                  key={r.id}
                  href={`/email-analyzer/reports/${r.id}`}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:opacity-80"
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
                      backgroundColor: r.template_type === 'internal'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
                      color: r.template_type === 'internal' ? '#3b82f6' : '#22c55e',
                    }}
                  >
                    {r.template_type === 'internal' ? 'Wewn.' : 'Klient.'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4">
        <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
          Szybkie akcje
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/email-analyzer/threads', label: 'Przeglądaj wątki', icon: MessageSquare },
            { href: '/email-analyzer/analyze', label: 'Nowa analiza AI', icon: Brain },
            { href: '/email-analyzer/reports', label: 'Generuj raport', icon: FileText },
            { href: '/email-analyzer/mailboxes', label: 'Dodaj skrzynkę', icon: Inbox },
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
