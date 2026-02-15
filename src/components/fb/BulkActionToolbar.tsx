'use client';

import { useState } from 'react';
import { Play, Pause, Trash2, X, Users } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  developers: string[];
  onAction: (action: 'set_status' | 'set_developer' | 'soft_delete', value?: string) => Promise<void>;
  onClearSelection: () => void;
}

export default function BulkActionToolbar({
  selectedCount,
  developers,
  onAction,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDevSelect, setShowDevSelect] = useState(false);
  const [bulkDeveloper, setBulkDeveloper] = useState('');

  const handleAction = async (action: 'set_status' | 'set_developer' | 'soft_delete', value?: string) => {
    setIsLoading(true);
    try {
      await onAction(action, value);
    } finally {
      setIsLoading(false);
      setShowDevSelect(false);
      setBulkDeveloper('');
    }
  };

  return (
    <div
      className="rounded-lg border p-3 mb-4 flex flex-wrap items-center gap-2"
      style={{
        borderColor: 'var(--accent-primary)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <span
        className="text-sm font-medium mr-2"
        style={{ color: 'var(--text-primary)' }}
      >
        Zaznaczono {selectedCount} grup
      </span>

      {/* Aktywuj */}
      <button
        onClick={() => handleAction('set_status', 'active')}
        disabled={isLoading}
        className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
        style={{
          borderColor: 'rgba(34, 197, 94, 0.4)',
          color: '#22c55e',
        }}
      >
        <Play className="h-3 w-3" />
        Aktywuj
      </button>

      {/* Wstrzymaj */}
      <button
        onClick={() => handleAction('set_status', 'paused')}
        disabled={isLoading}
        className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
        style={{
          borderColor: 'rgba(234, 179, 8, 0.4)',
          color: '#eab308',
        }}
      >
        <Pause className="h-3 w-3" />
        Wstrzymaj
      </button>

      {/* Zmień dewelopera */}
      {!showDevSelect ? (
        <button
          onClick={() => setShowDevSelect(true)}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          <Users className="h-3 w-3" />
          Zmień dewelopera
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={bulkDeveloper}
            onChange={(e) => setBulkDeveloper(e.target.value)}
            list="bulk-toolbar-devs"
            placeholder="Deweloper..."
            className="rounded-md border px-2 py-1 text-xs w-36 outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />
          <datalist id="bulk-toolbar-devs">
            {developers.map((dev) => (
              <option key={dev} value={dev} />
            ))}
          </datalist>
          <button
            onClick={() => handleAction('set_developer', bulkDeveloper)}
            disabled={isLoading}
            className="rounded-md px-2 py-1 text-xs text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            OK
          </button>
          <button
            onClick={() => {
              setShowDevSelect(false);
              setBulkDeveloper('');
            }}
            className="rounded-md p-1 text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Usun */}
      <button
        onClick={() => {
          if (confirm(`Czy na pewno chcesz usunąć ${selectedCount} zaznaczonych grup?`)) {
            handleAction('soft_delete');
          }
        }}
        disabled={isLoading}
        className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
        style={{
          borderColor: 'rgba(239, 68, 68, 0.4)',
          color: '#ef4444',
        }}
      >
        <Trash2 className="h-3 w-3" />
        Usuń
      </button>

      {/* Separator + Odznacz */}
      <div className="flex-1" />
      <button
        onClick={onClearSelection}
        className="flex items-center gap-1 rounded-md p-1 text-xs transition-colors hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
        title="Odznacz wszystko"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
