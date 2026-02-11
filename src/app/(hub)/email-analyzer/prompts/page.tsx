'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Save, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PromptTemplate {
  id: string | null;
  section_key: string;
  title: string;
  system_prompt: string;
  user_prompt_template: string;
  tier: string;
  section_order: number;
}

export default function PromptsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editedPrompt, setEditedPrompt] = useState<PromptTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  const fetchPrompts = async () => {
    const res = await fetch('/api/prompts');
    const data = await res.json();
    setPrompts(data.prompts || []);
    if (data.prompts?.length > 0 && !editedPrompt) {
      setEditedPrompt(data.prompts[0]);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchPrompts();
  }, [isAdmin]);

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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu');
      }

      setMessage({ type: 'success', text: 'Prompt zapisany.' });
      await fetchPrompts();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (prompts[selectedIndex]) {
      setEditedPrompt(prompts[selectedIndex]);
      setMessage(null);
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
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Zarządzanie promptami
        </h1>
      </div>

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
            <button
              key={prompt.section_key}
              onClick={() => handleSelectPrompt(i)}
              className="w-full text-left rounded-md px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: i === selectedIndex ? 'var(--accent-light)' : 'transparent',
                color: i === selectedIndex ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <div className="font-medium">{prompt.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {prompt.tier === 'default' ? 'Domyślny' : 'Zmodyfikowany'}
              </div>
            </button>
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  User prompt template
                  <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
                    Użyj {'{{threads}}'} jako placeholder na treść wątków
                  </span>
                </label>
                <textarea
                  value={editedPrompt.user_prompt_template}
                  onChange={(e) => setEditedPrompt({ ...editedPrompt, user_prompt_template: e.target.value })}
                  rows={10}
                  className="rounded-md border px-3 py-2 text-sm outline-none resize-y font-mono"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

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
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:opacity-80"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetuj
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
