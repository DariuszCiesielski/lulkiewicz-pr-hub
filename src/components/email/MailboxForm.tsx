'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ConnectionType, MailboxFormData } from '@/types/email';

export interface MailboxEditData {
  id: string;
  email_address: string;
  display_name: string | null;
  connection_type: ConnectionType;
  tenant_id: string;
  client_id: string;
}

interface MailboxFormProps {
  onSubmit: (data: MailboxFormData) => Promise<void>;
  onClose: () => void;
  /** If provided, form is in edit mode with pre-filled values */
  initialData?: MailboxEditData;
}

export default function MailboxForm({ onSubmit, onClose, initialData }: MailboxFormProps) {
  const isEditMode = !!initialData;

  const [emailAddress, setEmailAddress] = useState(initialData?.email_address ?? '');
  const [displayName, setDisplayName] = useState(initialData?.display_name ?? '');
  const [connectionType, setConnectionType] = useState<ConnectionType>(
    initialData?.connection_type ?? 'client_credentials'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tenantId, setTenantId] = useState(initialData?.tenant_id ?? '');
  const [clientId, setClientId] = useState(initialData?.client_id ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSubmit({
        email_address: emailAddress,
        display_name: displayName,
        connection_type: connectionType,
        tenant_id: tenantId,
        client_id: clientId,
        username,
        password,
        client_secret: clientSecret,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? 'Edytuj skrzynkę' : 'Dodaj skrzynkę'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email address */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Adres email skrzynki <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required
              placeholder="np. biuro@firma.pl"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nazwa wyświetlana
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="np. Biuro Obsługi"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Connection type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Typ połączenia <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="connectionType"
                  checked={connectionType === 'ropc'}
                  onChange={() => setConnectionType('ropc')}
                  className="text-blue-600"
                />
                <span className="text-sm text-slate-700">Login i hasło</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="connectionType"
                  checked={connectionType === 'client_credentials'}
                  onChange={() => setConnectionType('client_credentials')}
                  className="text-blue-600"
                />
                <span className="text-sm text-slate-700">OAuth2 App Registration</span>
              </label>
            </div>
          </div>

          {/* ROPC fields */}
          {connectionType === 'ropc' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Login (email) {!isEditMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isEditMode}
                  placeholder={isEditMode ? 'Pozostaw puste, aby nie zmieniać' : 'user@firma.onmicrosoft.com'}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Hasło {!isEditMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!isEditMode}
                  placeholder={isEditMode ? 'Pozostaw puste, aby nie zmieniać' : ''}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {isEditMode && (
                <p className="text-xs text-slate-500">
                  Dane logowania są zaszyfrowane. Wypełnij oba pola tylko jeśli chcesz je zmienić.
                </p>
              )}
            </>
          )}

          {/* Client credentials fields */}
          {connectionType === 'client_credentials' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={isEditMode ? 'Pozostaw puste, aby nie zmieniać' : 'Domyślny z konfiguracji'}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                {isEditMode
                  ? 'Pozostaw puste, aby zachować obecny secret'
                  : 'Pozostaw puste, aby użyć domyślnego secretu z konfiguracji'}
              </p>
            </div>
          )}

          {/* Azure configuration (optional) */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-500 mb-3">
              Konfiguracja Azure (opcjonalne)
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Domyślny z konfiguracji"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Domyślny z konfiguracji"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
              {isLoading
                ? (isEditMode ? 'Zapisywanie...' : 'Dodawanie...')
                : (isEditMode ? 'Zapisz zmiany' : 'Dodaj skrzynkę')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
