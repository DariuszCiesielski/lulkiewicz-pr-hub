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
      <p className="text-center text-slate-400 py-8">Brak użytkowników</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="py-3 px-4">Użytkownik</th>
            <th className="py-3 px-4">Rola</th>
            <th className="py-3 px-4">Narzędzia</th>
            <th className="py-3 px-4">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="py-3 px-4">
                <div className="text-white">{user.display_name || user.email}</div>
                {user.display_name && (
                  <div className="text-xs text-slate-400">{user.email}</div>
                )}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-amber-900/50 text-amber-300'
                      : 'bg-blue-900/50 text-blue-300'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin' : 'Użytkownik'}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-400">
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
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => onDelete(user)}
                    className="text-xs text-red-400 hover:text-red-300"
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
