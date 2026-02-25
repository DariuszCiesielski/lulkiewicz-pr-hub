'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Loader2, FileText, AlertTriangle,
} from 'lucide-react';
import FbAnalysisPanel from '@/components/fb/FbAnalysisPanel';
import { FB_DEFAULT_PROMPT } from '@/lib/ai/fb-default-prompt';

interface FbGroup {
  id: string;
  name: string;
  total_posts: number;
  status: string;
}

interface PromptTemplate {
  section_key: string;
  system_prompt: string | null;
}

export default function FbAnalyzePage() {
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [promptText, setPromptText] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);

  // --- Fetch groups ---

  const fetchGroups = useCallback(async () => {
    try {
      setGroupsError(null);
      const res = await fetch('/api/fb-groups');
      if (!res.ok) throw new Error('Błąd ładowania grup');
      const data: FbGroup[] = await res.json();
      // Only active groups (API already filters deleted_at IS NULL)
      setGroups(data.filter((g) => g.status === 'active'));
    } catch (err) {
      setGroupsError(err instanceof Error ? err.message : 'Błąd ładowania grup');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  // --- Fetch prompt ---

  const fetchPrompt = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts');
      if (!res.ok) throw new Error('Błąd ładowania promptów');
      const data: PromptTemplate[] = await res.json();
      const fbPrompt = data.find((p) => p.section_key === '_fb_post_analysis');
      setPromptText(fbPrompt?.system_prompt || null);
    } catch {
      // Silent fail — prompt display is secondary
      setPromptText(null);
    } finally {
      setLoadingPrompt(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchPrompt();
  }, [fetchGroups, fetchPrompt]);

  // --- Loading state ---

  if (loadingGroups) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Analiza AI
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Ładowanie grup...
          </span>
        </div>
      </div>
    );
  }

  // --- Error state ---

  if (groupsError) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Analiza AI
          </h1>
        </div>
        <div
          className="rounded-md border p-4 text-sm"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            color: '#ef4444',
          }}
        >
          {groupsError}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Analiza AI
        </h1>
      </div>

      {/* Empty groups warning */}
      {groups.length === 0 ? (
        <div
          className="rounded-md border p-4 flex items-start gap-3"
          style={{
            borderColor: 'rgba(234, 179, 8, 0.3)',
            backgroundColor: 'rgba(234, 179, 8, 0.05)',
          }}
        >
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#eab308' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#eab308' }}>
              Brak aktywnych grup
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Dodaj grupy w zakładce Grupy, aby rozpocząć analizę AI postów.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Analysis panel with real groups */}
          <div className="mb-4">
            <FbAnalysisPanel
              groups={groups.map((g) => ({
                id: g.id,
                name: g.name,
                total_posts: g.total_posts,
              }))}
              onAnalysisComplete={fetchGroups}
            />
          </div>
        </>
      )}

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
          <a
            href="/email-analyzer/prompts"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <FileText className="h-3 w-3" />
            Edytuj prompt
          </a>
        </div>

        {loadingPrompt ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <textarea
            readOnly
            value={promptText || FB_DEFAULT_PROMPT}
            rows={8}
            className="w-full rounded-md border p-3 text-xs font-mono resize-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
            }}
          />
        )}

        {!loadingPrompt && !promptText && (
          <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>
            (prompt domyślny — edytuj na stronie Prompty, aby ustawić własny)
          </p>
        )}

        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Ten prompt jest używany do analizy każdego postu. Edytuj na stronie Prompty.
        </p>
      </div>
    </div>
  );
}
