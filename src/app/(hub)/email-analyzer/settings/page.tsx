'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AIConfigState {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  api_key: string;
  has_api_key: boolean;
  api_key_preview: string | null;
}

const modelsByProvider: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-5.2', label: 'GPT-5.2 (najnowszy)' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (najtańszy)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (najtańszy)' },
  ],
  azure: [
    { value: 'gpt-5.2', label: 'GPT-5.2 (najnowszy)' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
};

export default function AISettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState<AIConfigState>({
    provider: 'openai',
    model: 'gpt-5.2',
    temperature: 0.3,
    max_tokens: 16384,
    api_key: '',
    has_api_key: false,
    api_key_preview: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/dashboard');
  }, [isAdmin, authLoading, router]);

  // Load config
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/ai-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setConfig((prev) => ({
            ...prev,
            provider: data.config.provider || 'openai',
            model: data.config.model || 'gpt-4o-mini',
            temperature: data.config.temperature ?? 0.3,
            max_tokens: data.config.max_tokens ?? 4096,
            has_api_key: !!data.config.has_api_key,
            api_key_preview: data.config.api_key_preview || null,
          }));
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const body: Record<string, unknown> = {
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
      };
      if (config.api_key) body.api_key = config.api_key;

      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu');
      }

      setMessage({ type: 'success', text: 'Konfiguracja zapisana pomyślnie.' });
      // Reload config to get updated api_key_preview
      const reloadRes = await fetch('/api/ai-config');
      const reloadData = await reloadRes.json();
      setConfig((prev) => ({
        ...prev,
        api_key: '',
        has_api_key: true,
        api_key_preview: reloadData.config?.api_key_preview || null,
      }));
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setIsSaving(false);
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
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Ustawienia AI
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

      <form
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        autoComplete="off"
        className="rounded-lg border p-6 space-y-5"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Provider */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Provider
          </label>
          <select
            value={config.provider}
            onChange={(e) => {
              const newProvider = e.target.value;
              const firstModel = modelsByProvider[newProvider]?.[0]?.value || '';
              setConfig({ ...config, provider: newProvider, model: firstModel });
            }}
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="azure">Azure OpenAI</option>
          </select>
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Model
          </label>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          >
            {(modelsByProvider[config.provider] || modelsByProvider.openai).map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Klucz API {config.has_api_key && <span className="text-xs font-normal" style={{ color: '#22c55e' }}>(skonfigurowany)</span>}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              autoComplete="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              className="w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
              placeholder={config.has_api_key ? '••••••••••••••••' : 'sk-...'}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {config.has_api_key && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {config.api_key_preview
                ? <>Aktualny klucz: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{config.api_key_preview}</span></>
                : 'Klucz skonfigurowany'}
            </p>
          )}
          {!config.has_api_key && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Nie skonfigurowano
            </p>
          )}
        </div>

        {/* Temperature */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Temperatura: {config.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.temperature}
            onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Precyzyjnie (0)</span>
            <span>Kreatywnie (1)</span>
          </div>
        </div>

        {/* Max tokens */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Max tokenów
          </label>
          <input
            type="number"
            value={config.max_tokens}
            onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value, 10) || 4096 })}
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
            min={1024}
            max={32768}
          />
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Zapisywanie...' : 'Zapisz konfigurację'}
        </button>
      </form>
    </div>
  );
}
