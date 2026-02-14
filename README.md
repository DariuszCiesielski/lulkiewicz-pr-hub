# Lulkiewicz PR Hub

Wewnetrzna platforma narzedzi dla agencji PR obslugujacej deweloperow nieruchomosci.

## Moduly

### Analizator Email
Pobiera wiadomosci ze skrzynek Microsoft Outlook (Microsoft Graph API), grupuje je w watki, analizuje jakosc komunikacji za pomoca AI i generuje raporty.

- **Skrzynki** — zarzadzanie skrzynkami Outlook (dodawanie, edycja, usuwanie, testowanie polaczenia)
- **Synchronizacja** — pelna i przyrostowa (delta) synchronizacja maili z Graph API
- **Watki** — automatyczne grupowanie wiadomosci w watki konwersacji
- **Analiza AI** — ocena jakosci komunikacji za pomoca OpenAI
- **Raporty** — generowanie i eksport raportow (DOCX)
- **Prompty** — zarzadzanie promptami AI

### Analizator Grup FB
Monitorowanie i analiza grup na Facebooku.

## Stack technologiczny

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4, Lucide Icons
- **Baza danych:** Supabase (PostgreSQL + Auth + RLS)
- **Email:** Microsoft Graph API + MSAL (@azure/msal-node)
- **AI:** OpenAI API
- **Eksport:** docx (generowanie dokumentow Word)
- **Deploy:** Vercel

## Wymagania

- Node.js 18+
- Konto Supabase z projektem
- Rejestracja aplikacji w Azure AD (App Registration)
- Klucz API OpenAI (opcjonalnie, do analizy AI)

## Instalacja

```bash
npm install
cp .env.local.example .env.local
# Uzupelnij zmienne srodowiskowe w .env.local
npm run dev
```

## Zmienne srodowiskowe

| Zmienna | Opis |
|---------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Klucz anonimowy Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Klucz service role (dostep admin) |
| `ENCRYPTION_KEY` | 64-znakowy hex (32 bajty) do szyfrowania AES-256-GCM |
| `AZURE_TENANT_ID` | ID tenanta Azure AD |
| `AZURE_CLIENT_ID` | ID zarejestrowanej aplikacji Azure |
| `AZURE_CLIENT_SECRET` | Client Secret aplikacji Azure |
| `OPENAI_API_KEY` | Klucz API OpenAI |

## Konfiguracja Azure AD

1. Zarejestruj aplikacje w Azure Portal > App registrations
2. Nadaj uprawnienia: `Mail.Read` (Application)
3. Kliknij "Grant admin consent"
4. Skopiuj Tenant ID, Client ID i Client Secret do `.env.local`

## Struktura projektu

```
src/
├── app/                    # Next.js App Router
│   ├── (hub)/             # Chronione strony (dashboard, email-analyzer, fb-analyzer, admin)
│   ├── (auth)/            # Logowanie, rejestracja
│   └── api/               # API routes (mailboxes, sync, threads, analysis, reports)
├── components/            # Komponenty React
│   ├── email/            # Skrzynki, watki, wiadomosci
│   ├── threads/          # Widoki watkow
│   ├── layout/           # Sidebar, header
│   └── admin/            # Panel admina
├── lib/                   # Biblioteki
│   ├── email/            # Graph API (auth, client, fetcher, parser)
│   ├── crypto/           # Szyfrowanie AES-256-GCM
│   ├── supabase/         # Klienty Supabase (client, server, admin)
│   ├── ai/               # Integracja OpenAI
│   └── export/           # Eksport DOCX
├── hooks/                # Custom React hooks
├── types/                # Typy TypeScript
├── contexts/             # React contexts (Auth, Theme)
└── config/               # Konfiguracja aplikacji
```

## Migracje bazy danych

Migracje SQL znajduja sie w `supabase/migrations/`. Wykonuj je recznie w Supabase Dashboard > SQL Editor.
