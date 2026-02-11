# Lulkiewicz PR Hub

## What This Is

Wewnętrzna platforma narzędziowa (hub) dla agencji PR Lulkiewicz, obsługującej deweloperów nieruchomości. Hub zawiera 6 aplikacji/automatyzacji (wzorzec Poltel — grid kart narzędzi). Pierwszym narzędziem jest **Analizator Komunikacji Email** — aplikacja pobierająca wiadomości ze skrzynek Outlook administracji osiedli i generująca AI raporty oceniające jakość komunikacji. Drugim narzędziem jest **Analizator Grup FB** — monitoring grup Facebookowych osiedli mieszkaniowych, wychwytywanie pozytywnych/negatywnych uwag o administracji, analiza sentymentu AI i raportowanie dla deweloperów.

## Core Value

Analizator Komunikacji Email automatycznie ściąga tysiące maili ze skrzynek administracji osiedli, grupuje je w wątki/sprawy i generuje AI-driven raport oceniający jakość, szybkość i kulturę komunikacji — dając agencji PR twarde dane do rekomendacji dla deweloperów.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Hub scaffold: login, rejestracja, sidebar, grid 6 narzędzi (1 aktywne + 5 Coming Soon)
- [ ] System ról: admin/user z kontrolą dostępu do narzędzi (wzorzec user-management-system)
- [ ] Unified Design System: 6 motywów, ThemeContext, CSS variables (wzorzec unified-design-system)
- [ ] Podłączanie skrzynek Outlook: konfiguracja połączenia (login/hasło lub OAuth)
- [ ] Jednorazowe pobranie maili ze skrzynki do bazy danych (tysiące wiadomości, paginacja)
- [ ] Parsowanie nagłówków: nadawca, odbiorca, data, temat, In-Reply-To, References
- [ ] Grupowanie maili w wątki (threading) — śledzenie spraw od zgłoszenia do rozwiązania
- [ ] AI analiza ogólna: jakość komunikacji, kultura wypowiedzi, zasady grzecznościowe
- [ ] AI analiza per wątek: czas reakcji, status sprawy (otwarta/zamknięta), skuteczność
- [ ] AI ocena: dane kontaktowe, informacje o osobach realizujących sprawę
- [ ] AI ocena: przestrzeganie RODO w treści maili
- [ ] Raport: podsumowanie co dobre + sugestie działań naprawczych
- [ ] Edytowalne prompty per sekcja raportu — domyślny szablon + pełna customizacja
- [ ] Dwa szablony raportów: wewnętrzny (pełny) i kliencki (filtrowany)
- [ ] Eksport raportu: kopiowanie do schowka, .docx, .pdf
- [ ] Wybór zakresu czasowego analizy (1-3 miesiące) z uwzględnieniem starszych otwartych spraw

### Out of Scope

- Pozostałe 4 aplikacje w hubie (tool-3..tool-6) — v2+, po walidacji Email + FB Analyzer
- Automatyczny sync maili (cron/realtime) — MVP: manualne odświeżanie
- Odpowiadanie na maile z poziomu aplikacji — tylko analiza read-only
- Integracja z innymi dostawcami poczty (Gmail, Yahoo) — na razie tylko Outlook
- Multi-tenancy z wieloma organizacjami — jedna instancja dla Lulkiewicz PR
- Publiczny landing page — narzędzie wewnętrzne, tylko login
- Wielojęzyczność — tylko PL
- Mobile app — web-first, responsive

## Context

- **Klient:** Lulkiewicz PR — agencja PR specjalizująca się w obsłudze deweloperów nieruchomości
- **Użytkownicy:** Zespół Lulkiewicz PR (kilka osób, każdy z kontem)
- **Problem:** Agencja musi regularnie oceniać jakość komunikacji administracji osiedli z mieszkańcami. Ręczna analiza tysięcy maili jest niewykonalna.
- **Skrzynki:** 3 skrzynki Outlook, po kilka tysięcy maili każda. Dostęp przez login/hasło. Typ skrzynki (O365 vs on-premise) do ustalenia z administratorem.
- **Raporty:** Trafiają zarówno do wewnętrznego zespołu PR (wersja pełna), jak i do klienta-dewelopera (wersja filtrowana)
- **Wzorzec Poltel:** Hub z gridiem kart narzędzi, każde narzędzie jako osobna "apka" w ramach jednej aplikacji
- **Globalne skille do reuse:**
  - `unified-design-system` — 6 motywów, ThemeContext, CSS variables, UserMenu
  - `user-management-system` — admin/user, AuthContext, canAccessTool(), panel admina
  - `admin-panel-scaffold` — routing, sidebar, header, protected routes
  - `brand-elements` — favicon, Footer
  - `supabase-auth-rls` — SECURITY DEFINER, RLS policies

