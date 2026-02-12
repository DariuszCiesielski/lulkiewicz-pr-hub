'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Mail, Wrench, BarChart3, FileText, Users, Settings2, Lock } from 'lucide-react';
import type { ToolConfig } from '@/config/tools';

const ICON_MAP: Record<string, LucideIcon> = {
  Mail,
  Wrench,
  BarChart3,
  FileText,
  Users,
  Settings2,
};

interface ToolCardProps {
  tool: ToolConfig;
  canAccess: boolean;
}

export default function ToolCard({ tool, canAccess }: ToolCardProps) {
  const Icon = ICON_MAP[tool.icon] || Wrench;

  if (tool.comingSoon) {
    return (
      <div
        className="relative rounded-xl border p-6 opacity-60"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="absolute top-3 right-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-muted)' }}
          >
            Wkrótce
          </span>
        </div>
        <Icon className="mb-4 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-muted)' }}>
          {tool.name}
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {tool.description}
        </p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div
        className="relative rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
          <div className="flex items-center gap-2 text-white">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-medium">Brak dostępu</span>
          </div>
        </div>
        <Icon className="mb-4 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {tool.name}
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {tool.description}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={tool.href}
      className="group block rounded-xl border p-6 transition-all hover:-translate-y-1"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
    >
      <Icon className="mb-4 h-8 w-8" style={{ color: 'var(--accent-primary)' }} />
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {tool.name}
      </h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {tool.description}
      </p>
    </Link>
  );
}
