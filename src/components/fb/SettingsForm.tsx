'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Key, Cookie, Settings2, CheckCircle2, XCircle, Shield, Brain, Loader2, Upload, Tag,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const SUPER_ADMIN_EMAIL = 'dariusz.ciesielski.71@gmail.com';

export default function SettingsForm() {
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // Loaded flags
  const [hasApifyToken, setHasApifyToken] = useState(false);
  const [hasFbCookies, setHasFbCookies] = useState(false);
  const [apifyActorId, setApifyActorId] = useState('curious_coder/facebook-post-scraper');
  const [developerInstructions, setDeveloperInstructions] = useState<Record<string, string>>({});
  const [developers, setDevelopers] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsInput, setKeywordsInput] = useState('');

  // Form inputs
  const [newApifyToken, setNewApifyToken] = useState('');
  const [newFbCookies, setNewFbCookies] = useState('');
  const [newActorId, setNewActorId] = useState('');
  const [cookiesInputMode, setCookiesInputMode] = useState<'text' | 'file'>('text');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, developersRes] = await Promise.all([
        fetch('/api/fb-settings'),
        fetch('/api/fb-groups/developers'),
      ]);

      if (!settingsRes.ok) throw new Error('Błąd ładowania ustawień');
      if (!developersRes.ok) throw new Error('Błąd ładowania deweloperów');

      const settingsData = await settingsRes.json();
      const developersData: string[] = await developersRes.json();

      setHasApifyToken(settingsData.has_apify_token);
      setHasFbCookies(settingsData.has_fb_cookies);
      setApifyActorId(settingsData.apify_actor_id);
      setNewActorId(settingsData.apify_actor_id);
      setDeveloperInstructions(settingsData.developer_instructions || {});
      setDevelopers(developersData);

      // Load keywords
      const loadedKeywords: string[] = settingsData.fb_keywords || [];
      setKeywords(loadedKeywords);
      setKeywordsInput(loadedKeywords.join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania ustawień');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setError(null);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
  };

  const saveSetting = async (key: string, value: string, label: string) => {
    setSaving(key);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/fb-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu');
      }

      showSuccess(`${label} zapisano pomyślnie`);

      // Re-fetch to update flags
      const settingsRes = await fetch('/api/fb-settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setHasApifyToken(settingsData.has_apify_token);
        setHasFbCookies(settingsData.has_fb_cookies);
        setApifyActorId(settingsData.apify_actor_id);
        setNewActorId(settingsData.apify_actor_id);
        setDeveloperInstructions(settingsData.developer_instructions || {});
        const updatedKeywords: string[] = settingsData.fb_keywords || [];
        setKeywords(updatedKeywords);
        setKeywordsInput(updatedKeywords.join(', '));
      }

      // Clear form inputs after successful save
      if (key === 'apify_token') setNewApifyToken('');
      if (key === 'fb_cookies') {
        setNewFbCookies('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setSaving(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setNewFbCookies(content.trim());
      }
    };
    reader.onerror = () => {
      setError('Błąd odczytu pliku');
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ładowanie ustawień...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global messages */}
      {error && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}
      {successMessage && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: 'rgba(34, 197, 94, 0.3)',
            backgroundColor: 'rgba(34, 197, 94, 0.05)',
            color: '#22c55e',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Card 1: Apify API Token */}
      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Key className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Apify API Token
          </h2>
          <StatusBadge configured={hasApifyToken} />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Nowy token
            </label>
            <input
              type="password"
              value={newApifyToken}
              onChange={(e) => setNewApifyToken(e.target.value)}
              placeholder="apify_api_..."
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Token jest szyfrowany AES-256 i przechowywany bezpiecznie
            </p>
            <button
              onClick={() => saveSetting('apify_token', newApifyToken, 'Token')}
              disabled={!newApifyToken.trim() || saving === 'apify_token'}
              className="rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {saving === 'apify_token' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
                </span>
              ) : (
                'Zapisz token'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Facebook Cookies */}
      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Cookie className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Facebook Cookies (globalne)
          </h2>
          <StatusBadge configured={hasFbCookies} />
        </div>

        <div className="space-y-3">
          {/* Input mode toggle */}
          <div className="flex gap-1 rounded-md p-0.5" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <button
              onClick={() => setCookiesInputMode('text')}
              className="flex-1 rounded px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: cookiesInputMode === 'text' ? 'var(--accent-primary)' : 'transparent',
                color: cookiesInputMode === 'text' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              Wklej tekst
            </button>
            <button
              onClick={() => setCookiesInputMode('file')}
              className="flex-1 rounded px-3 py-1 text-xs font-medium transition-colors flex items-center justify-center gap-1"
              style={{
                backgroundColor: cookiesInputMode === 'file' ? 'var(--accent-primary)' : 'transparent',
                color: cookiesInputMode === 'file' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Upload className="h-3 w-3" /> Upload plik
            </button>
          </div>

          {cookiesInputMode === 'text' ? (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Cookies sesji (JSON)
              </label>
              <textarea
                value={newFbCookies}
                onChange={(e) => setNewFbCookies(e.target.value)}
                rows={4}
                placeholder='[{"name":"c_user","value":"..."},{"name":"xs","value":"..."}]'
                className="w-full rounded-md border p-3 text-xs font-mono resize-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Plik cookies (.json lub .txt)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt"
                onChange={handleFileUpload}
                className="w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1 file:text-xs file:font-medium"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                }}
              />
              {newFbCookies && cookiesInputMode === 'file' && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Załadowano {newFbCookies.length} znaków
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div />
            <button
              onClick={() => saveSetting('fb_cookies', newFbCookies, 'Cookies')}
              disabled={!newFbCookies.trim() || saving === 'fb_cookies'}
              className="rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {saving === 'fb_cookies' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
                </span>
              ) : (
                'Zapisz cookies'
              )}
            </button>
          </div>

          {/* Warning */}
          <div
            className="rounded-md border p-2 flex items-start gap-2"
            style={{
              borderColor: 'rgba(234, 179, 8, 0.3)',
              backgroundColor: 'rgba(234, 179, 8, 0.05)',
            }}
          >
            <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#eab308' }} />
            <p className="text-xs" style={{ color: '#eab308' }}>
              Używaj dedykowanego konta Facebook do scrapowania. Nie używaj osobistego konta — ryzyko blokady.
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: Apify Actor (super admin only) */}
      {isSuperAdmin && (
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Apify Actor (zaawansowane)
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Actor ID
              </label>
              <input
                type="text"
                value={newActorId}
                onChange={(e) => setNewActorId(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Zmiana actora wymaga uprawnień super admina
              </p>
              <button
                onClick={() => saveSetting('apify_actor_id', newActorId, 'Actor ID')}
                disabled={!newActorId.trim() || newActorId === apifyActorId || saving === 'apify_actor_id'}
                className="rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {saving === 'apify_actor_id' ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
                  </span>
                ) : (
                  'Zapisz actor'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card 4: Developer AI Instructions */}
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
            Domyślne instrukcje AI
          </h2>
        </div>

        {developers.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Dodaj grupy z deweloperem aby ustawić domyślne instrukcje
          </p>
        ) : (
          <div className="space-y-4">
            {developers.map((developer) => (
              <DeveloperInstructionField
                key={developer}
                developer={developer}
                value={developerInstructions[developer] || ''}
                saving={saving}
                onSave={(value) =>
                  saveSetting(`developer_instruction:${developer}`, value, `Instrukcja (${developer})`)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Card 5: Keywords */}
      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Slowa kluczowe do monitorowania
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Wpisz slowa kluczowe (oddzielone przecinkiem lub nowa linia)
            </label>
            <textarea
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              rows={4}
              placeholder="winda, awaria, przeciek, smrod, ochrona, monitoring, oplaty, czynsz, parking, smieci, sprzatanie, remont"
              className="w-full rounded-md border p-3 text-xs resize-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Current keywords preview */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    color: '#8b5cf6',
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Posty zawierajace te slowa kluczowe otrzymaja podwyzszone relevance score (+1-2 pkt).
            </p>
            <button
              onClick={() => {
                // Parse: split by newline and comma, trim, filter empty, unique
                const parsed = keywordsInput
                  .split(/[,\n]+/)
                  .map((s) => s.trim().toLowerCase())
                  .filter((s) => s.length > 0);
                const unique = [...new Set(parsed)];
                saveSetting('fb_keywords', JSON.stringify(unique), 'Slowa kluczowe');
              }}
              disabled={saving === 'fb_keywords'}
              className="rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 whitespace-nowrap ml-3"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {saving === 'fb_keywords' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
                </span>
              ) : (
                'Zapisz slowa'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1 ml-auto"
      style={{
        backgroundColor: configured
          ? 'rgba(34, 197, 94, 0.15)'
          : 'rgba(239, 68, 68, 0.15)',
        color: configured ? '#22c55e' : '#ef4444',
      }}
    >
      {configured ? (
        <><CheckCircle2 className="h-3 w-3" /> Skonfigurowany</>
      ) : (
        <><XCircle className="h-3 w-3" /> Nieskonfigurowany</>
      )}
    </span>
  );
}

function DeveloperInstructionField({
  developer,
  value,
  saving,
  onSave,
}: {
  developer: string;
  value: string;
  saving: string | null;
  onSave: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const savingKey = `developer_instruction:${developer}`;
  const hasChanged = localValue !== value;

  // Sync with parent state when value prop changes (after re-fetch)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {developer}
      </label>
      <textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        rows={3}
        placeholder="Opisz co AI ma szukać w postach grup tego dewelopera..."
        className="w-full rounded-md border p-3 text-xs resize-none"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="flex justify-end mt-1">
        <button
          onClick={() => onSave(localValue)}
          disabled={!hasChanged || saving === savingKey}
          className="rounded-md px-3 py-1 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          {saving === savingKey ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
            </span>
          ) : (
            'Zapisz'
          )}
        </button>
      </div>
    </div>
  );
}
