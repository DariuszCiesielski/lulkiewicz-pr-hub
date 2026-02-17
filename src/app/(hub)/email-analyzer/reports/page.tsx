'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, RefreshCw, Loader2, Trash2, AlertTriangle } from 'lucide-react';
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

interface MailboxOption {
  id: string;
  display_name: string | null;
  email_address: string;
}

interface CoverageInfo {
  hasAnalysis: boolean;
  message?: string;
  analysisDate?: string;
  internal?: { total: number; covered: number; missing: { key: string; title: string }[] };
  client?: { total: number; covered: number; missing: { key: string; title: string }[] };
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
  const [detailLevel, setDetailLevel] = useState<'synthetic' | 'detailed'>('synthetic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageInfo | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

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

  // Fetch reports + mailboxes + restore persisted selection
  useEffect(() => {
    if (isAdmin) {
      fetchReports();
      fetch('/api/mailboxes')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setMailboxes(list);
          if (list.length > 0) {
            const saved = localStorage.getItem('ea-selected-mailbox');
            const validSaved = saved && list.some((m: MailboxOption) => m.id === saved);
            setSelectedMailboxId(validSaved ? saved : list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, fetchReports]);

  // Persist mailbox selection
  useEffect(() => {
    if (selectedMailboxId) {
      localStorage.setItem('ea-selected-mailbox', selectedMailboxId);
    }
  }, [selectedMailboxId]);

  // Check coverage when mailbox or form visibility changes
  useEffect(() => {
    if (!showGenerate || !selectedMailboxId) {
      setCoverage(null);
      return;
    }
    setCoverageLoading(true);
    fetch(`/api/analysis/coverage?mailboxId=${selectedMailboxId}`)
      .then((res) => res.json())
      .then((data) => setCoverage(data))
      .catch(() => setCoverage(null))
      .finally(() => setCoverageLoading(false));
  }, [showGenerate, selectedMailboxId]);

  const handleDelete = async (e: React.MouseEvent, reportId: string) => {
    e.preventDefault(); // Don't navigate to report
    e.stopPropagation();
    if (!confirm('Czy na pewno chcesz usunąć ten raport?')) return;

    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Błąd usuwania');
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      setError('Błąd usuwania raportu');
    }
  };

  const handleGenerate = async () => {
    if (!selectedMailboxId) return;
    setIsGenerating(true);
    setError(null);
    setGeneratingMessage(
      detailLevel === 'synthetic'
        ? 'Tworzenie raportu...'
        : 'Generowanie raportu szczegółowego...'
    );

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: selectedMailboxId,
          templateType,
          detailLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd generowania raportu');
      }

      const data = await res.json();

      // Detailed reports are ready immediately
      if (data.status === 'draft') {
        router.push(`/email-analyzer/reports/${data.reportId}`);
        return;
      }

      // Synthetic reports: poll /api/reports/process until all sections are done
      const reportId = data.reportId;
      const totalSections = data.totalSections || 0;
      let hasMore = true;

      while (hasMore) {
        const processRes = await fetch('/api/reports/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId }),
        });

        if (!processRes.ok) {
          const errData = await processRes.json();
          throw new Error(errData.error || 'Błąd syntezy raportu');
        }

        const processData = await processRes.json();

        if (processData.status === 'failed') {
          throw new Error(processData.error || 'Synteza raportu nie powiodła się');
        }

        setGeneratingMessage(
          `AI syntetyzuje sekcje... ${processData.processedSections}/${totalSections}`
        );

        hasMore = processData.hasMore;
      }

      router.push(`/email-analyzer/reports/${reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
      setIsGenerating(false);
      setGeneratingMessage('');
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
          <div className="grid grid-cols-3 gap-3">
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
                <option value="internal">Wewnętrzny ({coverage?.internal?.total ?? 13} sekcji)</option>
                <option value="client">Kliencki ({coverage?.client?.total ?? 12} sekcji)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Poziom szczegółowości</label>
              <select
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value as 'synthetic' | 'detailed')}
                className="rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="synthetic">Syntetyczny (~5-15 stron)</option>
                <option value="detailed">Szczegółowy (wątek po wątku)</option>
              </select>
            </div>
          </div>
          {/* Coverage warning */}
          {coverageLoading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Loader2 className="h-3 w-3 animate-spin" />
              Sprawdzanie pokrycia sekcji...
            </div>
          )}
          {coverage && !coverage.hasAnalysis && (
            <div
              className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--text-secondary)',
              }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#ef4444' }} />
              <span>{coverage.message}</span>
            </div>
          )}
          {coverage?.hasAnalysis && (() => {
            const info = templateType === 'client' ? coverage.client : coverage.internal;
            if (!info || info.missing.length === 0) return null;
            return (
              <div
                className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: 'rgba(234, 179, 8, 0.3)',
                  backgroundColor: 'rgba(234, 179, 8, 0.08)',
                  color: 'var(--text-secondary)',
                }}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#eab308' }} />
                <div>
                  <p className="font-medium">
                    Brak danych analizy dla {info.missing.length} z {info.total} sekcji
                  </p>
                  <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    Ponownie uruchom analiz&#x0119; AI, aby uwzgl&#x0119;dni&#x0107; nowe sekcje. Brakuj&#x0105;ce sekcje:
                  </p>
                  <ul className="mt-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
                    {info.missing.map((s) => (
                      <li key={s.key}>{s.title}</li>
                    ))}
                  </ul>
                  <Link
                    href="/email-analyzer/analyze"
                    className="mt-2 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    Przejd&#x017A; do Analizy AI
                  </Link>
                </div>
              </div>
            );
          })()}
          {error && (
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          )}
          {isGenerating && generatingMessage && (
            <div
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                color: 'var(--text-secondary)',
              }}
            >
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#3b82f6' }} />
              {generatingMessage}
            </div>
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
              className="group block rounded-lg border p-4 transition-all hover:shadow-md"
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
                <button
                  onClick={(e) => handleDelete(e, report.id)}
                  className="p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                  style={{ color: '#ef4444' }}
                  title="Usuń raport"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
