# Handoff — 2026-03-24 — Apify v1.1 fix + E2E test FB Analyzer

## Co zrobione w tej sesji

### 1. Dołączanie do grup FB (Playwright)
- **City Sfera** (WAW) — prośba wysłana, oczekuje na zatwierdzenie admina
- **Osiedle Życzliwa Praga** (WAW) — prośba wysłana, oczekuje na zatwierdzenie admina
- Konto: Anna Wolska (ana_wolska@wp.pl)
- Lekcja: zawsze weryfikować adresy/etapy osiedli przed wypełnieniem formularza (Życzliwa Praga = Białołęka, nie Praga Południe)

### 2. Naprawa kompatybilności z Apify Actor v1.1 (commit d5b51ba)
Aktor `curious_coder/facebook-post-scraper` został zaktualizowany 22.03.2026 do v1.1. Trzy breaking changes:

| Problem | Plik | Naprawa |
|---------|------|---------|
| Actor ID URL: `/` → 404 | `src/lib/fb/apify-client.ts` | Zamiana `/` na `~` (Apify API v2 wymaga tilde) |
| Input: `scrapeGroupPosts.groupUrl` usunięty | `src/types/fb.ts`, `check-cookies/route.ts`, `process/route.ts` | Nowe pole `urls: string[]` (array) |
| `maxDelay` musi być >= 10 | `check-cookies/route.ts` | Zmiana z 2 na 10 |
| `createdAt` jako Unix seconds (nie ms) | `src/lib/fb/post-mapper.ts` | Detekcja: `< 1e12` → mnóż × 1000 |

### 3. E2E test pipeline'u FB Analyzer
Pełny test na prawdziwych danych:
1. Cookies Anny Wolskiej zapisane w fb_settings (AES-256)
2. Scrape grupy Słoneczna Morena → **123 posty** pobrane z Apify
3. Naprawa dat postów (1970 → 2026) — skrypt Node.js
4. Analiza AI → **121 postów** przeanalizowanych (2 pominięte < 20 znaków)
5. Raport zbiorczy wygenerowany pomyślnie

### 4. Ulepszenia UX raportów FB (commit d5b51ba)
- Domyślnie zaznaczone **tylko grupy z postami** (nie wszystkie 52)
- Przyciski "Zaznacz wszystkie" / "Odznacz wszystkie"
- Liczba postów widoczna przy każdej grupie
- Presety dat: "Ostatnie 7 dni", "Ostatnie 30 dni", "Ostatnie 90 dni"
- API: `groupIds` (jawna lista) zamiast `excludeGroupIds`

## Status prośb o dołączenie do grup

| Grupa | Status | Data |
|-------|--------|------|
| Osiedle Słoneczna Morena (GDA) | Zaakceptowana | 2026-03-23 |
| City Sfera (WAW) | Oczekuje | 2026-03-24 |
| Osiedle Życzliwa Praga (WAW) | Oczekuje | 2026-03-24 |
| Osiedle Mój Ursus (WAW) | Niezweryfikowana | — |

## Co zostało do zrobienia

### Priorytet 1 — Dołączanie do kolejnych grup
- 49 grup pozostało (3-5 dziennie, ~10 dni)
- Sprawdzać adresy/etapy przed odpowiadaniem na pytania adminów
- Czekać na akceptację City Sfera i Życzliwa Praga

### Priorytet 2 — Operacyjne uruchomienie
- Po dołączeniu do wystarczającej liczby grup → bulk scrape + analiza
- Cookies Anny ważne ~kilka tygodni (odświeżyć jeśli Apify zwróci błąd auth)

### Priorytet 3 — Faza 11 + feedback
- Faza 11 (FB Dashboard Analytics) — po decyzji klienta
- Funkcje z feedbacku klienta

## Infrastruktura
- Dev server: port **3001** (Launchpad zajmuje 3000)
- Deploy: auto po push do master (Vercel)
- Commit: d5b51ba
