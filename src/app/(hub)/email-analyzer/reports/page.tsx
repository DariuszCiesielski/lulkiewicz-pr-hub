'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Report {
  id: string;
  title: string;
  template_type: string;
  status: string;
  date_range_from: string | null;
  date_range_to: string | null;
  created_at: string;
}

interface AnalysisJob {
  id: string;
  mailbox_id: string;
  status: string;
  total_threads: number;
  created_at: string;
}

interface MailboxOption {
  id: string;
  display_name: string | null;
  email_address: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReportsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState('');
  const [templateType, setTemplateType] = useState<'internal' | 'client'>('internal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchReports();
      fetch('/api/mailboxes')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setMailboxes(list);
          if (list.length > 0) setSelectedMailboxId(list[0].id);
        })
        .catch(() => {});
    }
  }, [isAdmin, fetchReports]);

  const handleGenerate = async () => {
    if (!selectedMailboxId) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: selectedMailboxId,
          templateType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd generowania raportu');
      }

      const data = await res.json();
      setShowGenerate(false);
      await fetchReports();
      router.push(`/email-analyzer/reports/${data.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Raporty
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReports}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież
          </button>
          <button
            onClick={() => setShowGenerate(!showGenerate)}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Plus className="h-4 w-4" />
            Generuj raport
          </button>
        </div>
      </div>

      {/* Generate form */}
      {showGenerate && (
        <div
          className="rounded-lg border p-4 mb-4 space-y-3"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Skrzynka</label>
              <select
                value={selectedMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name || m.email_address}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Szablon</label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as 'internal' | 'client')}
                className="rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="internal">Wewnętrzny (7 sekcji)</option>
                <option value="client">Kliencki (4 sekcje)</option>
              </select>
            </div>
          </div>
          {error && (
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-md px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {isGenerating ? 'Generowanie...' : 'Generuj'}
          </button>
        </div>
      )}

      {/* Reports list */}
      {isLoading ? (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          Ładowanie raportów...
        </p>
      ) : reports.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <FileText className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            Brak raportów
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Uruchom analizę AI, a następnie wygeneruj raport.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/email-analyzer/reports/${report.id}`}
              className="block rounded-lg border p-4 transition-all hover:shadow-md"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    {report.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{formatDate(report.created_at)}</span>
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: report.template_type === 'internal'
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'rgba(34, 197, 94, 0.15)',
                        color: report.template_type === 'internal' ? '#3b82f6' : '#22c55e',
                      }}
                    >
                      {report.template_type === 'internal' ? 'Wewnętrzny' : 'Kliencki'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
