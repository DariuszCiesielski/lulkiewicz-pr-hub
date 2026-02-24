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
  Pencil,
  ChevronRight,
  Settings2,
  MessageSquareText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  synthetic_focus?: string | null;
  standard_focus?: string | null;
  model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
}

interface AnalysisProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  thread_section_key: string;
  thread_system_prompt: string;
  thread_user_prompt_template: string;
  synthetic_system_prompt: string | null;
  standard_system_prompt: string | null;
  uses_default_prompts: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Profile state
  const [profiles, setProfiles] = useState<AnalysisProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

  // Section state
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editedPrompt, setEditedPrompt] = useState<PromptTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // Collapsible sections
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [showFocusPrompts, setShowFocusPrompts] = useState(false);
  const [showThreadPrompt, setShowThreadPrompt] = useState(false);

  // Thread prompt editing
  const [editedThreadSystem, setEditedThreadSystem] = useState('');
  const [editedThreadUser, setEditedThreadUser] = useState('');
  const [isSavingThread, setIsSavingThread] = useState(false);

  // Profile CRUD dialog
  const [profileDialog, setProfileDialog] = useState<'create' | 'rename' | 'delete' | null>(null);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [profileDescInput, setProfileDescInput] = useState('');

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

  // ---- Auth guard ----
  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  // ---- Load profiles ----
  const fetchProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const res = await fetch('/api/analysis-profiles');
      const data = await res.json();
      const fetched: AnalysisProfile[] = data.profiles || [];
      setProfiles(fetched);
      return fetched;
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles().then((fetched) => {
        if (fetched.length > 0 && !selectedProfileId) {
          setSelectedProfileId(fetched[0].id);
        }
      });
    }
  }, [isAdmin, fetchProfiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Load sections when profile changes ----
  const fetchPrompts = useCallback(
    async (profileId?: string) => {
      const pid = profileId || selectedProfileId;
      if (!pid) return [];

      const res = await fetch(`/api/prompts?profileId=${pid}`);
      const data = await res.json();
      const fetched: PromptTemplate[] = data.prompts || [];
      setPrompts(fetched);
      return fetched;
    },
    [selectedProfileId]
  );

  useEffect(() => {
    if (isAdmin && selectedProfileId) {
      fetchPrompts().then((fetched) => {
        if (fetched.length > 0) {
          setSelectedIndex(0);
          setEditedPrompt(fetched[0]);
        } else {
          setSelectedIndex(0);
          setEditedPrompt(null);
        }
      });

      // Sync thread prompt fields
      const profile = profiles.find((p) => p.id === selectedProfileId);
      if (profile) {
        setEditedThreadSystem(profile.thread_system_prompt);
        setEditedThreadUser(profile.thread_user_prompt_template);
      }
    }
  }, [isAdmin, selectedProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Section handlers ----

  const handleSelectPrompt = (index: number) => {
    setSelectedIndex(index);
    setEditedPrompt(prompts[index]);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editedPrompt || !selectedProfileId) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfileId,
          section_key: editedPrompt.section_key,
          title: editedPrompt.title,
          system_prompt: editedPrompt.system_prompt,
          user_prompt_template: editedPrompt.user_prompt_template,
          section_order: editedPrompt.section_order,
          in_internal_report: editedPrompt.in_internal_report ?? true,
          in_client_report: editedPrompt.in_client_report ?? false,
          synthetic_focus: editedPrompt.synthetic_focus ?? null,
          standard_focus: editedPrompt.standard_focus ?? null,
          model: editedPrompt.model ?? null,
          temperature: editedPrompt.temperature ?? null,
          max_tokens: editedPrompt.max_tokens ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu');
      }

      setMessage({ type: 'success', text: 'Prompt zapisany.' });
      const fetched = await fetchPrompts();
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

  const handleDelete = async (sectionKey: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę sekcję?')) return;

    try {
      const res = await fetch('/api/prompts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_key: sectionKey, profileId: selectedProfileId }),
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
    if (!selectedProfileId) return;
    const maxOrder = Math.max(...prompts.map((p) => p.section_order), 0);
    const newKey = `${prompt.section_key}_copy_${Date.now()}`;

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfileId,
          section_key: newKey,
          title: `${prompt.title} (kopia)`,
          system_prompt: prompt.system_prompt,
          user_prompt_template: prompt.user_prompt_template,
          section_order: maxOrder + 1,
          in_internal_report: prompt.in_internal_report ?? true,
          in_client_report: prompt.in_client_report ?? false,
          synthetic_focus: prompt.synthetic_focus ?? null,
          standard_focus: prompt.standard_focus ?? null,
          model: prompt.model ?? null,
          temperature: prompt.temperature ?? null,
          max_tokens: prompt.max_tokens ?? null,
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
    if (!newSectionTitle.trim() || !selectedProfileId) return;

    const maxOrder = Math.max(...prompts.map((p) => p.section_order), 0);
    const newKey = `custom_${Date.now()}`;

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfileId,
          section_key: newKey,
          title: newSectionTitle.trim(),
          system_prompt: 'Jesteś ekspertem ds. zarządzania nieruchomościami. Odpowiadasz po polsku.',
          user_prompt_template:
            'Przeanalizuj poniższe wątki email.\n\nWĄTKI:\n{{threads}}\n\nNapisz analizę.',
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

    try {
      await Promise.all([
        fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: selectedProfileId,
            section_key: current.section_key,
            title: current.title,
            system_prompt: current.system_prompt,
            user_prompt_template: current.user_prompt_template,
            section_order: swap.section_order,
            in_internal_report: current.in_internal_report ?? true,
            in_client_report: current.in_client_report ?? false,
            synthetic_focus: current.synthetic_focus ?? null,
            standard_focus: current.standard_focus ?? null,
            model: current.model ?? null,
            temperature: current.temperature ?? null,
            max_tokens: current.max_tokens ?? null,
          }),
        }),
        fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: selectedProfileId,
            section_key: swap.section_key,
            title: swap.title,
            system_prompt: swap.system_prompt,
            user_prompt_template: swap.user_prompt_template,
            section_order: current.section_order,
            in_internal_report: swap.in_internal_report ?? true,
            in_client_report: swap.in_client_report ?? false,
            synthetic_focus: swap.synthetic_focus ?? null,
            standard_focus: swap.standard_focus ?? null,
            model: swap.model ?? null,
            temperature: swap.temperature ?? null,
            max_tokens: swap.max_tokens ?? null,
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
      ...(type === 'internal' ? { in_internal_report: checked } : { in_client_report: checked }),
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
          profileId: selectedProfileId,
          section_key: updated.section_key,
          title: updated.title,
          system_prompt: updated.system_prompt,
          user_prompt_template: updated.user_prompt_template,
          section_order: updated.section_order,
          in_internal_report: updated.in_internal_report ?? true,
          in_client_report: updated.in_client_report ?? false,
          synthetic_focus: updated.synthetic_focus ?? null,
          standard_focus: updated.standard_focus ?? null,
          model: updated.model ?? null,
          temperature: updated.temperature ?? null,
          max_tokens: updated.max_tokens ?? null,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPrompts(prev);
      if (index === selectedIndex) setEditedPrompt(prev[index]);
      setMessage({ type: 'error', text: 'Błąd aktualizacji typu raportu' });
    }
  };

  // ---- Reset to seed ----

  const handleResetToSeed = async () => {
    if (!editedPrompt || !selectedProfileId) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // Fetch the original seed data for this section
      const seedRes = await fetch(
        `/api/prompts?profileId=${selectedProfileId}&seed=true&sectionKey=${editedPrompt.section_key}`
      );
      const seedData = await seedRes.json();

      if (!seedData.seed) {
        setMessage({ type: 'error', text: 'Brak oryginalnego seeda dla tej sekcji.' });
        setIsSaving(false);
        return;
      }

      const seed = seedData.seed;
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfileId,
          section_key: seed.section_key,
          title: seed.title,
          system_prompt: seed.system_prompt,
          user_prompt_template: seed.user_prompt_template,
          section_order: seed.section_order,
          in_internal_report: seed.in_internal_report ?? true,
          in_client_report: seed.in_client_report ?? false,
          synthetic_focus: seed.synthetic_focus ?? null,
          standard_focus: seed.standard_focus ?? null,
          model: seed.model ?? null,
          temperature: seed.temperature ?? null,
          max_tokens: seed.max_tokens ?? null,
        }),
      });

      if (!res.ok) throw new Error('Błąd resetowania');

      setMessage({ type: 'success', text: 'Przywrócono oryginalną treść z seeda.' });
      const fetched = await fetchPrompts();
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

  // ---- Thread prompt handler ----

  const handleSaveThreadPrompt = async () => {
    if (!selectedProfileId) return;
    setIsSavingThread(true);

    try {
      const res = await fetch(`/api/analysis-profiles/${selectedProfileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadSystemPrompt: editedThreadSystem,
          threadUserPromptTemplate: editedThreadUser,
        }),
      });

      if (!res.ok) throw new Error('Błąd zapisu promptu wątku');

      setMessage({ type: 'success', text: 'Prompt wątku zapisany.' });
      // Update local profile data
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === selectedProfileId
            ? {
                ...p,
                thread_system_prompt: editedThreadSystem,
                thread_user_prompt_template: editedThreadUser,
              }
            : p
        )
      );
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSavingThread(false);
    }
  };

  // ---- Profile CRUD handlers ----

  const handleCreateProfile = async () => {
    if (!profileNameInput.trim()) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/analysis-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileNameInput.trim(),
          description: profileDescInput.trim() || null,
          threadSectionKey: `_custom_${Date.now()}_thread`,
          threadSystemPrompt:
            'Jesteś ekspertem ds. zarządzania nieruchomościami. Analizujesz korespondencję email. Odpowiadasz po polsku.',
          threadUserPromptTemplate:
            'Przeanalizuj poniższy wątek email i sporządź krótkie podsumowanie.\n\nWĄTEK:\n{{thread}}',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd tworzenia profilu');
      }

      const newProfile = await res.json();
      setProfileDialog(null);
      setProfileNameInput('');
      setProfileDescInput('');
      const fetched = await fetchProfiles();
      // Select newly created profile
      if (newProfile.id) {
        setSelectedProfileId(newProfile.id);
      } else if (fetched.length > 0) {
        setSelectedProfileId(fetched[fetched.length - 1].id);
      }
      setMessage({ type: 'success', text: 'Profil utworzony.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameProfile = async () => {
    if (!profileNameInput.trim() || !selectedProfileId) return;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/analysis-profiles/${selectedProfileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileNameInput.trim(),
          description: profileDescInput.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Błąd zmiany nazwy');

      setProfileDialog(null);
      setProfileNameInput('');
      setProfileDescInput('');
      await fetchProfiles();
      setMessage({ type: 'success', text: 'Profil zaktualizowany.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfileId || selectedProfile?.is_system) return;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/analysis-profiles/${selectedProfileId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd usuwania profilu');
      }

      setProfileDialog(null);
      const fetched = await fetchProfiles();
      if (fetched.length > 0) {
        setSelectedProfileId(fetched[0].id);
      }
      setMessage({ type: 'success', text: 'Profil usunięty.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Derived ----
  const isGlobalContext = editedPrompt?.section_key === '_global_context';

  // ---- Loading ----
  if (authLoading || isLoadingProfiles) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Zarządzanie promptami
          </h1>
        </div>
      </div>

      {/* Profile selector bar */}
      <div
        className="mb-4 rounded-lg border p-3 flex items-center gap-3 flex-wrap"
        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Profil analizy:
        </label>
        <select
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm outline-none min-w-[200px]"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_system ? ' (systemowy)' : ''}
            </option>
          ))}
        </select>

        {/* Profile action buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => {
              setProfileNameInput('');
              setProfileDescInput('');
              setProfileDialog('create');
            }}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-primary)' }}
            title="Nowy profil"
          >
            <Plus className="h-3.5 w-3.5" />
            Nowy profil
          </button>
          {selectedProfile && (
            <button
              onClick={() => {
                setProfileNameInput(selectedProfile.name);
                setProfileDescInput(selectedProfile.description || '');
                setProfileDialog('rename');
              }}
              className="p-1.5 rounded-md hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Edytuj profil"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {selectedProfile && !selectedProfile.is_system && (
            <button
              onClick={() => setProfileDialog('delete')}
              className="p-1.5 rounded-md hover:opacity-70"
              style={{ color: 'var(--error)' }}
              title="Usuń profil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Profile description */}
      {selectedProfile?.description && (
        <p className="text-xs mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
          {selectedProfile.description}
        </p>
      )}

      {/* Thread prompt (collapsible) */}
      {selectedProfile && (
        <div
          className="mb-4 rounded-lg border overflow-hidden"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <button
            onClick={() => setShowThreadPrompt(!showThreadPrompt)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
          >
            <MessageSquareText className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            Prompt analizy wątku (MAP)
            <ChevronRight
              className="h-4 w-4 ml-auto transition-transform"
              style={{
                color: 'var(--text-muted)',
                transform: showThreadPrompt ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </button>
          {showThreadPrompt && (
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex flex-col gap-1 mt-3">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  System prompt
                </label>
                <textarea
                  value={editedThreadSystem}
                  onChange={(e) => setEditedThreadSystem(e.target.value)}
                  rows={4}
                  className="rounded-md border px-3 py-2 text-sm outline-none resize-y"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  User prompt template
                </label>
                <textarea
                  value={editedThreadUser}
                  onChange={(e) => setEditedThreadUser(e.target.value)}
                  rows={6}
                  className="rounded-md border px-3 py-2 text-sm outline-none resize-y font-mono"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <button
                onClick={handleSaveThreadPrompt}
                disabled={isSavingThread}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingThread ? 'Zapisywanie...' : 'Zapisz prompt wątku'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add section form */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Sekcje raportu ({prompts.length})
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Dodaj sekcję
        </button>
      </div>

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

      {/* Message */}
      {message && (
        <div
          className="mb-4 rounded-md border p-3 text-sm"
          style={{
            backgroundColor:
              message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor:
              message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Section list + Editor */}
      <div className="grid grid-cols-4 gap-4">
        {/* Section list */}
        <div className="col-span-1 space-y-1">
          {prompts.length === 0 && (
            <p className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>
              Brak sekcji. Dodaj pierwszą sekcję powyżej.
            </p>
          )}
          {prompts.map((prompt, i) => (
            <div key={prompt.section_key} className="group relative">
              <button
                onClick={() => handleSelectPrompt(i)}
                className="w-full text-left rounded-md px-3 py-2 text-sm transition-colors"
                style={{
                  backgroundColor:
                    i === selectedIndex ? 'var(--accent-light)' : 'transparent',
                  color: i === selectedIndex ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <div className="font-medium text-xs leading-tight">{prompt.title}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {prompt.model && (
                    <span
                      className="text-[10px] font-mono px-1 rounded"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {prompt.model}
                    </span>
                  )}
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
                        <span
                          className="text-[10px] select-none"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          W
                        </span>
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
                        <span
                          className="text-[10px] select-none"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          K
                        </span>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(i, 'up');
                    }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                    title="W górę"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                )}
                {i < prompts.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(i, 'down');
                    }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}
                    title="W dół"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(prompt);
                  }}
                  className="p-0.5 rounded hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                  title="Kopiuj"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(prompt.section_key);
                  }}
                  className="p-0.5 rounded hover:opacity-70"
                  style={{ color: 'var(--error)' }}
                  title="Usuń"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
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
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Tytuł sekcji
                </label>
                <input
                  type="text"
                  value={editedPrompt.title}
                  onChange={(e) =>
                    setEditedPrompt({ ...editedPrompt, title: e.target.value })
                  }
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
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  System prompt
                </label>
                <textarea
                  value={editedPrompt.system_prompt}
                  onChange={(e) =>
                    setEditedPrompt({ ...editedPrompt, system_prompt: e.target.value })
                  }
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
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isGlobalContext ? 'Kontekst globalny' : 'User prompt template'}
                </label>
                <textarea
                  value={editedPrompt.user_prompt_template}
                  onChange={(e) =>
                    setEditedPrompt({
                      ...editedPrompt,
                      user_prompt_template: e.target.value,
                    })
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

              {/* AI Config (collapsible) */}
              <div
                className="rounded-md border overflow-hidden"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <button
                  onClick={() => setShowAiConfig(!showAiConfig)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:opacity-80"
                  style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Konfiguracja AI (opcjonalna)
                  <ChevronRight
                    className="h-3.5 w-3.5 ml-auto transition-transform"
                    style={{ transform: showAiConfig ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </button>
                {showAiConfig && (
                  <div className="p-3 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Model (override)
                        </label>
                        <input
                          type="text"
                          value={editedPrompt.model || ''}
                          onChange={(e) =>
                            setEditedPrompt({
                              ...editedPrompt,
                              model: e.target.value || null,
                            })
                          }
                          placeholder="np. gpt-4o"
                          className="rounded-md border px-2 py-1.5 text-xs outline-none"
                          style={{
                            borderColor: 'var(--border-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Temperature (0-2)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={editedPrompt.temperature ?? ''}
                          onChange={(e) =>
                            setEditedPrompt({
                              ...editedPrompt,
                              temperature: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="domyślna"
                          className="rounded-md border px-2 py-1.5 text-xs outline-none"
                          style={{
                            borderColor: 'var(--border-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Max tokens
                        </label>
                        <input
                          type="number"
                          min={100}
                          max={128000}
                          step={100}
                          value={editedPrompt.max_tokens ?? ''}
                          onChange={(e) =>
                            setEditedPrompt({
                              ...editedPrompt,
                              max_tokens: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          placeholder="domyślna"
                          className="rounded-md border px-2 py-1.5 text-xs outline-none"
                          style={{
                            borderColor: 'var(--border-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Focus prompts (collapsible) */}
              {!isGlobalContext && (
                <div
                  className="rounded-md border overflow-hidden"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <button
                    onClick={() => setShowFocusPrompts(!showFocusPrompts)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:opacity-80"
                    style={{
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-tertiary)',
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Focus prompts (synteza raportu)
                    <ChevronRight
                      className="h-3.5 w-3.5 ml-auto transition-transform"
                      style={{
                        transform: showFocusPrompts ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  {showFocusPrompts && (
                    <div
                      className="p-3 space-y-3 border-t"
                      style={{ borderColor: 'var(--border-primary)' }}
                    >
                      <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Synthetic focus (raport skrócony)
                        </label>
                        <textarea
                          value={editedPrompt.synthetic_focus || ''}
                          onChange={(e) =>
                            setEditedPrompt({
                              ...editedPrompt,
                              synthetic_focus: e.target.value || null,
                            })
                          }
                          rows={3}
                          placeholder="Dodatkowe instrukcje dla syntezy skróconej..."
                          className="rounded-md border px-2 py-1.5 text-xs outline-none resize-y"
                          style={{
                            borderColor: 'var(--border-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Standard focus (raport pełny)
                        </label>
                        <textarea
                          value={editedPrompt.standard_focus || ''}
                          onChange={(e) =>
                            setEditedPrompt({
                              ...editedPrompt,
                              standard_focus: e.target.value || null,
                            })
                          }
                          rows={3}
                          placeholder="Dodatkowe instrukcje dla syntezy pełnej..."
                          className="rounded-md border px-2 py-1.5 text-xs outline-none resize-y"
                          style={{
                            borderColor: 'var(--border-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>
                  )}
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
                <button
                  onClick={handleResetToSeed}
                  disabled={isSaving}
                  className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                  }}
                  title="Przywróć oryginalną treść z migracji"
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetuj do seeda
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Profile CRUD Dialogs ---- */}

      {/* Create / Rename dialog */}
      {(profileDialog === 'create' || profileDialog === 'rename') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-lg border p-6 w-full max-w-md shadow-xl"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {profileDialog === 'create' ? 'Nowy profil analizy' : 'Edytuj profil'}
            </h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Nazwa
                </label>
                <input
                  type="text"
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="np. Audyt bezpieczeństwa"
                  className="rounded-md border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      profileDialog === 'create'
                        ? handleCreateProfile()
                        : handleRenameProfile();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Opis (opcjonalny)
                </label>
                <input
                  type="text"
                  value={profileDescInput}
                  onChange={(e) => setProfileDescInput(e.target.value)}
                  placeholder="Krótki opis profilu..."
                  className="rounded-md border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setProfileDialog(null)}
                className="rounded-md border px-4 py-2 text-sm hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Anuluj
              </button>
              <button
                onClick={
                  profileDialog === 'create' ? handleCreateProfile : handleRenameProfile
                }
                disabled={!profileNameInput.trim() || isSaving}
                className="rounded-md px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {isSaving
                  ? 'Zapisywanie...'
                  : profileDialog === 'create'
                    ? 'Utwórz'
                    : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {profileDialog === 'delete' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-lg border p-6 w-full max-w-md shadow-xl"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Usuń profil
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Czy na pewno chcesz usunąć profil &quot;{selectedProfile.name}&quot;? Wszystkie
              powiązane sekcje promptów zostaną usunięte. Tej operacji nie można cofnąć.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setProfileDialog(null)}
                className="rounded-md border px-4 py-2 text-sm hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Anuluj
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={isSaving}
                className="rounded-md px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--error, #ef4444)' }}
              >
                {isSaving ? 'Usuwanie...' : 'Usuń profil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
