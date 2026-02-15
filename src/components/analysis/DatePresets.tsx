'use client';

interface DatePresetsProps {
  onSelect: (from: string, to: string) => void;
  disabled?: boolean;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export default function DatePresets({ onSelect, disabled }: DatePresetsProps) {
  const presets = [
    {
      label: 'Ostatni miesiąc',
      getDates: () => {
        // Ostatni pełny miesiąc kalendarzowy
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: formatDate(firstDay), to: formatDate(lastDay) };
      },
    },
    {
      label: 'Ostatnie 3 miesiące',
      getDates: () => {
        // Ostatnie 3 pełne miesiące kalendarzowe
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: formatDate(firstDay), to: formatDate(lastDay) };
      },
    },
    {
      label: 'Ostatnie 30 dni',
      getDates: () => {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        return { from: formatDate(from), to: formatDate(now) };
      },
    },
    {
      label: 'Ostatnie 90 dni',
      getDates: () => {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 90);
        return { from: formatDate(from), to: formatDate(now) };
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.label}
          onClick={() => {
            const { from, to } = preset.getDates();
            onSelect(from, to);
          }}
          disabled={disabled}
          className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:opacity-80 disabled:opacity-50"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
