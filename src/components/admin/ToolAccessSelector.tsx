'use client';

import type { ToolId } from '@/types';

const TOOL_NAMES: Record<ToolId, string> = {
  'email-analyzer': 'Analizator Email',
  'tool-2': 'Narzędzie 2',
  'tool-3': 'Narzędzie 3',
  'tool-4': 'Narzędzie 4',
  'tool-5': 'Narzędzie 5',
  'tool-6': 'Narzędzie 6',
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
          className="text-blue-600 hover:underline"
        >
          Zaznacz wszystkie
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-blue-600 hover:underline"
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
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">{TOOL_NAMES[toolId]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
