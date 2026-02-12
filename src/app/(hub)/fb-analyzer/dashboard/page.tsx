'use client';

import { BarChart3 } from 'lucide-react';

export default function FbDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Dashboard FB
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
          Metryki i podsumowania z monitorowanych grup Facebookowych
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ta funkcjonalność zostanie zaimplementowana w kolejnych fazach.
        </p>
      </div>
    </div>
  );
}
