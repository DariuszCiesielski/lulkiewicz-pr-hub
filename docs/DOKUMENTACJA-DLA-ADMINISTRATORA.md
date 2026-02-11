# Lulkiewicz PR Hub — Dokumentacja techniczna dla administratora IT

## 1. Czym jest ta aplikacja?

Lulkiewicz PR Hub to wewnetrzna aplikacja webowa sluzaca do **analizy jakosci komunikacji email** pomiedzy administracja osiedli a mieszkancami. Aplikacja:

1. **Pobiera emaile** ze wskazanych skrzynek Outlook (Microsoft 365)
2. **Analizuje tresc** wiadomosci pod katem jakosci komunikacji
3. **Generuje raporty** podsumowujace komunikacje

## 2. Jak aplikacja uzyskuje dostep do poczty?

Aplikacja korzysta z **Microsoft Graph API** w trybie **Client Credentials** (OAuth 2.0):

- Aplikacja **NIE loguje sie** jako uzytkownik
- Aplikacja **NIE zna** hasel uzytkownikow
- Aplikacja uwierzytelnia sie wlasnym kluczem tajnym (Client Secret) powiazanym z rejestracja w Azure AD
- Dostep jest kontrolowany przez administratora IT na poziomie Exchange Online

### Schemat dzialania

```
┌──────────────────┐    Client Secret     ┌──────────────────┐
│   Lulkiewicz     │ ──────────────────►  │   Azure AD       │
│   PR Hub         │ ◄──────────────────  │   (Entra ID)     │
│   (serwer)       │    Access Token      │                  │
└──────┬───────────┘                      └──────────────────┘
       │
       │  Token + zadanie: "pobierz emaile z biuro@osiedle.pl"
       ▼
┌──────────────────┐                      ┌──────────────────┐
│  Microsoft       │ ──── sprawdza ────►  │  Exchange Online │
│  Graph API       │      uprawnienia     │  (RBAC / Policy) │
│                  │ ◄──────────────────  │                  │
└──────────────────┘   OK / Odmowa        └──────────────────┘
```

### Co aplikacja moze robic?

- **Odczytywac** wiadomosci email (naglowki, tresc, zalaczniki — tylko metadata)
- **NIE moze** wysylac, usuwac, modyfikowac ani przekierowywac wiadomosci
- **NIE moze** czytac kalendarza, kontaktow ani innych danych

### Co aplikacja NIE robi?

- NIE przechowuje hasel uzytkownikow
- NIE loguje sie na konta uzytkownikow
- NIE ma dostepu do skrzynek ktore nie zostaly jawnie zatwierdzone
- NIE przekazuje danych osobowych w formie jawnej na zewnatrz
- NIE udostepnia danych osobowych w raportach — sa automatycznie anonimizowane

## 3. Bezpieczenstwo danych

| Element | Zabezpieczenie |
|---------|---------------|
| Client Secret | Przechowywany w zmiennych srodowiskowych serwera (nigdy w kodzie) |
| Dane logowania do skrzynek | Szyfrowane algorytmem AES-256-GCM (standard bankowy) |
| Tokeny dostepu | Nie sa przechowywane — pobierane na swiezo przed kazdym uzyciem, wygasaja po ~1h |
| Baza danych | Supabase z Row Level Security (RLS), region EU (eu-north-1) |
| Komunikacja | Wylacznie HTTPS/TLS |
| Dostep do aplikacji | Tylko autoryzowani uzytkownicy (lista kontrolowana przez admina aplikacji) |
| Dane osobowe | Automatycznie anonimizowane przed przetworzeniem przez AI (patrz sekcja ponizej) |

## 3a. Ochrona danych osobowych i anonimizacja

Wiadomosci email moga zawierac dane osobowe (imiona, nazwiska, adresy, numery telefonow, adresy email mieszkancow). Aplikacja stosuje nastepujace zabezpieczenia:

### Przechowywanie danych
- Pobrane emaile sa przechowywane w zaszyfrowanej bazie danych w regionie EU (Sztokholm)
- Dostep do bazy chroniony jest przez Row Level Security — tylko administrator aplikacji widzi dane
- Dane NIE sa udostepniane publicznie ani osobom trzecim

