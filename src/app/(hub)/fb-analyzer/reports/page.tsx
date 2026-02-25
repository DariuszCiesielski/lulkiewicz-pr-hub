'use client';

import { ClipboardList, Plus, FileText } from 'lucide-react';

export default function FbReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Raporty FB
          </h1>
        </div>
        <button
          disabled
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Plus className="h-4 w-4" />
          Generuj raport
        </button>
      </div>

      <div className="text-center py-12">
        <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Brak raportów. Generowanie raportów będzie dostępne wkrótce.
        </p>
      </div>
    </div>
  );
}
