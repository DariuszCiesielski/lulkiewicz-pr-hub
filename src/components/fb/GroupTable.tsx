'use client';

import {
  CheckCircle2, PauseCircle, Pencil, Trash2, ExternalLink,
  Play, Pause,
} from 'lucide-react';
import type { FbGroupEnriched } from '@/types/fb';

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nigdy';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  return `${Math.floor(hours / 24)} dni temu`;
}

interface GroupTableProps {
  groups: FbGroupEnriched[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (group: FbGroupEnriched) => void;
  onDelete: (group: FbGroupEnriched) => void;
  onToggleStatus: (group: FbGroupEnriched) => void;
}

interface GroupsByDeveloper {
  developer: string;
  groups: FbGroupEnriched[];
}

function groupByDeveloper(groups: FbGroupEnriched[]): GroupsByDeveloper[] {
  const map = new Map<string, FbGroupEnriched[]>();

  for (const group of groups) {
    const key = group.developer?.trim() || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(group);
  }

  const result: GroupsByDeveloper[] = [];

  // Sortowane sekcje: najpierw z deweloperem (alfabetycznie), potem "Bez dewelopera"
  const sortedKeys = [...map.keys()].sort((a, b) => {
    if (a === '' && b === '') return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    return a.localeCompare(b, 'pl');
  });

  for (const key of sortedKeys) {
    result.push({
      developer: key || 'Bez dewelopera',
      groups: map.get(key)!,
    });
  }

  return result;
}

export default function GroupTable({
  groups,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onToggleStatus,
}: GroupTableProps) {
  const sections = groupByDeveloper(groups);
  const allSelected = groups.length > 0 && selectedIds.size === groups.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  if (groups.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-muted)',
        }}
      >
        <p className="text-sm">Brak grup do wyświetlenia. Dodaj pierwszą grupę.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.developer}>
          {/* Nagłówek sekcji dewelopera */}
          <div className="flex items-center gap-2 mb-2">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {section.developer}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-primary)',
              }}
            >
              {section.groups.length}
            </span>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={onToggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th
                    className="px-3 py-2 text-left font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Nazwa
                  </th>
                  <th
                    className="hidden md:table-cell px-3 py-2 text-left font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    URL
                  </th>
                  <th
                    className="px-3 py-2 text-left font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Status
                  </th>
                  <th
                    className="px-3 py-2 text-center font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Posty
                  </th>
                  <th
                    className="hidden md:table-cell px-3 py-2 text-center font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Istotne
                  </th>
                  <th
                    className="px-3 py-2 text-left font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Ostatni scrape
                  </th>
                  <th
                    className="px-3 py-2 text-right font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.groups.map((group) => {
                  const isPaused = group.status === 'paused';
                  return (
                    <tr
                      key={group.id}
                      className="border-t transition-colors hover:brightness-95"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-primary)',
                        opacity: isPaused ? 0.6 : 1,
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(group.id)}
                          onChange={() => onToggleSelect(group.id)}
                          className="rounded"
                        />
                      </td>

                      {/* Nazwa */}
                      <td className="px-3 py-2">
                        <span
                          className="font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {group.name}
                        </span>
                      </td>

                      {/* URL */}
                      <td className="hidden md:table-cell px-3 py-2">
                        <a
                          href={group.facebook_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs hover:opacity-80"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Facebook
                        </a>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: group.status === 'active'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'rgba(234, 179, 8, 0.15)',
                            color: group.status === 'active' ? '#22c55e' : '#eab308',
                          }}
                        >
                          {group.status === 'active' ? (
                            <><CheckCircle2 className="h-3 w-3" /> Aktywna</>
                          ) : (
                            <><PauseCircle className="h-3 w-3" /> Wstrzymana</>
                          )}
                        </span>
                      </td>

                      {/* Posty */}
                      <td
                        className="px-3 py-2 text-center"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {group.total_posts}
                      </td>

                      {/* Istotne */}
                      <td
                        className="hidden md:table-cell px-3 py-2 text-center"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {group.relevant_posts}
                      </td>

                      {/* Ostatni scrape */}
                      <td
                        className="px-3 py-2 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {timeAgo(group.last_scraped_at)}
                      </td>

                      {/* Akcje */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onToggleStatus(group)}
                            title={isPaused ? 'Aktywuj' : 'Wstrzymaj'}
                            className="rounded p-1 transition-colors hover:opacity-80"
                            style={{
                              color: isPaused ? '#22c55e' : '#eab308',
                            }}
                          >
                            {isPaused ? (
                              <Play className="h-4 w-4" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => onEdit(group)}
                            title="Edytuj"
                            className="rounded p-1 transition-colors hover:opacity-80"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDelete(group)}
                            title="Usuń"
                            className="rounded p-1 transition-colors hover:opacity-80"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
