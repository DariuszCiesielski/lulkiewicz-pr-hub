---
phase: 09-scraping-engine
verified: 2026-02-23T12:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - Pre-scrape cookie health check (POST /api/fb/scrape/check-cookies + hook integration + ScrapeProgress rendering)
  gaps_remaining: []
  regressions: []
---

# Phase 9: Scraping Engine - Raport Weryfikacji

**Phase Goal:** Admin moze scrapowac posty z grup FB przez Apify Actor z widocznym progressem, ochrona konta i obsluga bledow
**Verified:** 2026-02-23T12:00:00Z
**Status:** passed
**Re-verification:** Tak - po zamknieciu luki z planu 09-04

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Admin klika Scrapuj na aktywnej grupie - Apify Actor run startuje, progress bar pokazuje status, posty pojawiaja sie w DB | VERIFIED | useScrapeJob -> POST /api/fb/scrape -> pollScrapeProcess -> /api/fb/scrape/process MODE 1-3 -> upsert fb_posts (brak regresji) |
| 2 | Posty sa deduplikowane (upsert ON CONFLICT) - ponowne scrapowanie aktualizuje istniejace posty | VERIFIED | process/route.ts:321-322 onConflict: group_id,facebook_post_id ignoreDuplicates: false (brak regresji) |
| 3 | Scrapowanie wielu grup wymusza min. 3-minutowy odstep z losowymi opoznieniami - UI informuje o kolejce | VERIFIED | MIN_DELAY_MS=180000, MAX_DELAY_MS=360000 w useScrapeJob.ts:11-12; countdown sekundnik w ScrapeProgress (brak regresji) |
| 4 | Bledy scrapowania sa wyswietlane w UI z opisem i sugestia, system proponuje retry | VERIFIED | SCRAPE_ERROR_MESSAGES (7 wpisow PL); ScrapeProgress error state z error.message + error.suggestion + Sprobuj ponownie (brak regresji) |
| 5 | Przed scrapowaniem wykonywany jest cookie health check - jesli cookies wygasly, user widzi alert z instrukcja | VERIFIED | POST /api/fb/scrape/check-cookies (187 linii); status=cookie_check w hook linia 197; ScrapeProgress: spinner Sprawdzanie cookies Facebook... + zloty alert Kontynuuj mimo to / Anuluj |

**Score:** 5/5 prawd zweryfikowanych

---
### Required Artifacts

#### Artefakty z planu 09-04 (nowe/zmodyfikowane)

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| src/app/api/fb/scrape/check-cookies/route.ts | POST endpoint cookie health check | VERIFIED | 187 linii; exports POST; verifyAdmin + getAdminClient; import apify-client (5 funkcji); zwraca { success, postsFound }; 45s poll timeout; 400 dla NO_TOKEN/NO_COOKIES |
| src/hooks/useScrapeJob.ts | Status cookie_check + wywolanie check-cookies | VERIFIED | 487 linii; cookieCheckWarning state + skipCookieCheckRef + cookieCheckGroupRef; setStatus(cookie_check) linia 197; fetch /api/fb/scrape/check-cookies linia 201; proceedAfterWarning callback linia 449; reset czysci state linia 470-472 |
| src/components/fb/ScrapeProgress.tsx | Renderowanie stanu cookie_check i alarmu | VERIFIED | 354 linie; props cookieCheckWarning+onProceedAnyway linia 12-13; spinner linia 33-50; zloty alert Kontynuuj mimo to linia 53-96 |
| src/app/(hub)/fb-analyzer/groups/page.tsx | Destrukturyzacja nowych props + przekazanie | VERIFIED | Linia 38-39 destrukturyzuje cookieCheckWarning+proceedAfterWarning; linia 374 warunek show wlacza cookieCheckWarning; linia 381-382 przekazuje props |

#### Artefakty z poprzednich planow (regresja check)

| Artifact | Linie | Status |
| --- | --- | --- |
| src/lib/fb/apify-client.ts | 123 | OK - brak regresji |
| src/lib/fb/post-mapper.ts | 156 | OK - brak regresji |
| src/app/api/fb/scrape/route.ts | 135 | OK - brak regresji |
| src/app/api/fb/scrape/process/route.ts | 516 | OK - brak regresji |
| src/components/fb/ScrapeButton.tsx | 62 | OK - brak regresji |

---

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| useScrapeJob.ts | /api/fb/scrape/check-cookies | fetch POST linia 201 | WIRED | setStatus(cookie_check) przed wywolaniem; odpowiedz sprawdzana (success, postsFound) |
| useScrapeJob.ts | /api/fb/scrape | fetch POST linia 255 | WIRED | Wywolywany po zakonczeniu cookie check lub gdy skipCookieCheckRef=true |
| ScrapeProgress.tsx | ScrapeUIStatus cookie_check | if(status===cookie_check) linia 33 | WIRED | Renderuje spinner Sprawdzanie cookies Facebook... |
| ScrapeProgress.tsx | cookieCheckWarning prop | if(cookieCheckWarning && status===idle) linia 53 | WIRED | Renderuje zloty alert z przyciskami Kontynuuj/Anuluj |
| groups/page.tsx | useScrapeJob | destrukturyzacja linia 38-39 | WIRED | cookieCheckWarning+proceedAfterWarning przekazywane do ScrapeProgress; warunek show linia 374 |
| proceedAfterWarning | startScrape | skipCookieCheckRef.current=true linia 453 | WIRED | Restartuje scrape pomijajac check; cookieCheckGroupRef przechowuje docelowa grupe |

