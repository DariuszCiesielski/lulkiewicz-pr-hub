'use client';

import { Cog } from 'lucide-react';

export default function FbSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Cog className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Ustawienia FB
        </h1>
      </div>
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Konfiguracja Apify, cookies Facebooka i parametrów scrapowania
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ta funkcjonalność zostanie zaimplementowana w kolejnych fazach.
        </p>
      </div>
    </div>
  );
}
