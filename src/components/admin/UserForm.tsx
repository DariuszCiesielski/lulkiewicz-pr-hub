'use client';

import { useState } from 'react';
import type { AllowedUser, UserRole, ToolId } from '@/types';
import ToolAccessSelector from './ToolAccessSelector';

interface UserFormProps {
  user?: AllowedUser | null;
  onSubmit: (data: {
    email: string;
    displayName: string;
    role: UserRole;
    allowedTools: ToolId[];
    method: 'invite' | 'password';
    password?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function UserForm({ user, onSubmit, onClose }: UserFormProps) {
  const isEdit = !!user;
  const [email, setEmail] = useState(user?.email || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'user');
  const [allowedTools, setAllowedTools] = useState<ToolId[]>(user?.allowed_tools || []);
  const [method, setMethod] = useState<'invite' | 'password'>('password');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSubmit({ email, displayName, role, allowedTools, method, password });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {isEdit ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Nazwa wyświetlana</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Rola</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            >
              <option value="user">Użytkownik</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dostęp do narzędzi</label>
              <ToolAccessSelector selected={allowedTools} onChange={setAllowedTools} />
            </div>
          )}

          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Metoda</label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={method === 'password'}
                      onChange={() => setMethod('password')}
                    />
                    <span className="text-sm text-slate-700">Hasło tymczasowe</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={method === 'invite'}
                      onChange={() => setMethod('invite')}
                    />
                    <span className="text-sm text-slate-700">Zaproszenie email</span>
                  </label>
                </div>
              </div>

              {method === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Hasło tymczasowe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading ? 'Zapisywanie...' : isEdit ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