---
### Requirements Coverage

| Requirement | Status | Blocking Issue |
| --- | --- | --- |
| FBSCR-01: Admin moze scrapowac grupe | SATISFIED | Pelny pipeline zaimplementowany; brak regresji |
| FBSCR-02: Deduplication upsert | SATISFIED | ON CONFLICT group_id,facebook_post_id; brak regresji |
| FBSCR-03: Rate limiting min. 3 min | SATISFIED | MIN_DELAY_MS = 180000 (3 min); brak regresji |
| FBSCR-04: Error handling z sugestia | SATISFIED | SCRAPE_ERROR_MESSAGES 7 wpisow + ScrapeProgress error state z retry; brak regresji |
| FBSCR-05: Cookie health check | SATISFIED | Pre-scrape check-cookies endpoint + hook integration + ScrapeProgress rendering - ZAMKNIETE planem 09-04 |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| src/app/api/fb/scrape/process/route.ts | logRawPostSample w produkcji | Warning | Debug helper loguje surowe dane Apify na konsole przy pierwszym scrapowaniu - istnial przed planem 09-04, brak regresji |

Brak nowych anti-patternow wprowadzonych przez plan 09-04.

---

### Human Verification Required

#### 1. Pre-scrape cookie health check flow (sukces)

**Test:** Skonfiguruj wazne FB cookies, kliknij Scrapuj dla jednej aktywnej grupy.
**Expected:** ScrapeProgress pokazuje Sprawdzanie cookies Facebook... z zlotym spinnerem przez do 45s, nastepnie przechodzi do Rozpoczynanie scrapowania... bez interakcji uzytkownika.
**Why human:** Wymaga realnego Apify run z waznym tokenem i cookies FB.

#### 2. Cookie health check flow (wygasle cookies)

**Test:** Skonfiguruj wygasle lub nieprawidlowe cookies, kliknij Scrapuj.
**Expected:** Spinner cookie check -> zloty alert Sprawdzanie cookies nie powiodlo sie -> przyciski Kontynuuj mimo to i Anuluj. Klikniecie Kontynuuj mimo to startuje scrape bez ponownego check.
**Why human:** Wymaga wygaslych cookies lub grupy bez postow dzis (false positive mozliwy - uzytkownik powinien to wiedziec).

#### 3. Pelny flow scraping end-to-end

**Test:** Po prawidlowym cookie check, obserwuj caly flow do zakonczenia.
**Expected:** cookie_check -> starting -> running (apifyStatus RUNNING) -> downloading (liczniki postow) -> completed. Posty widoczne w bazie.
**Why human:** Wymaga realnego Apify run z waznym tokenem i cookies FB.

#### 4. Bulk scrape - cookie check pomijany

**Test:** Wybierz 2 grupy, kliknij Scrapuj wybrane (2).
**Expected:** Brak etapu cookie_check dla bulk (celowa decyzja projektowa). Po zakonczeniu pierwszej grupy ScrapeProgress pokazuje countdown 3-6 minut. Druga grupa startuje dopiero po odczekaniu.
**Why human:** Countdown wymaga realnego oczekiwania 3-6 minut.

---

### Podsumowanie Re-Weryfikacji

Plan 09-04 zamknal ostatnia luke z weryfikacji poczatkowej. Jeden plik stworzony i trzy zmodyfikowane:

**Nowy plik:** src/app/api/fb/scrape/check-cookies/route.ts (187 linii) - pelna implementacja z pollingiem Apify (petla do 45s), obsluga timeoutu, obsluga bledu braku konfiguracji (NO_TOKEN, NO_COOKIES z SCRAPE_ERROR_MESSAGES).

**Zmodyfikowane pliki:**

- src/hooks/useScrapeJob.ts: dodano pre-scrape cookie check z setStatus(cookie_check), fetch do /api/fb/scrape/check-cookies, setCookieCheckWarning po bledzie/0 postach, proceedAfterWarning callback z skipCookieCheckRef. Bulk scrape celowo pomija check (pauzowanie per-grupe byloby zbyt inwazyjne dla UX i rate limiting).

- src/components/fb/ScrapeProgress.tsx: dwa nowe stany: spinner dla cookie_check (linia 33-50) i zloty alert dla cookieCheckWarning z przyciskami Kontynuuj mimo to i Anuluj (linia 53-96).

- src/app/(hub)/fb-analyzer/groups/page.tsx: destrukturyzuje cookieCheckWarning i proceedAfterWarning z hooka, rozszerza warunek show ScrapeProgress o cookieCheckWarning (linia 374), przekazuje nowe props (linia 381-382).

Brak regresji we wszystkich artefaktach z planow 09-01 przez 09-03. TypeScript kompiluje bez bledow (npx tsc --noEmit: brak output).

Wszystkie 5 kryteriow sukcesu fazy 9 jest teraz w pelni zaimplementowanych i strukturalnie zweryfikowanych.

---

_Verified: 2026-02-23T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
