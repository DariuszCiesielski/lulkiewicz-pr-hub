'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, Plus } from 'lucide-react';
import type { AllowedUser, UserRole, ToolId } from '@/types';
import UserList from '@/components/admin/UserList';
import UserForm from '@/components/admin/UserForm';

export default function AdminPage() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AllowedUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Nie udało się pobrać użytkowników');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (data: {
    email: string;
    displayName: string;
    role: UserRole;
    allowedTools: ToolId[];
    method: 'invite' | 'password';
    password?: string;
  }) => {
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Nie udało się dodać użytkownika');
    }

    await fetchUsers();
  };

  const handleEdit = async (data: {
    email: string;
    displayName: string;
    role: UserRole;
    allowedTools: ToolId[];
  }) => {
    if (!editingUser) return;

    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingUser.id,
        role: data.role,
        allowed_tools: data.allowedTools,
        display_name: data.displayName,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Nie udało się zaktualizować użytkownika');
    }

    setEditingUser(null);
    await fetchUsers();
  };

  const handleDelete = async (user: AllowedUser) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć ${user.display_name || user.email}?`)) return;

    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Nie udało się usunąć użytkownika');
      return;
    }

    await fetchUsers();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-slate-400" />
          <h1 className="text-2xl font-bold text-white">Zarządzanie użytkownikami</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież
          </button>
          <button
            onClick={() => { setEditingUser(null); setShowForm(true); }}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Dodaj użytkownika
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-slate-400 py-8">Ładowanie...</p>
      ) : (
        <UserList
          users={users}
          onEdit={(user) => { setEditingUser(user); setShowForm(true); }}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <UserForm
          user={editingUser}
          onSubmit={editingUser ? handleEdit : handleCreate}
          onClose={() => { setShowForm(false); setEditingUser(null); }}
        />
      )}
    </div>
  );
}