### Anonimizacja przed analiza AI
- **Przed wyslaniem tresci emaili do modelu AI**, dane osobowe sa automatycznie anonimizowane
- Anonimizacja obejmuje: imiona i nazwiska, adresy email, numery telefonow, adresy zamieszkania, numery PESEL i inne identyfikatory
- Model AI otrzymuje wylacznie zanonimizowana tresc — nie ma dostepu do danych pozwalajacych na identyfikacje osob
- Wygenerowane raporty **nie zawieraja danych osobowych** — uzywaja zanonimizowanych identyfikatorow (np. "Mieszkaniec #1", "Pracownik #3")

### Zgodnosc z RODO
- Przetwarzanie danych odbywa sie na podstawie prawnie uzasadnionego interesu administratora danych (art. 6 ust. 1 lit. f RODO)
- Dane sa przetwarzane wylacznie w celu analizy jakosci komunikacji
- Minimalizacja danych: pobierane sa tylko naglowki i tresc wiadomosci (bez zalacznikow)
- Dane moga byc usuniete na zadanie (prawo do usunięcia)

## 4. Kontrola dostepu do skrzynek — opcje konfiguracji

Administrator IT ma **pelna kontrole** nad tym, do jakich skrzynek aplikacja ma dostep. Ponizej dwie opcje — od rekomendowanej do najprostszej.

---

### OPCJA A: RBAC for Applications (rekomendowana)

Najnowsze rozwiazanie Microsoft (2024+). **Nie wymaga nadawania uprawnien na poziomie calej organizacji.**

**Zalety:**
- Zero uprawnien na poziomie organizacji w Azure Portal
- Pelna kontrola w Exchange Online
- Latwe dodawanie/usuwanie skrzynek
- Aktywnie wspierane przez Microsoft

**Konfiguracja (PowerShell):**

```powershell
# 1. Polacz sie z Exchange Online
Install-Module ExchangeOnlineManagement  # jesli nie zainstalowany
Connect-ExchangeOnline

# 2. Zarejestruj Service Principal aplikacji
#    AppId = Identyfikator aplikacji (klienta): 66d8820b-7d74-4130-8133-b64106ee99dc
#    ObjectId = ID obiektu z Aplikacje dla przedsiebiorstw (Enterprise Applications)
New-ServicePrincipal -AppId "66d8820b-7d74-4130-8133-b64106ee99dc" `
  -DisplayName "Lulkiewicz PR Hub"

# 3. Utworz zakres (scope) — lista skrzynek do ktorych aplikacja ma dostep
#    Opcja A: Filtr po atrybucie
New-ManagementScope -Name "Lulkiewicz Mailboxes" `
  -RecipientRestrictionFilter "CustomAttribute1 -eq 'LulkiewiczPRHub'"

#    Opcja B: Filtr po grupie (jesli skrzynki sa w grupie bezpieczenstwa)
# New-ManagementScope -Name "Lulkiewicz Mailboxes" `
#   -RecipientRestrictionFilter "MemberOfGroup -eq 'CN=NazwaGrupy,...'"

# 4. Przypisz role TYLKO do odczytu poczty, TYLKO w tym zakresie
New-ManagementRoleAssignment `
  -App "66d8820b-7d74-4130-8133-b64106ee99dc" `
  -Role "Application Mail.Read" `
  -CustomResourceScope "Lulkiewicz Mailboxes"

# 5. Oznacz skrzynki ktore maja byc dostepne
#    (dla kazdej skrzynki ktora ma byc dostepna):
Set-Mailbox -Identity "biuro@osiedle1.pl" -CustomAttribute1 "LulkiewiczPRHub"
Set-Mailbox -Identity "admin@osiedle2.pl" -CustomAttribute1 "LulkiewiczPRHub"

# 6. Przetestuj dostep
Test-ServicePrincipalAuthorization `
  -Identity "Lulkiewicz PR Hub" `
  -Resource "biuro@osiedle1.pl"
# Oczekiwany wynik: AccessCheckResult = Granted

Test-ServicePrincipalAuthorization `
  -Identity "Lulkiewicz PR Hub" `
  -Resource "inna.osoba@tagpolska.pl"
# Oczekiwany wynik: AccessCheckResult = Denied
```

**Dodawanie nowej skrzynki w przyszlosci:**
```powershell
Set-Mailbox -Identity "nowa.skrzynka@osiedle3.pl" -CustomAttribute1 "LulkiewiczPRHub"
```

**Usuwanie dostepu:**
```powershell
Set-Mailbox -Identity "stara.skrzynka@osiedle1.pl" -CustomAttribute1 $null
```

