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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--overlay)' }}>
      <div
        className="w-full max-w-md rounded-lg p-6 shadow-xl"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      >
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isEdit ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              required
              className="mt-1 block w-full rounded-md border px-3 py-2 disabled:opacity-60"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nazwa wyświetlana</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Rola</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 block w-full rounded-md border px-3 py-2"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="user">Użytkownik</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {role === 'user' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Dostęp do narzędzi</label>
              <ToolAccessSelector selected={allowedTools} onChange={setAllowedTools} />
            </div>
          )}

          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Metoda</label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={method === 'password'}
                      onChange={() => setMethod('password')}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Hasło tymczasowe</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={method === 'invite'}
                      onChange={() => setMethod('invite')}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Zaproszenie email</span>
                  </label>
                </div>
              </div>

              {method === 'password' && (
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Hasło tymczasowe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="mt-1 block w-full rounded-md border px-3 py-2"
                    style={{
                      borderColor: 'var(--border-primary)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {isLoading ? 'Zapisywanie...' : isEdit ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
