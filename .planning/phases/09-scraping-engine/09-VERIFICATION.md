---
phase: 09-scraping-engine
verified: 2026-02-23T09:30:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Przed scrapowaniem wykonywany jest cookie health check (testowy scrape maxPosts: 1)"
    status: partial
    reason: "Ostrzezenie post-scrape gdy 0 postow istnieje, ale brak pre-scrape testowego runu z maxPosts:1."
    artifacts:
      - path: "src/hooks/useScrapeJob.ts"
        issue: "Status cookie_check nigdy nie jest ustawiany"
      - path: "src/components/fb/ScrapeProgress.tsx"
        issue: "Brak renderowania dla status=cookie_check"
      - path: "src/app/api/fb/scrape/route.ts"
        issue: "Brak endpointu dla testowego runu maxPosts:1"
    missing:
      - "POST /api/fb/scrape/check-cookies z maxPosts:1"
      - "Logika w useScrapeJob ustawiajaca status=cookie_check"
      - "Renderowanie w ScrapeProgress dla status=cookie_check"
      - "Alert jesli health check zwroci 0 wynikow"
---
# Phase 9: Scraping Engine - Raport Weryfikacji

**Phase Goal:** Admin moze scrapowac posty z grup FB przez Apify Actor z widocznym progressem, ochrona konta i obsluga bledow
**Verified:** 2026-02-23T09:30:00Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Admin klika Scrapuj na aktywnej grupie - Apify Actor run startuje, progress bar pokazuje status, posty zapisuja sie do DB | VERIFIED | useScrapeJob -> POST /api/fb/scrape -> pollScrapeProcess -> /api/fb/scrape/process MODE 1-3 -> upsert fb_posts |
| 2 | Posty sa deduplikowane (upsert ON CONFLICT) - ponowne scrapowanie aktualizuje istniejace posty | VERIFIED | process/route.ts:321 onConflict group_id,facebook_post_id ignoreDuplicates: false |
| 3 | Scrapowanie wielu grup wymusza min. 3-minutowy odstep z losowymi opoznieniami - UI informuje o kolejce | VERIFIED | MIN_DELAY_MS=180000, MAX_DELAY_MS=360000; ScrapeProgress: countdown sekundnik z paskiem |
| 4 | Bledy scrapowania sa wyswietlane w UI z opisem i sugestia, system proponuje retry | VERIFIED | SCRAPE_ERROR_MESSAGES (7 wpisow PL); ScrapeProgress: error.message + error.suggestion + przycisk Sprobuj ponownie |
| 5 | Przed scrapowaniem wykonywany jest cookie health check (testowy scrape maxPosts: 1) | PARTIAL | Ostrzezenie postsFound===0 po zakonczeniu ISTNIEJE; pre-scrape run maxPosts:1 NIE ISTNIEJE |

