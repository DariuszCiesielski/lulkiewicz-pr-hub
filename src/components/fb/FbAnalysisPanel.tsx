'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Play, Pause, RotateCcw, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { useFbAnalysisJob } from '@/hooks/useFbAnalysisJob';

// --- Types ---

interface FbGroupOption {
  id: string;
  name: string;
  total_posts: number;
}

interface FbAnalysisJobItem {
  id: string;
  group_id: string;
  group_name: string | null;
  status: string;
  total_posts: number;
  analyzed_posts: number;
  progress: number;
  error_message: string | null;
  started_at: string | null;
  created_at: string;
}

interface FbAnalysisPanelProps {
  groups: FbGroupOption[];
  onAnalysisComplete?: () => void;
}

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
}> = {
  completed: { label: 'Zakonczona', icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  running: { label: 'W toku...', icon: Loader2, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  pending: { label: 'Oczekuje', icon: Loader2, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  paused: { label: 'Wstrzymana', icon: Pause, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  failed: { label: 'Blad', icon: XCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

// --- Component ---

export default function FbAnalysisPanel({ groups, onAnalysisComplete }: FbAnalysisPanelProps) {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [forceReanalyze, setForceReanalyze] = useState(false);
  const [recentJobs, setRecentJobs] = useState<FbAnalysisJobItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const {
    startAnalysis,
    pauseJob,
    resumeJob,
    status,
    progress,
    error,
    jobId,
    reset,
  } = useFbAnalysisJob(() => {
    onAnalysisComplete?.();
    fetchRecentJobs();
  });

  // --- Fetch recent jobs ---

  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/fb/analysis');
      if (res.ok) {
        const data = await res.json();
        setRecentJobs(data.jobs || []);
      }
    } catch {
      // Ignore fetch errors for recent jobs list
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  // --- Handlers ---

  const handleStartAnalysis = async () => {
    if (!selectedGroup) return;
    await startAnalysis(selectedGroup, forceReanalyze);
    // Refresh jobs after starting
    fetchRecentJobs();
  };

  const handlePause = async () => {
    await pauseJob();
    fetchRecentJobs();
  };

  const handleResume = (job: FbAnalysisJobItem) => {
    setSelectedGroup(job.group_id);
    resumeJob(job.id, job.analyzed_posts, job.total_posts);
  };

  const handleReset = () => {
    reset();
    fetchRecentJobs();
  };

  // --- Derived state ---

  const isRunning = status === 'processing' || status === 'starting';
  const isFinished = status === 'completed' || status === 'error';
  const selectedGroupInfo = groups.find((g) => g.id === selectedGroup);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left column: Run analysis */}
      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Uruchom analize
          </h2>
        </div>

        <div className="space-y-3">
          {/* Group select */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Wybierz grupe
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              disabled={isRunning || status === 'paused'}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">-- Wybierz grupe --</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.total_posts} postow)
                </option>
              ))}
            </select>
          </div>

          {/* Post count info */}
          {selectedGroup && selectedGroupInfo && status === 'idle' && (
            <div
              className="rounded-md border p-2 text-xs"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                color: '#3b82f6',
              }}
            >
              {selectedGroupInfo.total_posts} postow w grupie
            </div>
          )}

          {/* Force reanalyze checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceReanalyze}
              onChange={(e) => setForceReanalyze(e.target.checked)}
              disabled={isRunning || status === 'paused'}
              className="rounded border"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Analizuj ponownie juz przetworzone posty
            </span>
          </label>

          {/* Start button */}
          {status === 'idle' && (
            <button
              onClick={handleStartAnalysis}
              disabled={!selectedGroup}
              className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Play className="h-4 w-4" />
              Analizuj
            </button>
          )}

          {/* Starting state */}
          {status === 'starting' && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Rozpoczynanie analizy...
              </span>
            </div>
          )}

          {/* Progress bar */}
          {(status === 'processing' || status === 'paused') && (
            <div className="space-y-2">
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--border-primary)' }}
              >
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${status === 'processing' ? 'animate-pulse' : ''}`}
                  style={{
                    width: `${progress.percentage}%`,
                    backgroundColor: status === 'paused' ? '#f97316' : 'var(--accent-primary)',
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {progress.analyzedPosts}/{progress.totalPosts} postow ({progress.percentage}%)
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: status === 'paused' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: status === 'paused' ? '#f97316' : '#3b82f6',
                  }}
                >
                  {status === 'paused' ? 'Wstrzymana' : 'W toku...'}
                </span>
              </div>

              {/* Pause/Resume buttons */}
              <div className="flex gap-2">
                {status === 'processing' && (
                  <button
                    onClick={handlePause}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                    style={{
                      borderColor: 'var(--border-primary)',
                      color: '#f97316',
                    }}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Wstrzymaj
                  </button>
                )}
                {status === 'paused' && jobId && (
                  <button
                    onClick={() => resumeJob(jobId, progress.analyzedPosts, progress.totalPosts)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Wznow
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completed state */}
          {status === 'completed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: '#22c55e' }} />
                <span className="text-sm font-medium" style={{ color: '#22c55e' }}>
                  Analiza zakonczona
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Przeanalizowano {progress.analyzedPosts}/{progress.totalPosts} postow.
              </p>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Nowa analiza
              </button>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="space-y-2">
              <div
                className="rounded-md border p-2 text-xs"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  color: '#ef4444',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">Blad analizy</span>
                </div>
                {error}
              </div>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Sprobuj ponownie
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right column: Recent analyses */}
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

        {loadingJobs ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Ladowanie...
            </span>
          </div>
        ) : recentJobs.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Brak historii analiz. Uruchom pierwsza analize.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {recentJobs.map((job) => {
              const config = statusConfig[job.status] || statusConfig.failed;
              const Icon = config.icon;
              const jobProgress = job.total_posts > 0
                ? Math.round((job.analyzed_posts / job.total_posts) * 100)
                : 0;
              const isPaused = job.status === 'paused';
              const isJobRunning = job.status === 'running' || job.status === 'pending';

              return (
                <div
                  key={job.id}
                  className="rounded-md px-3 py-2"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium truncate mr-2" style={{ color: 'var(--text-primary)' }}>
                      {job.group_name || 'Grupa'}
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap"
                      style={{ backgroundColor: config.bg, color: config.color }}
                    >
                      <Icon className={`h-3 w-3 ${isJobRunning ? 'animate-spin' : ''}`} />
                      {config.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-1.5 rounded-full mb-1"
                    style={{ backgroundColor: 'var(--border-primary)' }}
                  >
                    <div
                      className={`h-1.5 rounded-full transition-all ${isJobRunning ? 'animate-pulse' : ''}`}
                      style={{
                        width: `${jobProgress}%`,
                        backgroundColor: config.color,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {job.analyzed_posts}/{job.total_posts} postow
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(job.started_at || job.created_at)}
                    </span>
                  </div>

                  {/* Resume button for paused jobs */}
                  {isPaused && (
                    <button
                      onClick={() => handleResume(job)}
                      disabled={isRunning}
                      className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      <Play className="h-3 w-3" />
                      Wznow
                    </button>
                  )}

                  {/* Error message */}
                  {job.status === 'failed' && job.error_message && (
                    <p className="mt-1 text-xs truncate" style={{ color: '#ef4444' }}>
                      {job.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
