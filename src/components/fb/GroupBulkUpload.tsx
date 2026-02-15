'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GroupBulkUploadProps {
  developers: string[];
  onComplete: () => void;
  onClose: () => void;
}

interface ParseResult {
  valid: string[];
  errors: { line: number; url: string; reason: string }[];
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

function parseUrls(text: string): ParseResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const valid: string[] = [];
  const errors: { line: number; url: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const url = lines[i];

    if (!isValidFbGroupUrl(url)) {
      errors.push({ line: i + 1, url, reason: 'Nieprawidłowy URL grupy Facebook' });
      continue;
    }

    if (seen.has(url)) {
      errors.push({ line: i + 1, url, reason: 'Zduplikowany URL' });
      continue;
    }

    seen.add(url);
    valid.push(url);
  }

  return { valid, errors };
}

export default function GroupBulkUpload({
  developers,
  onComplete,
  onClose,
}: GroupBulkUploadProps) {
  const [urlText, setUrlText] = useState('');
  const [developer, setDeveloper] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { line: number; url: string; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setUrlText(text);
      setParseResult(null);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    setError(null);
    setResult(null);

    if (!urlText.trim()) {
      setError('Wklej URL-e lub wybierz plik');
      return;
    }

    const lines = urlText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 100) {
      setError('Maksymalnie 100 URL-ów na raz. Obecna liczba: ' + lines.length);
      return;
    }

    setParseResult(parseUrls(urlText));
  };

  const handleSubmit = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/fb-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: parseResult.valid,
          developer: developer.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Błąd dodawania grup');
      }

      const data = await res.json();
      setResult(data);
      onComplete();
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
            Upload URL-ów grup
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Textarea */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              URL-e grup (jeden per linia)
            </label>
            <textarea
              value={urlText}
              onChange={(e) => {
                setUrlText(e.target.value);
                setParseResult(null);
                setResult(null);
              }}
              rows={6}
              placeholder={'https://www.facebook.com/groups/grupa-1\nhttps://www.facebook.com/groups/grupa-2\nhttps://www.facebook.com/groups/grupa-3'}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1 resize-y font-mono"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* File input */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              <FileText className="h-4 w-4" />
              Wybierz plik .txt
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              lub wklej URL-e powyżej
            </span>
          </div>

          {/* Deweloper */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Deweloper (dla wszystkich)
            </label>
            <input
              type="text"
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
              list="bulk-developer-suggestions"
              placeholder="np. Royal Apartments"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
            <datalist id="bulk-developer-suggestions">
              {developers.map((dev) => (
                <option key={dev} value={dev} />
              ))}
            </datalist>
          </div>

          {/* Parse button */}
          {!parseResult && !result && (
            <button
              onClick={handleParse}
              className="w-full flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: 'var(--accent-primary)',
                color: 'var(--accent-primary)',
              }}
            >
              <Upload className="h-4 w-4" />
              Parsuj URL-e
            </button>
          )}

          {/* Parse result */}
          {parseResult && !result && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {parseResult.valid.length} poprawnych
                </span>
                {parseResult.errors.length > 0 && (
                  <span className="flex items-center gap-1" style={{ color: '#ef4444' }}>
                    <AlertCircle className="h-4 w-4" />
                    {parseResult.errors.length} błędnych
                  </span>
                )}
              </div>

              {/* Lista bledow */}
              {parseResult.errors.length > 0 && (
                <div
                  className="rounded-md border p-3 text-xs max-h-32 overflow-y-auto"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  }}
                >
                  {parseResult.errors.map((err, i) => (
                    <div key={i} style={{ color: '#ef4444' }}>
                      Linia {err.line}: {err.reason} — <span className="font-mono">{err.url.substring(0, 60)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              {parseResult.valid.length > 0 && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full rounded-md px-4 py-2 text-sm text-white font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {isLoading
                    ? 'Dodawanie...'
                    : `Dodaj ${parseResult.valid.length} grup`
                  }
                </button>
              )}
            </div>
          )}

          {/* Final result */}
          {result && (
            <div className="space-y-3">
              <div
                className="rounded-md border p-3 text-sm"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderColor: 'rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                }}
              >
                Dodano {result.created} grup.
              </div>

              {result.errors.length > 0 && (
                <div
                  className="rounded-md border p-3 text-xs max-h-32 overflow-y-auto"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  }}
                >
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ color: '#ef4444' }}>
                      Linia {err.line}: {err.reason}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-md border px-4 py-2 text-sm transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Zamknij
              </button>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
