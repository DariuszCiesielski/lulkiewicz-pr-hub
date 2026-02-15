'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { FbGroupEnriched } from '@/types/fb';

export interface GroupFormData {
  name: string;
  facebook_url: string;
  developer: string;
  ai_instruction: string;
}

interface GroupFormModalProps {
  group?: FbGroupEnriched | null;
  developers: string[];
  onSubmit: (data: GroupFormData) => Promise<void>;
  onClose: () => void;
}

function isValidFbGroupUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.facebook.com' ||
        parsed.hostname === 'facebook.com' ||
        parsed.hostname === 'm.facebook.com') &&
      parsed.pathname.includes('/groups/')
    );
  } catch {
    return false;
  }
}

export default function GroupFormModal({
  group,
  developers,
  onSubmit,
  onClose,
}: GroupFormModalProps) {
  const isEditing = !!group;

  const [name, setName] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [developer, setDeveloper] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill w trybie edycji
  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setFacebookUrl(group.facebook_url || '');
      setDeveloper(group.developer || '');
      setAiInstruction(group.ai_instruction || '');
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Walidacja client-side
    if (name.trim().length < 2) {
      setError('Nazwa grupy musi mieć co najmniej 2 znaki');
      return;
    }

    if (!isValidFbGroupUrl(facebookUrl.trim())) {
      setError('URL musi być prawidłowym adresem grupy Facebook (facebook.com/groups/...)');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        facebook_url: facebookUrl.trim(),
        developer: developer.trim(),
        ai_instruction: aiInstruction.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-lg rounded-lg p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {isEditing ? 'Edytuj grupę' : 'Dodaj grupę FB'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nazwa grupy */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Nazwa grupy <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="np. Mieszkańcy Osiedla Słonecznego"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* URL grupy FB */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              URL grupy FB <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              required
              placeholder="https://www.facebook.com/groups/nazwa-grupy"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Deweloper */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Deweloper
            </label>
            <input
              type="text"
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
              list="developer-suggestions"
              placeholder="np. Royal Apartments"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
            <datalist id="developer-suggestions">
              {developers.map((dev) => (
                <option key={dev} value={dev} />
              ))}
            </datalist>
          </div>

          {/* Instrukcja AI */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Instrukcja AI
            </label>
            <textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              rows={3}
              placeholder="Opisz co AI ma szukać w postach tej grupy..."
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1 resize-y"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Opcjonalne. Dodatkowe instrukcje dla AI podczas analizy postów z tej grupy.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-md border p-3 text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md px-4 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {isLoading
                ? (isEditing ? 'Zapisywanie...' : 'Dodawanie...')
                : (isEditing ? 'Zapisz zmiany' : 'Dodaj grupę')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
