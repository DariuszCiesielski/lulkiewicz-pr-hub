# Phase 8: Group Management - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

CRUD grup FB do monitorowania, status active/paused, konfiguracja credentiali Apify (token szyfrowany + FB cookies). Obejmuje formularz dodawania (pojedynczo + bulk), widok listy grup, edycje, soft delete, operacje bulk oraz strone ustawien z Apify token + cookies. Scraping engine to Phase 9 — tutaj tylko zarzadzanie grupami i credentialami.

</domain>

<decisions>
## Implementation Decisions

### Formularz grupy — dodawanie
- Dwa tryby dodawania: reczne (formularz) + upload pliku z URL-ami
- Upload: plik z URL-ami (jeden per linia), system parsuje i tworzy grupy
- Po dodaniu/uploadzie user moze edytowac nazwe i dewelopera per grupa
- Pola formularza: nazwa, facebook_url, developer, instrukcja AI (co wyszukiwac)
- Czestotliwosc scrapowania: manual only (MVP) — cron w przyszlych fazach

### Instrukcja AI (co wyszukiwac)
- Globalna instrukcja per deweloper + mozliwosc override per grupa
- Pole tekstowe na slowa kluczowe / opis co AI ma szukac w postach
- Domyslna instrukcja dziedziczona z poziomu dewelopera, nadpisywalna per grupa

### Developer (przypisanie dewelopera)
- Zwykle jeden deweloper per lista grup, ale moze byc wielu
- Free text z autosuggest z historii (bez osobnej tabeli developers)
- Grupy grupowane w widoku listy per deweloper (sekcje z naglowkami)

### Actor Apify
- Domyslnie `curious_coder/facebook-post-scraper` — pole `apify_actor_id` w DB
- Edytowalny TYLKO przez super admina (hardcoded email: dariusz.ciesielski.71@gmail.com)
- Nie widoczny dla zwyklych adminow — ukryte ustawienie zaawansowane

### Credentiale — Apify token
- Jeden globalny Apify API token dla calej aplikacji
- Szyfrowany AES-256-GCM (reuse encrypt.ts)
- Przechowywany w ustawieniach FB Analyzera (nie per grupa)

### Credentiale — FB cookies
- Dwa sposoby podawania: wklej tekst LUB upload plik JSON
- Scope: globalny zestaw cookies + mozliwosc override per grupa
- Szyfrowane w bazie (reuse encrypt.ts)
- Alert w UI gdy scrapowanie failuje z powodu wygaslych cookies

### Widok listy grup
- Layout: tabela (nie karty)
- Grupowanie: sekcje per deweloper z naglowkami
- Informacje per wiersz: nazwa, deweloper, status, data ostatniego scrape'a, liczba postow, liczba istotnych postow, ostatnia analiza
- Filtrowanie: prosty filtr po deweloperze + status (active/paused)
- Brak sortowania (sekcje per deweloper wystarczaja)

### Status i cykl zycia
- **Active**: grupa monitorowana, scraping dozwolony
- **Paused**: grupa w bazie, nie scrapowana, istniejace posty zachowane, nowe nie pobierane
- **Soft delete**: grupa oznaczona jako usunieta, dane zachowane, mozliwosc przywrocenia
- Edycja grupy: modal (nie osobna strona)

### Operacje bulk
- Pelny bulk: zmiana statusu + soft delete + przypisanie dewelopera
- Zaznaczanie checkboxami w tabeli, akcje w toolbarze nad tabela

### Claude's Discretion
- Dokladna struktura migracji DB (nowe kolumny: ai_instruction, deleted_at, cookies per group)
- Layout modala edycji i formularza dodawania
- Implementacja parsera URL-i z pliku
- Sposob przechowywania globalnych ustawien (nowa tabela vs istniejaca)
- Walidacja URL-i grup FB
- UX alertu o wygaslych cookies

</decisions>

<specifics>
## Specific Ideas

- User chce podawac "ogolna instrukcje" ktora pozniej przetworzy AI — nie tylko slowa kluczowe, ale tez opis w naturalnym jezyku
- Wzorzec z email-analyzer: mailboxes page z tabelka + modal dodawania — ale tu bardziej rozbudowany (bulk, sekcje per deweloper)
- Upload pliku z URL-ami to wazny feature — user czesto dostaje liste grup od klienta
- Super admin (hardcoded email) = jedyna osoba mogaca zmieniac Actora Apify i widziec zaawansowane ustawienia

</specifics>

<deferred>
## Deferred Ideas

- Automatyczne scrapowanie (cron/scheduled) — Phase 9 lub osobna faza
- Dashboard z alertami o cookies — Phase 11 (Dashboard)
- Statystyki per deweloper (ile grup, ile postow, trend) — Phase 11

</deferred>

---

*Phase: 08-group-management*
*Context gathered: 2026-02-12*
