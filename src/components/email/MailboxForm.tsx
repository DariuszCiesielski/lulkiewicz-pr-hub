'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ConnectionType, AnalysisProfileId, CcFilterMode, MailboxFormData } from '@/types/email';

interface ProfileOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface MailboxEditData {
  id: string;
  email_address: string;
  display_name: string | null;
  connection_type: ConnectionType;
  tenant_id: string;
  client_id: string;
  analysis_profile: AnalysisProfileId;
  default_profile_id: string | null;
  cc_filter_mode: CcFilterMode;
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
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialData?.default_profile_id ?? ''
  );
  const [ccFilterMode, setCcFilterMode] = useState<CcFilterMode>(
    initialData?.cc_filter_mode ?? 'off'
  );

  // Fetch profiles from API
  useEffect(() => {
    fetch('/api/analysis-profiles')
      .then((res) => res.json())
      .then((data) => {
        const profiles: ProfileOption[] = (data.profiles || []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          slug: p.slug as string,
          name: p.name as string,
          description: p.description as string | null,
        }));
        setProfileOptions(profiles);
        // Set default selection if not editing
        if (!selectedProfileId && profiles.length > 0) {
          const defaultProfile = profiles.find((p) => p.slug === 'communication_audit') || profiles[0];
          setSelectedProfileId(defaultProfile.id);
        }
      })
      .catch(() => {
        // Fallback if API fails
        setProfileOptions([
          { id: '', slug: 'communication_audit', name: 'Audyt komunikacji', description: '13 sekcji oceny jakości komunikacji (domyślny)' },
          { id: '', slug: 'case_analytics', name: 'Analityka spraw', description: 'Lokalizacje, etapy, typy zgłoszeń, problemy' },
        ]);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProfile = profileOptions.find((p) => p.id === selectedProfileId);
  const selectedSlug = (selectedProfile?.slug || 'communication_audit') as AnalysisProfileId;

  const handleProfileChange = (newProfileId: string) => {
    setSelectedProfileId(newProfileId);
    const profile = profileOptions.find((p) => p.id === newProfileId);
    setCcFilterMode(profile?.slug === 'case_analytics' ? 'never_in_to' : 'off');
  };
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
        analysis_profile: selectedSlug,
        default_profile_id: selectedProfileId || undefined,
        cc_filter_mode: ccFilterMode,
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

          {/* Analysis profile */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Profil analizy
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {profileOptions.map((opt) => (
                <option key={opt.id || opt.slug} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
            {selectedProfile?.description && (
              <p className="mt-1 text-xs text-slate-500">
                {selectedProfile.description}
              </p>
            )}
          </div>

          {/* CC filter mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Filtrowanie wątków CC
            </label>
            <select
              value={ccFilterMode}
              onChange={(e) => setCcFilterMode(e.target.value as CcFilterMode)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="off">Wyłączone</option>
              <option value="never_in_to">Pomiń — nigdy w polu &quot;Do&quot;</option>
              <option value="first_email_cc">Pomiń — pierwszy mail jako DW</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Pomijaj wątki, w których skrzynka jest tylko odbiorcą DW/UDW. Przydatne dla skrzynek rzeczników.
            </p>
          </div>

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
