'use client';

import type { AllowedUser } from '@/types';

interface UserListProps {
  users: AllowedUser[];
  onEdit: (user: AllowedUser) => void;
  onDelete: (user: AllowedUser) => void;
}

export default function UserList({ users, onEdit, onDelete }: UserListProps) {
  if (users.length === 0) {
    return (
      <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Brak użytkowników</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-muted)' }}>
            <th className="py-3 px-4">Użytkownik</th>
            <th className="py-3 px-4">Rola</th>
            <th className="py-3 px-4">Narzędzia</th>
            <th className="py-3 px-4">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <td className="py-3 px-4">
                <div style={{ color: 'var(--text-primary)' }}>{user.display_name || user.email}</div>
                {user.display_name && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                )}
              </td>
              <td className="py-3 px-4">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: user.role === 'admin' ? 'var(--warning-light)' : 'var(--info-light)',
                    color: user.role === 'admin' ? 'var(--warning)' : 'var(--info)',
                  }}
                >
                  {user.role === 'admin' ? 'Admin' : 'Użytkownik'}
                </span>
              </td>
              <td className="py-3 px-4" style={{ color: 'var(--text-muted)' }}>
                {user.role === 'admin'
                  ? 'Pełny dostęp'
                  : user.allowed_tools.length === 0
                  ? 'Brak'
                  : `${user.allowed_tools.length} narzędzi`}
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-xs"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => onDelete(user)}
                    className="text-xs"
                    style={{ color: 'var(--error)' }}
                  >
                    Usuń
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
