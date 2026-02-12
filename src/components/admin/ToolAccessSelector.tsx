'use client';

import type { ToolId } from '@/types';

const TOOL_NAMES: Record<ToolId, string> = {
  'email-analyzer': 'Analizator Email',
  'fb-analyzer': 'Analizator Grup FB',
  'social-media': 'Social Media Manager',
  'article-generator': 'Generator Artykułów',
  'cold-mailing': 'Cold Mailing',
  'campaign-analyzer': 'Analizator Kampanii',
};

const ALL_TOOLS: ToolId[] = Object.keys(TOOL_NAMES) as ToolId[];

interface ToolAccessSelectorProps {
  selected: ToolId[];
  onChange: (tools: ToolId[]) => void;
}

export default function ToolAccessSelector({ selected, onChange }: ToolAccessSelectorProps) {
  const toggle = (toolId: ToolId) => {
    if (selected.includes(toolId)) {
      onChange(selected.filter((t) => t !== toolId));
    } else {
      onChange([...selected, toolId]);
    }
  };

  return (
    <div>
      <div className="mb-2 flex gap-3 text-xs">
        <button
          type="button"
          onClick={() => onChange([...ALL_TOOLS])}
          className="hover:underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          Zaznacz wszystkie
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="hover:underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          Odznacz wszystkie
        </button>
      </div>
      <div className="space-y-2">
        {ALL_TOOLS.map((toolId) => (
          <label key={toolId} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(toolId)}
              onChange={() => toggle(toolId)}
              className="rounded"
              style={{ borderColor: 'var(--border-primary)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{TOOL_NAMES[toolId]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
