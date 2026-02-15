'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Upload, Loader2,
} from 'lucide-react';
import type { FbGroupEnriched } from '@/types/fb';
import GroupTable from '@/components/fb/GroupTable';
import GroupFormModal from '@/components/fb/GroupFormModal';
import type { GroupFormData } from '@/components/fb/GroupFormModal';
import GroupBulkUpload from '@/components/fb/GroupBulkUpload';
import BulkActionToolbar from '@/components/fb/BulkActionToolbar';

export default function FbGroupsPage() {
  const [groups, setGroups] = useState<FbGroupEnriched[]>([]);
  const [developers, setDevelopers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FbGroupEnriched | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [filterDeveloper, setFilterDeveloper] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // --- Fetch ---

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [groupsRes, devsRes] = await Promise.all([
        fetch('/api/fb-groups'),
        fetch('/api/fb-groups/developers'),
      ]);

      if (!groupsRes.ok) {
        const data = await groupsRes.json().catch(() => ({}));
        throw new Error(data.error || `Błąd pobierania grup (${groupsRes.status})`);
      }
      if (!devsRes.ok) {
        const data = await devsRes.json().catch(() => ({}));
        throw new Error(data.error || `Błąd pobierania deweloperów (${devsRes.status})`);
      }

      const [groupsData, devsData] = await Promise.all([
        groupsRes.json(),
        devsRes.json(),
      ]);

      setGroups(groupsData as FbGroupEnriched[]);
      setDevelopers(devsData as string[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshGroups = useCallback(async () => {
    await fetchData();
    setSelectedIds(new Set());
  }, [fetchData]);

  // --- Filtrowanie client-side ---

  const filteredGroups = groups.filter((g) => {
    if (filterDeveloper && (g.developer || '') !== filterDeveloper) return false;
    if (filterStatus && g.status !== filterStatus) return false;
    return true;
  });

  // --- Selection ---

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredGroups.length) {
        return new Set();
      }
      return new Set(filteredGroups.map((g) => g.id));
    });
  }, [filteredGroups]);

  // --- CRUD Handlers ---

  const handleAddGroup = async (data: GroupFormData) => {
    const res = await fetch('/api/fb-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        facebook_url: data.facebook_url,
        developer: data.developer || undefined,
        ai_instruction: data.ai_instruction || undefined,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Błąd dodawania grupy');
    }

    setShowAddModal(false);
    await refreshGroups();
  };

  const handleEditGroup = async (data: GroupFormData) => {
    if (!editingGroup) return;

    const res = await fetch(`/api/fb-groups/${editingGroup.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        facebook_url: data.facebook_url,
        developer: data.developer || null,
        ai_instruction: data.ai_instruction || null,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Błąd edycji grupy');
    }

    setEditingGroup(null);
    await refreshGroups();
  };

  const handleDeleteGroup = async (group: FbGroupEnriched) => {
    if (!confirm(`Czy na pewno chcesz usunąć grupę "${group.name}"? Ta operacja jest odwracalna (soft delete).`)) {
      return;
    }

    const res = await fetch(`/api/fb-groups/${group.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Błąd usuwania grupy');
      return;
    }

    await refreshGroups();
  };

  const handleToggleStatus = async (group: FbGroupEnriched) => {
    const newStatus = group.status === 'active' ? 'paused' : 'active';

    const res = await fetch(`/api/fb-groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Błąd zmiany statusu');
      return;
    }

    await refreshGroups();
  };

  // --- Bulk Actions ---

  const handleBulkAction = async (action: 'set_status' | 'set_developer' | 'soft_delete', value?: string) => {
    const ids = Array.from(selectedIds);

    const res = await fetch('/api/fb-groups/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action, value }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Błąd operacji masowej');
      return;
    }

    await refreshGroups();
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl flex items-center justify-center py-20">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Grupy FB
          </h1>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-primary)',
            }}
          >
            {groups.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtr deweloper */}
          <select
            value={filterDeveloper}
            onChange={(e) => {
              setFilterDeveloper(e.target.value);
              setSelectedIds(new Set());
            }}
            className="rounded-md border px-2 py-1.5 text-sm outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">Wszyscy deweloperzy</option>
            {developers.map((dev) => (
              <option key={dev} value={dev}>{dev}</option>
            ))}
          </select>

          {/* Filtr status */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setSelectedIds(new Set());
            }}
            className="rounded-md border px-2 py-1.5 text-sm outline-none"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">Wszystkie statusy</option>
            <option value="active">Aktywne</option>
            <option value="paused">Wstrzymane</option>
          </select>

          {/* Przycisk Upload */}
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload URL-ow</span>
          </button>

          {/* Przycisk Dodaj */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Dodaj grupę</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-md border p-3 text-sm mb-4"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Zamknij
          </button>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          developers={developers}
          onAction={handleBulkAction}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Group Table */}
      <GroupTable
        groups={filteredGroups}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onEdit={(group) => setEditingGroup(group)}
        onDelete={handleDeleteGroup}
        onToggleStatus={handleToggleStatus}
      />

      {/* Add Modal */}
      {showAddModal && (
        <GroupFormModal
          developers={developers}
          onSubmit={handleAddGroup}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <GroupFormModal
          group={editingGroup}
          developers={developers}
          onSubmit={handleEditGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <GroupBulkUpload
          developers={developers}
          onComplete={refreshGroups}
          onClose={() => setShowBulkUpload(false)}
        />
      )}
    </div>
  );
}