**Score:** 4/5 prawd zweryfikowanych (Truth #5 = PARTIAL)
---

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| src/lib/fb/apify-client.ts | 3 funkcje API + 2 helpery | VERIFIED | 124 linie; startActorRun, getRunStatus, getDatasetItems, mapApifyStatusToAction, formatApifyDate |
| src/lib/fb/post-mapper.ts | Mapowanie Apify na DB z graceful fallbacks | VERIFIED | 157 linie; mapApifyPostToFbPost, mapApifyCommentToFbComment, extractFacebookPostId, logRawPostSample |
| src/types/fb.ts | 10+ typow scraping + SCRAPE_ERROR_MESSAGES | VERIFIED | ApifyCookieObject, ApifyActorInput, ScrapeConfig, ScrapeUIStatus, ScrapeProgress, SCRAPE_ERROR_MESSAGES 7 wpisow |
| src/app/api/fb/scrape/route.ts | POST endpoint tworzacy job z pre-flight | VERIFIED | 135 linie; verifyAdmin, duplicate check 409, config check, insert fb_scrape_jobs |
| src/app/api/fb/scrape/process/route.ts | 3-mode pipeline | VERIFIED | 516 linie; MODE1 pending->running, MODE2 running->poll, MODE3 downloading->upsert; safety timeout 50s |
| src/app/api/fb/scrape/status/[jobId]/route.ts | GET endpoint do recovery | VERIFIED | 40 linie; verifyAdmin, zwraca pelny status joba |
| src/hooks/useScrapeJob.ts | Hook pollingowy z single/bulk + rate limiting | VERIFIED | 402 linie; startScrape, startBulkScrape, 5s polling, countdown timer, cleanup on unmount |
| src/components/fb/ScrapeProgress.tsx | Sticky progress bar z wszystkimi stanami | VERIFIED | 283 linie; starting, running, downloading, completed, error, waiting between groups, 0-posts warning |
| src/components/fb/ScrapeButton.tsx | Per-group trigger z disabled state | VERIFIED | 62 linie; paused=null, current scraping=spinner, other=disabled, idle=button |
| src/app/(hub)/fb-analyzer/groups/page.tsx | Groups page z pelna integracja scrape | VERIFIED | 435 linie; useScrapeJob, ScrapeProgress, handleScrapeGroup, handleBulkScrape, scrapingGroupId |
---

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| useScrapeJob.ts | /api/fb/scrape | fetch POST startScrape | WIRED | Linia 190: fetch /api/fb/scrape method POST z groupId |
| useScrapeJob.ts | /api/fb/scrape/process | fetch POST pollScrapeProcess | WIRED | Linia 81: fetch /api/fb/scrape/process z jobId co 5s |
| process/route.ts | apify-client.ts | import startActorRun getRunStatus getDatasetItems | WIRED | Linia 6-10: importy z @/lib/fb/apify-client |
| process/route.ts | post-mapper.ts | import mapApifyPostToFbPost | WIRED | Linia 11-12: import mapApifyPostToFbPost logRawPostSample MappedFbPost |
| process/route.ts | fb_posts DB | .upsert ON CONFLICT | WIRED | Linia 319-323: .upsert(batch, onConflict group_id,facebook_post_id) |
| groups/page.tsx | useScrapeJob | import i uzycie hooka | WIRED | Linia 13: import useScrapeJob; linia 31-38: destrukturyzacja z onComplete callback |
| groups/page.tsx | ScrapeProgress | warunkowe renderowanie | WIRED | Linia 372-380: scrapeStatus !== idle lub isWaitingBetweenGroups -> ScrapeProgress |
| GroupTable.tsx | ScrapeButton | renderowanie per wiersz w kolumnie Akcje | WIRED | Linia 8: import; linia 275-282: onScrape && ScrapeButton first in actions |

---

### Requirements Coverage

| Requirement | Status | Blocking Issue |
| --- | --- | --- |
| FBSCR-01: Admin moze scrapowac grupe | SATISFIED | Pelny pipeline zaimplementowany i polaczony |
| FBSCR-02: Deduplication upsert | SATISFIED | ON CONFLICT group_id,facebook_post_id |
| FBSCR-03: Rate limiting min. 3 min | SATISFIED | MIN_DELAY_MS = 180000 (3 min) |
| FBSCR-04: Error handling z sugestia | SATISFIED | SCRAPE_ERROR_MESSAGES 7 wpisow + ScrapeProgress error state z retry |
| FBSCR-05: Cookie health check | PARTIAL | Ostrzezenie post-completion istnieje; pre-scrape run maxPosts:1 brak |
---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| src/hooks/useScrapeJob.ts | cookie_check status unused | Info | Typ ScrapeUIStatus zawiera wartosc cookie_check ktora nigdy nie jest ustawiana przez hook |
| src/app/api/fb/scrape/process/route.ts | logRawPostSample w produkcji | Warning | Debug helper loguje surowe dane Apify na konsole przy pierwszym scrapowaniu |

---

### Human Verification Required

#### 1. Faktyczny flow Apify Actor

**Test:** Skonfiguruj Apify token + FB cookies w Ustawieniach, kliknij Scrapuj dla aktywnej grupy, poczekaj na zakonczenie.
**Expected:** Progress bar: starting -> running (z apifyStatus RUNNING) -> downloading (z licznikami postow) -> completed. Posty widoczne w bazie.
**Why human:** Wymaga realnego Apify run z waznym tokenem i cookies FB.

#### 2. Rate limiting w bulk scrape

**Test:** Wybierz 2 grupy, kliknij Scrapuj wybrane (2), obserwuj po zakonczeniu pierwszej grupy.
**Expected:** ScrapeProgress pokazuje countdown 3-6 minut z animowanym paskiem. Druga grupa startuje dopiero po odczekaniu.
**Why human:** Countdown wymaga realnego oczekiwania 3-6 minut.

#### 3. Cookie warning przy 0 postach

**Test:** Scrapuj grupe z wygaslymi lub nieprawidlowymi cookies.
**Expected:** Po zakonczeniu ScrapeProgress pokazuje zolty alert: Nie znaleziono nowych postow. Jesli grupa jest aktywna, moze to oznaczac wygasle cookies.
**Why human:** Wymaga wygaslych cookies lub pustej grupy testowej.

#### 4. Recovery po utracie polaczenia

**Test:** Odswiez strone w trakcie aktywnego scrapowania, wroc na strone grup.
**Expected:** GET /api/fb/scrape/status/{jobId} istnieje do recovery, ale hook nie wywoluje go automatycznie po reload.
**Why human:** Wymaga timing i manualnej interakcji. Uwaga: brak auto-recovery to potencjalna luka UX.
---

### Podsumowanie Luk

Jedna luka blokujaca pelne spelnienie 5. kryterium akceptacji:

Faza osiagnela glowny cel operacyjny (pelny pipeline scraping: klik -> Apify run -> posty w DB), ale brak pre-scrape cookie health check z testowym runem (maxPosts:1) opisanego w kryterium nr 5.

Zaimplementowano prostsze rozwiazanie: po zakonczeniu scrapowania, gdy postsFound===0, ScrapeProgress.tsx (linia 183-213) pokazuje zolty alert sugerujacy wygasle cookies. Typ ScrapeUIStatus zawiera wartosc cookie_check jako martwy kod (dead code) - przygotowanie do pelnej implementacji ktore nigdy nie zostalo zrealizowane.

Decyzja ta byla celowa i udokumentowana w planie 09-03. Jest to swiadome odejscie od kryterium fazowego, nie niezamierzony bug. Pozostale 4 kryteria sukcesu sa w pelni zaimplementowane i zweryfikowane strukturalnie. TypeScript kompiluje bez bledow.

---

_Verified: 2026-02-23T09:30:00Z_
_Verifier: Claude (gsd-verifier)_