'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Save,
  RotateCcw,
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PROMPTS } from '@/lib/ai/default-prompts';

interface PromptTemplate {
  id: string | null;
  section_key: string;
  title: string;
  system_prompt: string;
  user_prompt_template: string;
  tier: string;
  section_order: number;
  in_internal_report?: boolean;
  in_client_report?: boolean;
}

export default function PromptsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editedPrompt, setEditedPrompt] = useState<PromptTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  const fetchPrompts = useCallback(async () => {
    const res = await fetch('/api/prompts');
    const data = await res.json();
    const fetched = data.prompts || [];
    setPrompts(fetched);
    return fetched;
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchPrompts().then((fetched: PromptTemplate[]) => {
        if (fetched.length > 0) {
          setSelectedIndex(0);
          setEditedPrompt(fetched[0]);
        }
      });
    }
  }, [isAdmin, fetchPrompts]);

  const handleSelectPrompt = (index: number) => {
    setSelectedIndex(index);
    setEditedPrompt(prompts[index]);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editedPrompt) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: editedPrompt.section_key,
          title: editedPrompt.title,
          system_prompt: editedPrompt.system_prompt,
          user_prompt_template: editedPrompt.user_prompt_template,
          section_order: editedPrompt.section_order,
          in_internal_report: editedPrompt.in_internal_report ?? true,
          in_client_report: editedPrompt.in_client_report ?? false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu');
      }

      setMessage({ type: 'success', text: 'Prompt zapisany.' });
      const fetched = await fetchPrompts();
      // Keep selection on same section_key
      const newIdx = fetched.findIndex(
        (p: PromptTemplate) => p.section_key === editedPrompt.section_key
      );
      if (newIdx >= 0) {
        setSelectedIndex(newIdx);
        setEditedPrompt(fetched[newIdx]);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!editedPrompt) return;

    // Find default prompt for this section_key
    const defaultPrompt = DEFAULT_PROMPTS.find(
      (d) => d.section_key === editedPrompt.section_key
    );

    if (!defaultPrompt) {
      setMessage({ type: 'error', text: 'Brak domyślnego promptu dla tej sekcji.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Save default values to DB (overwriting current)
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: defaultPrompt.section_key,
          title: defaultPrompt.title,
          system_prompt: defaultPrompt.system_prompt,
          user_prompt_template: defaultPrompt.user_prompt_template,
          section_order: defaultPrompt.section_order,
          in_internal_report: editedPrompt.in_internal_report ?? true,
          in_client_report: editedPrompt.in_client_report ?? false,
        }),
      });

      if (!res.ok) throw new Error('Błąd resetowania');

      setMessage({ type: 'success', text: 'Przywrócono domyślną treść promptu.' });
      const fetched = await fetchPrompts();
      const newIdx = fetched.findIndex(
        (p: PromptTemplate) => p.section_key === defaultPrompt.section_key
      );
      if (newIdx >= 0) {
        setSelectedIndex(newIdx);
        setEditedPrompt(fetched[newIdx]);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sectionKey: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę sekcję?')) return;

    try {
      const res = await fetch('/api/prompts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_key: sectionKey }),
      });

      if (!res.ok) throw new Error('Błąd usuwania');

      setMessage({ type: 'success', text: 'Sekcja usunięta.' });
      const fetched = await fetchPrompts();
      if (fetched.length > 0) {
        const newIdx = Math.min(selectedIndex, fetched.length - 1);
        setSelectedIndex(newIdx);
        setEditedPrompt(fetched[newIdx]);
      } else {
        setEditedPrompt(null);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    }
  };

  const handleCopy = async (prompt: PromptTemplate) => {
    const maxOrder = Math.max(...prompts.map((p) => p.section_order), 0);
    const newKey = `${prompt.section_key}_copy_${Date.now()}`;

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: newKey,
          title: `${prompt.title} (kopia)`,
          system_prompt: prompt.system_prompt,
          user_prompt_template: prompt.user_prompt_template,
          section_order: maxOrder + 1,
          in_internal_report: prompt.in_internal_report ?? true,
          in_client_report: prompt.in_client_report ?? false,
        }),
      });

      if (!res.ok) throw new Error('Błąd kopiowania');

      setMessage({ type: 'success', text: 'Sekcja skopiowana.' });
      const fetched = await fetchPrompts();
      const newIdx = fetched.findIndex((p: PromptTemplate) => p.section_key === newKey);
      if (newIdx >= 0) {
        setSelectedIndex(newIdx);
        setEditedPrompt(fetched[newIdx]);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    }
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;

    const maxOrder = Math.max(...prompts.map((p) => p.section_order), 0);
    const newKey = `custom_${Date.now()}`;

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: newKey,
          title: newSectionTitle.trim(),
          system_prompt: 'Jesteś ekspertem ds. zarządzania nieruchomościami. Odpowiadasz po polsku.',
          user_prompt_template: 'Przeanalizuj poniższe wątki email.\n\nWĄTKI:\n{{threads}}\n\nNapisz analizę.',
          section_order: maxOrder + 1,
          in_internal_report: true,
          in_client_report: false,
        }),
      });

      if (!res.ok) throw new Error('Błąd dodawania');

      setMessage({ type: 'success', text: 'Nowa sekcja dodana.' });
      setNewSectionTitle('');
      setShowAddForm(false);
      const fetched = await fetchPrompts();
      const newIdx = fetched.findIndex((p: PromptTemplate) => p.section_key === newKey);
      if (newIdx >= 0) {
        setSelectedIndex(newIdx);
        setEditedPrompt(fetched[newIdx]);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= prompts.length) return;

    const current = prompts[index];
    const swap = prompts[swapIndex];

    // Save both with swapped section_order
    try {
      await Promise.all([
        fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_key: current.section_key,
            title: current.title,
            system_prompt: current.system_prompt,
            user_prompt_template: current.user_prompt_template,
            section_order: swap.section_order,
            in_internal_report: current.in_internal_report ?? true,
            in_client_report: current.in_client_report ?? false,
          }),
        }),
        fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_key: swap.section_key,
            title: swap.title,
            system_prompt: swap.system_prompt,
            user_prompt_template: swap.user_prompt_template,
            section_order: current.section_order,
            in_internal_report: swap.in_internal_report ?? true,
            in_client_report: swap.in_client_report ?? false,
          }),
        }),
      ]);

      const fetched = await fetchPrompts();
      const newIdx = fetched.findIndex(
        (p: PromptTemplate) => p.section_key === current.section_key
      );
      if (newIdx >= 0) {
        setSelectedIndex(newIdx);
        setEditedPrompt(fetched[newIdx]);
      }
    } catch {
      setMessage({ type: 'error', text: 'Błąd zmiany kolejności' });
    }
  };

  const handleToggleReportType = async (
    index: number,
    type: 'internal' | 'client',
    checked: boolean
  ) => {
    const prompt = prompts[index];
    const updated = {
      ...prompt,
      ...(type === 'internal'
        ? { in_internal_report: checked }
        : { in_client_report: checked }),
    };

    // Optimistic update
    const prev = [...prompts];
    const newPrompts = [...prompts];
    newPrompts[index] = updated;
    setPrompts(newPrompts);
    if (index === selectedIndex) setEditedPrompt(updated);

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: updated.section_key,
          title: updated.title,
          system_prompt: updated.system_prompt,
          user_prompt_template: updated.user_prompt_template,
          section_order: updated.section_order,
          in_internal_report: updated.in_internal_report ?? true,
          in_client_report: updated.in_client_report ?? false,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on error
      setPrompts(prev);
      if (index === selectedIndex) setEditedPrompt(prev[index]);
      setMessage({ type: 'error', text: 'Błąd aktualizacji typu raportu' });
    }
  };

  const isGlobalContext = editedPrompt?.section_key === '_global_context';
  const isDefaultSection = editedPrompt
    ? DEFAULT_PROMPTS.some((d) => d.section_key === editedPrompt.section_key)
    : false;

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Zarządzanie promptami
          </h1>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Plus className="h-4 w-4" />
          Dodaj sekcję
        </button>
      </div>

      {/* Add section form */}
      {showAddForm && (
        <div
          className="mb-4 rounded-lg border p-4 flex items-end gap-3"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Nazwa nowej sekcji
            </label>
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="np. Analiza kosztów"
              className="rounded-md border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
            />
          </div>
          <button
            onClick={handleAddSection}
            disabled={!newSectionTitle.trim()}
            className="rounded-md px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Dodaj
          </button>
        </div>
      )}

      {message && (
        <div
          className="mb-4 rounded-md border p-3 text-sm"
          style={{
            backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Section list */}
        <div className="col-span-1 space-y-1">
          {prompts.map((prompt, i) => (
            <div key={prompt.section_key} className="group relative">
              <button
                onClick={() => handleSelectPrompt(i)}
                className="w-full text-left rounded-md px-3 py-2 text-sm transition-colors"
                style={{
                  backgroundColor: i === selectedIndex ? 'var(--accent-light)' : 'transparent',
                  color: i === selectedIndex ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <div className="font-medium text-xs leading-tight">{prompt.title}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {prompt.tier === 'default' ? 'Domyślny' : 'Zmodyfikowany'}
                  </span>
                  {prompt.section_key !== '_global_context' && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <label
                        className="flex items-center gap-0.5 cursor-pointer"
                        title="Raport wewnętrzny"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={prompt.in_internal_report ?? true}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleReportType(i, 'internal', e.target.checked);
                          }}
                          className="rounded"
                          style={{ width: 12, height: 12, accentColor: 'var(--accent-primary)' }}
                        />
                        <span className="text-[10px] select-none" style={{ color: 'var(--text-muted)' }}>W</span>
                      </label>
                      <label
                        className="flex items-center gap-0.5 cursor-pointer"
                        title="Raport kliencki"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={prompt.in_client_report ?? false}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleReportType(i, 'client', e.target.checked);
                          }}
                          className="rounded"
                          style={{ width: 12, height: 12, accentColor: 'var(--accent-primary)' }}
                        />
                        <span className="text-[10px] select-none" style={{ color: 'var(--text-muted)' }}>K</span>
                      </label>
                    </div>
                  )}
                </div>
              </button>
              {/* Reorder + actions overlay */}
              <div
                className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5"
                style={{ zIndex: 10 }}
              >
                {i > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReorder(i, 'up'); }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                    title="W górę"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                )}
                {i < prompts.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReorder(i, 'down'); }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                    title="W dół"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(prompt); }}
                  className="p-0.5 rounded hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                  title="Kopiuj"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {!DEFAULT_PROMPTS.some((d) => d.section_key === prompt.section_key) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(prompt.section_key); }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--error)' }}
                    title="Usuń"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="col-span-3">
          {editedPrompt && (
            <div
              className="rounded-lg border p-4 space-y-4"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              {/* Section title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Tytuł sekcji
                </label>
                <input
                  type="text"
                  value={editedPrompt.title}
                  onChange={(e) => setEditedPrompt({ ...editedPrompt, title: e.target.value })}
                  className="rounded-md border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* System prompt */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  System prompt
                </label>
                <textarea
                  value={editedPrompt.system_prompt}
                  onChange={(e) => setEditedPrompt({ ...editedPrompt, system_prompt: e.target.value })}
                  rows={4}
                  className="rounded-md border px-3 py-2 text-sm outline-none resize-y"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* User prompt template */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isGlobalContext ? 'Kontekst globalny' : 'User prompt template'}
                </label>
                <textarea
                  value={editedPrompt.user_prompt_template}
                  onChange={(e) =>
                    setEditedPrompt({ ...editedPrompt, user_prompt_template: e.target.value })
                  }
                  rows={10}
                  className="rounded-md border px-3 py-2 text-sm outline-none resize-y font-mono"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* {{threads}} info */}
              {!isGlobalContext && (
                <div
                  className="flex items-start gap-2 rounded-md p-3 text-sm"
                  style={{
                    backgroundColor: 'var(--info-light)',
                    color: 'var(--info)',
                  }}
                >
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Treść wątków email zostanie automatycznie dołączona do promptu (zmienna{' '}
                    <code
                      className="px-1 py-0.5 rounded text-xs font-mono"
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      {'{{threads}}'}
                    </code>
                    ). Nie musisz jej ręcznie dodawać.
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </button>
                {isDefaultSection && (
                  <button
                    onClick={handleReset}
                    disabled={isSaving}
                    className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                    style={{
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-secondary)',
                    }}
                    title="Przywróć domyślną treść z default-prompts.ts"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Resetuj do domyślnego
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