## Infrastructure

| Service | Name | URL / ID |
|---------|------|----------|
| GitHub | lulkiewicz-pr-hub | https://github.com/DariuszCiesielski/lulkiewicz-pr-hub |
| Vercel | lulkiewicz-pr-hub | Project ID: `prj_plqtl56Fo28Jlr3PNXKFozq2E91s` |
| Supabase | TBD | TBD — EU region (Frankfurt) wymagany dla GDPR |

- **Branch:** `master`
- **Auto-deploy:** GitHub → Vercel (połączony)
- **Vercel Team:** `team_wump0nNx40hMZqj8aowjblSw`

## Constraints

- **Stack**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + DB + RLS), Vercel
- **Design**: Unified Design System (6 motywów, domyślny: Szkło/Glass), CSS custom properties
- **AI**: OpenAI (domyślnie GPT-4o), multi-model opcja (Anthropic/Google)
- **Email access**: Microsoft Graph API (OAuth) dla O365 lub IMAP dla on-premise — do ustalenia po konsultacji z administratorem
- **Bezpieczeństwo**: Klucze API szyfrowane, dane email w Supabase z RLS, uwaga na RODO (dane osobowe w mailach)
- **Deploy**: Vercel (frontend + API routes) + Supabase managed (DB)
- **Język UI**: Polski
- **Timeout Vercel**: API routes max 60s (Pro) — email sync musi być paginowany/batchowany

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js (nie Vite jak Poltel) | Potrzebne API routes do server-side email fetching i AI processing | — Pending |
| Hub pattern (wzorzec Poltel) | Rozszerzalność — 6 narzędzi w gridzie, dodawanie kolejnych bez refactoring | — Pending |
| Unified Design System (6 motywów) | Sprawdzony wzorzec z globalnych skilli, spójny wygląd | — Pending |
| OpenAI default + multi-model | GPT-4o dobry do analizy tekstu, opcja zmiany providera na przyszłość | — Pending |
| Dwa szablony raportów | Agencja potrzebuje pełnego raportu wewnętrznego i okrojonego dla klienta | — Pending |
| Edytowalne prompty per sekcja | Każdy raport może wymagać innej struktury — elastyczność bez zmian w kodzie | — Pending |
| Email sync batchowany | Vercel timeout 60s, tysiące maili — konieczna paginacja | — Pending |
| FB Analyzer: Apify bez n8n | Pełna kontrola z PR Hub, bez pośredników. Apify Actor: curious_coder/facebook-post-scraper | — Pending |
| FB Analyzer: Supabase only (bez Airtable) | Jeden storage, prostsze, spójne z resztą projektu | — Pending |
| FB Analyzer: Reuse ai-provider.ts | Ten sam system AI co email-analyzer, wspólna konfiguracja | — Pending |

## Current Milestone: v1.1 Analizator Grup FB

**Goal:** Monitoring grup Facebookowych osiedli mieszkaniowych — wychwytywanie pozytywnych/negatywnych uwag o administracji, analiza sentymentu AI, raportowanie dla deweloperów.

**Target features:**
- Zarządzanie grupami FB (CRUD)
- Scrapowanie postów z grup przez Apify Actor API
- Przeglądanie postów z filtrami (sentyment, relevance, data, grupa)
- Analiza AI sentymentu (positive/negative/neutral + relevance + categories)
- Dashboard z KPI i alertami o negatywnych postach
- Generowanie raportów AI + eksport DOCX

---
*Last updated: 2026-02-11 — started milestone v1.1 FB Analyzer*
