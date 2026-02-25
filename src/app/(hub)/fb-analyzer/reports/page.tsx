'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, RefreshCw, Loader2, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface FbReport {
  id: string;
  title: string;
  status: string;
  group_ids: string[] | null;
  date_from: string | null;
  date_to: string | null;
  summary_data: Record<string, unknown> | null;
  created_at: string;
}

interface FbGroup {
  id: string;
  name: string;
  developer: string | null;
  status: string;
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

export default function FbReportsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<FbReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [developers, setDevelopers] = useState<string[]>([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [excludedGroupIds, setExcludedGroupIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allGroupsRef = useRef<FbGroup[]>([]);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/fb-reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch reports + groups on mount
  useEffect(() => {
    if (isAdmin) {
      fetchReports();
      fetch('/api/fb-groups')
        .then((res) => res.json())
        .then((data) => {
          const list: FbGroup[] = Array.isArray(data) ? data : [];
          allGroupsRef.current = list;
          const uniqueDevs = [
            ...new Set(
              list
                .map((g) => g.developer)
                .filter((d): d is string => Boolean(d))
            ),
          ].sort();
          setDevelopers(uniqueDevs);
        })
        .catch(() => {});
    }
  }, [isAdmin, fetchReports]);

  // When developer changes, update groups list
  useEffect(() => {
    if (!selectedDeveloper) {
      setGroups([]);
      return;
    }
    const devGroups = allGroupsRef.current
      .filter((g) => g.developer === selectedDeveloper && g.status === 'active')
      .map((g) => ({ id: g.id, name: g.name }));
    setGroups(devGroups);
    setExcludedGroupIds(new Set());
  }, [selectedDeveloper]);

  const toggleGroupExclusion = (groupId: string) => {
    setExcludedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const selectedCount = groups.length - excludedGroupIds.size;

  const handleDelete = async (e: React.MouseEvent, reportId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Czy na pewno chcesz usunąć ten raport?')) return;

    try {
      const res = await fetch(`/api/fb-reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Błąd usuwania');
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      setError('Błąd usuwania raportu');
    }
  };

  const handleGenerate = async () => {
    if (!selectedDeveloper || !dateFrom || !dateTo) return;
    setIsGenerating(true);
    setError(null);
    setGeneratingMessage('Tworzenie raportu...');

    try {
      // 1. Create report
      const res = await fetch('/api/fb-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developer: selectedDeveloper,
          dateFrom,
          dateTo,
          excludeGroupIds: [...excludedGroupIds],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Błąd generowania raportu');
      }

      const data = await res.json();
      const reportId = data.reportId;
      const totalSections = data.totalSections || 0;
      let hasMore = true;

      // 2. Polling loop
      while (hasMore) {
        const processRes = await fetch('/api/fb-reports/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId }),
        });

        if (!processRes.ok) {
          const errData = await processRes.json().catch(() => ({}));
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

      router.push(`/fb-analyzer/reports/${reportId}`);
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
          <ClipboardList className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Raporty FB
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
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Deweloper
              </label>
              <select
                value={selectedDeveloper}
                onChange={(e) => setSelectedDeveloper(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">— Wybierz dewelopera —</option>
                {developers.map((dev) => (
                  <option key={dev} value={dev}>
                    {dev}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Od
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Do
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Groups checklist */}
          {selectedDeveloper && groups.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Grupy ({selectedCount}/{groups.length} zaznaczonych):
              </p>
              <div
                className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={!excludedGroupIds.has(group.id)}
                      onChange={() => toggleGroupExclusion(group.id)}
                      className="rounded"
                    />
                    {group.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedDeveloper && groups.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Brak aktywnych grup dla wybranego dewelopera.
            </p>
          )}

          {error && (
            <p className="text-sm" style={{ color: '#ef4444' }}>
              {error}
            </p>
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
            disabled={isGenerating || !selectedDeveloper || !dateFrom || !dateTo}
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
          <ClipboardList className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            Brak raportów
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Uruchom analizę AI postów, a następnie wygeneruj raport.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const developer = (report.summary_data?.developer as string) || null;
            const groupCount = report.group_ids?.length || 0;

            return (
              <Link
                key={report.id}
                href={`/fb-analyzer/reports/${report.id}`}
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
                    <div
                      className="flex items-center gap-3 mt-1 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{formatDate(report.created_at)}</span>
                      {developer && (
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                          }}
                        >
                          {developer}
                        </span>
                      )}
                      {groupCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                          }}
                        >
                          <Users className="h-3 w-3" />
                          {groupCount} grup
                        </span>
                      )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
