'use client';

import { Download, Loader2 } from 'lucide-react';
import type { FbGroupEnriched } from '@/types/fb';

interface ScrapeButtonProps {
  group: FbGroupEnriched;
  isScrapingAny: boolean;
  currentScrapingGroupId: string | null;
  onScrape: (groupId: string) => void;
}

export default function ScrapeButton({
  group,
  isScrapingAny,
  currentScrapingGroupId,
  onScrape,
}: ScrapeButtonProps) {
  // Grupy wstrzymane nie moga byc scrapowane
  if (group.status === 'paused') {
    return null;
  }

  // Aktualnie scrapowana grupa
  if (isScrapingAny && currentScrapingGroupId === group.id) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--accent-primary)' }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">Scrapuje...</span>
      </span>
    );
  }

  // Inna grupa jest scrapowana — disabled
  if (isScrapingAny) {
    return (
      <button
        disabled
        className="rounded p-1 opacity-50 cursor-not-allowed"
        style={{ color: 'var(--text-muted)' }}
        title="Inne scrapowanie w toku"
      >
        <Download className="h-4 w-4" />
      </button>
    );
  }

  // Normalny przycisk
  return (
    <button
      onClick={() => onScrape(group.id)}
      className="rounded p-1 transition-colors hover:opacity-80"
      style={{ color: 'var(--accent-primary)' }}
      title="Scrapuj posty z tej grupy"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
