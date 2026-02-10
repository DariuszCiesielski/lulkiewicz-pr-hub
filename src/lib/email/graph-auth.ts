import {
  PublicClientApplication,
  ConfidentialClientApplication,
  type AuthenticationResult,
} from '@azure/msal-node';
import type { MailboxCredentials } from '@/types/email';

/**
 * Get Microsoft Graph API access token using MSAL.
 * Supports ROPC (username/password) and client_credentials flows.
 *
 * IMPORTANT: Authority URL must use tenant ID, not 'common' — ROPC does not work with 'common'.
 * IMPORTANT: Do not store tokens in DB — they expire in ~3600s. Acquire fresh token before each sync batch.
 */
export async function getAccessToken(credentials: MailboxCredentials): Promise<string> {
  let result: AuthenticationResult | null = null;

  if (credentials.type === 'ropc') {
    const pca = new PublicClientApplication({
      auth: {
        clientId: credentials.clientId,
        authority: `https://login.microsoftonline.com/${credentials.tenantId}`,
      },
    });

    try {
      result = await pca.acquireTokenByUsernamePassword({
        scopes: ['https://graph.microsoft.com/Mail.Read'],
        username: credentials.username,
        password: credentials.password,
      });
    } catch (error: unknown) {
      throw new Error(parseGraphAuthError(error));
    }
  } else if (credentials.type === 'client_credentials') {
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        authority: `https://login.microsoftonline.com/${credentials.tenantId}`,
      },
    });

    try {
      result = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });
    } catch (error: unknown) {
      throw new Error(parseGraphAuthError(error));
    }
  }

  if (!result?.accessToken) {
    throw new Error('Nie udalo sie uzyskac tokenu dostepu — odpowiedz MSAL jest pusta.');
  }

  return result.accessToken;
}

/**
 * Parse MSAL/Azure AD error codes into Polish error messages.
 * Maps AADSTS error codes to human-readable descriptions.
 */
export function parseGraphAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // MFA required
  if (message.includes('AADSTS50076') || message.includes('AADSTS50079')) {
    return 'Konto wymaga uwierzytelniania wieloskladnikowego (MFA). Uzyj trybu client_credentials lub wylacz MFA dla tego konta.';
  }

  // Invalid credentials
  if (message.includes('AADSTS50126')) {
    return 'Nieprawidlowy login lub haslo. Sprawdz dane logowania i sprobuj ponownie.';
  }

  // Account not found
  if (message.includes('AADSTS50034')) {
    return 'Konto nie istnieje w tym tenancie. Sprawdz adres email i Tenant ID.';
  }

  // Invalid client ID
  if (message.includes('AADSTS700016')) {
    return 'Nieprawidlowy Client ID. Sprawdz identyfikator aplikacji w Azure Portal.';
  }

  // Missing permission
  if (message.includes('AADSTS65001')) {
    return 'Brak uprawnienia Mail.Read. Dodaj uprawnienie w Azure Portal -> App registrations -> API permissions.';
  }

  // Invalid client secret
  if (message.includes('AADSTS7000215')) {
    return 'Nieprawidlowy Client Secret. Sprawdz sekret aplikacji w Azure Portal.';
  }

  // Tenant not found
  if (message.includes('AADSTS90002')) {
    return 'Tenant nie zostal znaleziony. Sprawdz Tenant ID w Azure Portal.';
  }

  // ROPC disabled
  if (message.includes('AADSTS7000218')) {
    return 'Przeplyw ROPC jest wylaczony. Wlacz Public Client flows w Azure Portal -> App registrations -> Authentication.';
  }

  // Default
  return `Blad autentykacji: ${message}`;
}
