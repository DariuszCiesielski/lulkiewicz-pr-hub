'use client';

import { Cog } from 'lucide-react';
import SettingsForm from '@/components/fb/SettingsForm';

export default function FbSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Cog className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Ustawienia FB
        </h1>
      </div>

      <SettingsForm />
    </div>
  );
}
