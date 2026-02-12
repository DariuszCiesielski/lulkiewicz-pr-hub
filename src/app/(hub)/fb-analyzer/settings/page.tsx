'use client';

import { useState } from 'react';
import {
  Cog, Key, Cookie, Settings2, CheckCircle2, XCircle, Shield,
} from 'lucide-react';

export default function FbSettingsPage() {
  const [apifyToken] = useState('apify_api_****************************');
  const [apifyStatus] = useState<'connected' | 'disconnected'>('connected');
  const [cookiesStatus] = useState<'valid' | 'expired'>('valid');
  const [maxPosts] = useState(50);
  const [minInterval] = useState(3);
  const [proxyEnabled] = useState(true);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Cog className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Ustawienia FB
        </h1>
      </div>

      <div className="space-y-4">
        {/* Apify API */}
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
              Apify API
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                API Token
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apifyToken}
                  readOnly
                  className="flex-1 rounded-md border px-3 py-2 text-sm font-mono"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  className="rounded-md border px-3 py-2 text-xs transition-colors hover:opacity-80"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Testuj
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1"
                style={{
                  backgroundColor: apifyStatus === 'connected'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: apifyStatus === 'connected' ? '#22c55e' : '#ef4444',
                }}
              >
                {apifyStatus === 'connected' ? (
                  <><CheckCircle2 className="h-3 w-3" /> Połączono</>
                ) : (
                  <><XCircle className="h-3 w-3" /> Rozłączono</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Facebook Cookies */}
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
              Facebook Cookies
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Cookies sesji (JSON)
              </label>
              <textarea
                readOnly
                value='[{"name":"c_user","value":"****"},{"name":"xs","value":"****"},{"name":"datr","value":"****"}]'
                rows={3}
                className="w-full rounded-md border p-3 text-xs font-mono resize-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1"
                  style={{
                    backgroundColor: cookiesStatus === 'valid'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                    color: cookiesStatus === 'valid' ? '#22c55e' : '#ef4444',
                  }}
                >
                  {cookiesStatus === 'valid' ? (
                    <><CheckCircle2 className="h-3 w-3" /> Ważne</>
                  ) : (
                    <><XCircle className="h-3 w-3" /> Wygasłe</>
                  )}
                </span>
              </div>
              <button
                className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Testuj cookies
              </button>
            </div>

            <div
              className="rounded-md border p-2 flex items-start gap-2"
              style={{
                borderColor: 'rgba(234, 179, 8, 0.3)',
                backgroundColor: 'rgba(234, 179, 8, 0.05)',
              }}
            >
              <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#eab308' }} />
              <p className="text-xs" style={{ color: '#eab308' }}>
                Używaj dedykowanego konta Facebook do scrapowania. Nie używaj swojego osobistego konta — ryzyko blokady.
              </p>
            </div>
          </div>
        </div>

        {/* Scraping params */}
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
              Parametry scrapowania
            </h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Max postów na scrape
                </label>
                <input
                  type="number"
                  value={maxPosts}
                  readOnly
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Min. odstęp między scrape&apos;ami (min)
                </label>
                <input
                  type="number"
                  value={minInterval}
                  readOnly
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  Apify Proxy
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Używaj proxy do ochrony konta FB
                </p>
              </div>
              <div
                className="relative w-10 h-5 rounded-full cursor-pointer transition-colors"
                style={{
                  backgroundColor: proxyEnabled ? 'var(--accent-primary)' : 'var(--border-primary)',
                }}
              >
                <div
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                  style={{
                    transform: proxyEnabled ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Zapisz ustawienia
        </button>
      </div>
    </div>
  );
}