**Uwaga:** Zmiany uprawnien sa aktywne po 30 minut — 2 godziny (cache Exchange Online).

---

### OPCJA B: Application Access Policy (prostsza, ale przestarzala)

Wymaga nadania uprawnienia Mail.Read (Aplikacja) w Azure Portal + ograniczenie przez polityke w Exchange Online.

**Konfiguracja:**

Krok 1 — W Azure Portal (Entra ID):
1. Rejestracje aplikacji → "n8n" → Uprawnienia interfejsu API
2. Kliknij "Wyraz zgode administratora dla katalogu TAG Polska"

Krok 2 — W Exchange Online (PowerShell):
```powershell
Connect-ExchangeOnline

# Utworz grupe bezpieczenstwa z dozwolonymi skrzynkami
New-DistributionGroup -Name "Lulkiewicz Mail Access" `
  -Type Security `
  -Members biuro@osiedle1.pl, admin@osiedle2.pl

# Utworz polityke ograniczajaca aplikacje
New-ApplicationAccessPolicy `
  -AppId "66d8820b-7d74-4130-8133-b64106ee99dc" `
  -PolicyScopeGroupId "Lulkiewicz Mail Access" `
  -AccessRight RestrictAccess `
  -Description "Dostep tylko do skrzynek osiedlowych"

# Przetestuj
Test-ApplicationAccessPolicy `
  -AppId "66d8820b-7d74-4130-8133-b64106ee99dc" `
  -Identity biuro@osiedle1.pl
# Oczekiwany: AccessCheckResult = Granted

Test-ApplicationAccessPolicy `
  -AppId "66d8820b-7d74-4130-8133-b64106ee99dc" `
  -Identity inna.osoba@tagpolska.pl
# Oczekiwany: AccessCheckResult = Denied
```

---

## 5. Dane aplikacji w Azure

| Parametr | Wartosc |
|----------|---------|
| Nazwa rejestracji | n8n |
| Identyfikator aplikacji (klienta) | `66d8820b-7d74-4130-8133-b64106ee99dc` |
| Identyfikator katalogu (dzierzawy) | `7493afc7-fd28-439b-bd21-814705ec39a6` |
| Wymagane uprawnienie | `Mail.Read` (tylko odczyt) |
| Typ uprawnienia | Aplikacja (nie delegowane) |

## 6. Dokumentacja Microsoft

- **Ograniczanie dostepu aplikacji do skrzynek:**
  https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access

- **RBAC for Applications w Exchange Online:**
  https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac

- **Microsoft Graph API — uprawnienia poczty:**
  https://learn.microsoft.com/en-us/graph/permissions-reference#mail-permissions

## 7. FAQ

**P: Czy aplikacja moze czytac moja prywatna poczte?**
O: Nie, jesli administrator skonfiguruje ograniczenie (RBAC lub Application Access Policy). Aplikacja bedzie miala dostep WYLACZNIE do skrzynek jawnie dodanych do listy.

**P: Czy aplikacja moze wysylac emaile w moim imieniu?**
O: Nie. Aplikacja ma uprawnienie Mail.Read (tylko odczyt). Nie ma uprawnienia Mail.Send ani Mail.ReadWrite.

**P: Gdzie sa przechowywane dane?**
O: W bazie danych Supabase w regionie EU (eu-north-1, Sztokholm). Dane nie sa przekazywane poza UE.

**P: Kto ma dostep do aplikacji?**
O: Tylko uzytkownicy dodani do listy przez administratora aplikacji. Dostep jest chroniony logowaniem (Supabase Auth) i systemem rol (admin/user).

**P: Co sie stanie jesli Client Secret wygasnie?**
O: Aplikacja przestanie moc pobierac emaile. Administrator musi wygenerowac nowy Client Secret w Azure Portal i zaktualizowac go w konfiguracji aplikacji.

**P: Czy AI widzi dane osobowe z maili?**
O: Nie. Przed wyslaniem tresci do modelu AI, dane osobowe (imiona, nazwiska, adresy, telefony, emaile) sa automatycznie anonimizowane. AI otrzymuje tresc w formie np. "Mieszkaniec #1 napisal do Pracownik #3". Raporty rowniez nie zawieraja danych osobowych.

**P: Czy aplikacja jest zgodna z RODO?**
O: Tak. Dane sa przechowywane w EU (Sztokholm), anonimizowane przed analiza AI, minimalizowane (tylko naglowki i tresc, bez zalacznikow) i moga byc usuniete na zadanie.
