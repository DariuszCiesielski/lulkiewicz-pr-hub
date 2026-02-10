# Domain Pitfalls: Email Communication Analysis Hub

**Domain:** Narzedzie do analizy komunikacji email (Outlook) z AI dla agencji PR
**Projekt:** Lulkiewicz PR Hub
**Data badania:** 2026-02-10
**Kontekst:** 3 skrzynki Outlook, tysiace emaili, jezyk polski, dane GDPR-sensitive, stack Next.js + Supabase + Vercel + OpenAI

---

## Krytyczne pulapki (Critical Pitfalls)

Bledy powodujace koniecznosc przepisania lub powazne problemy.

---

### Pitfall C1: Microsoft Graph OAuth2 — bledna konfiguracja uprawnien i consent flow

**Co idzie nie tak:** Aplikacja wymaga dostepu do 3 skrzynek pocztowych bez zalogowanego uzytkownika (background sync). Deweloperzy czesto konfiguruja delegated permissions (Mail.Read) zamiast application permissions (Mail.Read / Mail.ReadBasic.All), co wymaga zalogowanego uzytkownika i uniemozliwia background sync. Albo uzywaja zbyt szerokich uprawnien (Mail.ReadWrite) zamiast Mail.Read (read-only).

**Dlaczego tak sie dzieje:** Microsoft Graph ma dwa odrebne modele uprawnien — delegated (wymaga user context) i application (dzialanie bez uzytkownika). Dokumentacja latwo myli te dwa modele. Ponadto od marca 2026 Microsoft wymusza OAuth 2.0 i calkowicie wylacza Basic Auth dla IMAP/POP/SMTP.

**Konsekwencje:**
- Aplikacja nie moze synchronizowac emaili w tle
- Admin tenant Microsoft 365 musi udzielic consent — jezeli tego nie przewidziano, deploy blokuje sie na etapie IT
- Zbyt szerokie uprawnienia (np. Mail.ReadWrite) moga byc odrzucone przez admina z powodow bezpieczenstwa

**Zapobieganie:**
1. Uzyj **application permissions** z **client credentials flow** (client_id + client_secret lub certificate)
2. Zadaj **Mail.Read** (nie Mail.ReadWrite) — zasada least privilege
3. Rozwazyc **Mail.ReadBasic.All** jezeli body nie jest potrzebne na etapie listowania (ale dla analizy AI body jest konieczne)
4. Przygotuj dokumentacje dla admina IT klienta opisujaca jakie uprawnienia sa potrzebne i dlaczego
5. Zaimplementuj **application access policy** aby ograniczyc dostep tylko do 3 konkretnych skrzynek, nie calego tenanta

**Wykrywanie:** Jesli podczas developmentu uzywasz tokena z Postman/Graph Explorer i wszystko dziala, ale po deployu przestaje — prawdopodobnie uzywasz delegated permissions w kontekscie wymagajacym application permissions.

**Pewnosc:** HIGH (zrodlo: [Microsoft Graph auth docs](https://learn.microsoft.com/en-us/graph/auth-v2-service), [Microsoft modern auth enforcement](https://www.getmailbird.com/microsoft-modern-authentication-enforcement-email-guide/))

**Faza:** Phase 1 (infrastruktura / polaczenie z Outlook)

---

### Pitfall C2: Timeout Vercel przy synchronizacji tysiecy emaili

**Co idzie nie tak:** Synchronizacja 3 skrzynek z tysiacami emaili wymaga wielokrotnych zapytan do Microsoft Graph API (paginacja po 50-100 emaili). Calosc moze trwac minuty. Vercel serverless functions maja limit czasu wykonania — bez Fluid Compute to 10-15s default (60s max na Hobby). Nawet z Fluid Compute na Pro to max 800s (13 min).

**Dlaczego tak sie dzieje:** Synchronizacja emaili to operacja long-running. Kazda strona paginacji to osobne zapytanie HTTP do Graph API + zapis do Supabase. Przy 5000 emaili i paginacji po 50 to 100 zapytan, kazde trwajace 200-500ms = 20-50 sekund tylko na fetch, nie liczac zapisu.

**Konsekwencje:**
- Synchronizacja sie przerywa w polowie
- Baza danych ma czesciowe dane (np. 2000 z 5000 emaili)
- Uzytkownik widzi niekompletne wyniki analizy
- Brak mechanizmu wznowienia = koniecznosc restartu od zera

**Zapobieganie:**
1. **Wlacz Fluid Compute** na Vercel (domyslnie wlaczone w nowych projektach, daje do 300s default)
2. **Podziel synchronizacje na chunki** — API route przyjmuje `deltaLink` lub `skipToken` i synchronizuje 1 strone, frontend wywoluje w petli
3. **Uzyj wzorca progressive sync:**
   - Endpoint `POST /api/sync/start` — rozpoczyna sync, zwraca task ID
   - Endpoint `GET /api/sync/status/:id` — sprawdza postep
   - Frontend polluje status co 2-3 sekundy
4. **Zapisz stan synchronizacji w Supabase** — tabela `sync_jobs` z `last_delta_link`, `emails_synced`, `status`
5. **Rozwazyc Vercel Cron** lub **Upstash QStash** dla automatycznych synchronizacji
6. Ustaw `export const maxDuration = 300` w Next.js route handler

**Wykrywanie:** Blad `FUNCTION_INVOCATION_TIMEOUT` w logach Vercel. Sync konczy sie bez bledu ale baza ma mniej emaili niz skrzynka.

**Pewnosc:** HIGH (zrodlo: [Vercel duration docs](https://vercel.com/docs/functions/configuring-functions/duration) — Hobby 300s z Fluid Compute, Pro 800s max)

**Faza:** Phase 1-2 (sync engine)

---

### Pitfall C3: Wyciek danych osobowych / naruszenie GDPR

**Co idzie nie tak:** Emaile z administracji nieruchomosci zawieraja: imiona i nazwiska mieszkancow, adresy mieszkan, skargi, dane o platnoscia. Przechowywanie tych danych bez odpowiednich zabezpieczen to naruszenie GDPR. Wyslanie pelnej tresci emaili do OpenAI API to transfer danych do procesora zewnetrznego (potencjalnie poza EU).

**Dlaczego tak sie dzieje:**
- Developerzy skupiaja sie na funkcjonalnosci, nie na compliance
- OpenAI Data Processing Addendum (DPA) jest wymagane ale czesto pomijane
- Brak polityki retencji = dane przechowywane w nieskonczonosc
- Brak granularnych uprawnien = kazdy uzytkownik narzedzia widzi wszystkie emaile

**Konsekwencje:**
- Kary do 20 mln EUR lub 4% globalnego przychodu
- Utrata zaufania klienta (agencja PR)
- Koniecznosc notyfikacji UODO w ciagu 72h w razie wycieku
- Mieszkancy moga zadac usuniecia swoich danych (prawo do bycia zapomnianym)

**Zapobieganie:**
1. **Supabase w regionie EU** (Frankfurt) — dane nie opuszczaja EU na poziomie bazy
2. **Row Level Security (RLS)** na kazdej tabeli z danymi emaili — izolacja per organizacja
3. **Podpisz DPA z OpenAI** — dokument regulujacy przetwarzanie danych
4. **OpenAI API z `"store": false`** — zapobiega zapisywaniu danych przez OpenAI
5. **Polityka retencji danych:**
   - Automatyczne usuwanie surowych emaili po X dni (np. 90)
   - Zachowanie tylko zagregowanych raportow/analiz (bez danych osobowych)
   - Implementacja `pg_cron` lub Supabase Edge Function do automatycznego czyszczenia
6. **Anonimizacja przed wyslaniem do AI** — zamien imiona/adresy na tokeny (`[MIESZKANIEC_1]`, `[ADRES_1]`) przed wyslaniem do OpenAI, potem podmien z powrotem w raporcie
7. **Audit log** — loguj kto kiedy dostal dostep do jakich danych
8. **Szyfrowanie at rest** — Supabase zapewnia to domyslnie, ale zweryfikuj

**Wykrywanie:** Brak dokumentacji GDPR, brak DPA z OpenAI, brak polityki retencji, brak RLS na tabelach z emailami.

**Pewnosc:** HIGH (zrodlo: [GDPR.eu](https://gdpr.eu/email-encryption/), [Supabase GDPR](https://www.kontocsv.de/en/ratgeber/supabase-dsgvo-konform))

**Faza:** Phase 0 (przed rozpoczeciem kodu — decyzje architektoniczne i prawne)

---

### Pitfall C4: Przekroczenie context window OpenAI przy analizie tysiecy emaili

**Co idzie nie tak:** 5000 emaili x srednia 500 tokenow = 2.5M tokenow. Nawet GPT-4o z 128K context window nie pomiesci wiecej niz ~250 emaili naraz. Deweloperzy probuja wyslac "wszystko" do AI i dostaja blad context length exceeded lub — gorzej — API cicho ucina dane wejsciowe.

**Dlaczego tak sie dzieje:** Naturalna intuicja to "daj AI wszystkie emaile i poproc o analize". Ale modele LLM maja twarde limity context window. Dodatkowo koszt rosnie liniowo z liczba tokenow — wyslanie 2.5M tokenow to setki dolarow.

**Konsekwencje:**
- Bledy `context_length_exceeded` przerywaja analize
- Niekompletna analiza (AI pomija pozniejsze emaile)
- Koszty OpenAI wymykaja sie spod kontroli (brak budgetu)
- Niska jakosc odpowiedzi — AI "gubi sie" przy zbyt dlugim kontekscie

**Zapobieganie:**
1. **Map-Reduce pattern:**
   - **Map:** Dla kazdego emaila (lub batcha 10-20 emaili) wygeneruj streszczenie / ekstrakcje kluczowych danych (temat, sentyment, kategoria, osoby, daty)
   - **Reduce:** Polacz streszczenia i wygeneruj raport zbiorczy
2. **Pre-processing pipeline:**
   - Nie wysylaj calosci — wyodrebnij plain text z HTML, usun sygnatury, cytaty, disclaimery
   - Zdeduplikuj watki — analizuj tylko ostatnia wiadomosc w watku (zawiera historie)
3. **Token budgeting:**
   - Ustaw twardy limit kosztow per analiza (np. max $5)
   - Uzyj `tiktoken` do liczenia tokenow PRZED wyslaniem
   - Uzyj tanszego modelu (GPT-4o-mini) do etapu Map, drozszego (GPT-4o) do Reduce
4. **Batching z OpenAI Batch API** — 50% taniej, ale wyniki po 24h
5. **Strumieniowanie wynikow** — pokaz uzytkownikowi postep analizy w czasie rzeczywistym

**Wykrywanie:** Bledy 400 z OpenAI z trescia "context_length_exceeded". Niespodziewanie wysokie rachunki OpenAI. Raporty pomijaja emaile z konca zakresu czasowego.

**Pewnosc:** HIGH (zrodlo: [OpenAI Cookbook — Summarizing Long Documents](https://cookbook.openai.com/examples/summarizing_long_documents), [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits))

**Faza:** Phase 2-3 (AI analysis engine)

---

## Umiarkowane pulapki (Moderate Pitfalls)

Bledy powodujace opoznienia lub dlug techniczny.

---

### Pitfall M1: Bledna obsluga kodowania polskich znakow w emailach

**Co idzie nie tak:** Emaile z polskich systemow czesto uzywaja roznych enkodyngow: UTF-8 (nowoczesne), Windows-1250 (Outlook PL), ISO-8859-2 (starsze systemy). Niektore emaile maja blednie zadeklarowany charset (np. ISO-8859-1 zamiast Windows-1250). Polskie znaki diakrytyczne (aczelnoszz) zamieniaja sie w "krzaczki" lub znaki zapytania.

**Dlaczego tak sie dzieje:**
- Windows-1250 i ISO-8859-2 sa podobne ale NIE identyczne — np. S z haczykiem (U+0160) to 0xA9 w ISO-8859-2 ale 0x8A w Windows-1250
- Outlook na polskim Windowsie czesto uzywa Windows-1250, ale deklaruje ISO-8859-2 w naglowku Content-Type
- Biblioteka `mailparser` uzywa `iconv-lite` do konwersji — obsluguje oba, ALE wymaga poprawnego charset w naglowku

**Zapobieganie:**
1. Uzyj biblioteki `mailparser` (3.9.x) — ma wbudowana obsluge iconv-lite
2. Implementuj **fallback charset detection** — jezeli zdekodowany tekst zawiera znaki zastepowania (U+FFFD), sprob alternatywny encoding
3. **Testuj z prawdziwymi emailami** z tych 3 skrzynek od samego poczatku — nie z syntetycznymi danymi
4. Przed wyslaniem do OpenAI zweryfikuj ze tekst jest poprawnym UTF-8
5. Dodaj testy jednostkowe z polskimi znakami we wszystkich wariantach encoding

**Pewnosc:** MEDIUM-HIGH (zrodlo: [mailparser npm](https://www.npmjs.com/package/mailparser), [Mozilla bug 1505315](https://bugzilla.mozilla.org/show_bug.cgi?id=1505315), [Windows-1250 Wikipedia](https://en.wikipedia.org/wiki/Windows-1250))

**Faza:** Phase 1-2 (email parsing)

---

### Pitfall M2: Grupowanie watkow emailowych — bledne laczenie lub rozbijanie konwersacji

**Co idzie nie tak:** Email threading opiera sie na naglowkach `In-Reply-To` i `References` (RFC 2822). Ale w praktyce: Outlook czasami nie ustawia tych naglowkow poprawnie; forwarded emaile nie maja `In-Reply-To`; uzytkownicy odpowiadaja na stary email zmieniajac temat (nowy watek, stary `References`); rozne osoby uzywaja tego samego tematu ("Re: pytanie") dla niepowiazanych spraw.

**Dlaczego tak sie dzieje:**
- Outlook uzywa wlasnego naglowka `Thread-Index` (binarny, proprietarny) zamiast standardowego `References`
- Forward nie jest "reply" — nie ma `In-Reply-To`
- W komunikacji administracja-mieszkancy tematy sa czesto generyczne ("Pytanie", "Reklamacja", "Problem z ogrzewaniem")

**Zapobieganie:**
1. **Wielopoziomowy algorytm grupowania:**
   - Poziom 1: `References` / `In-Reply-To` header (najdokladniejszy)
   - Poziom 2: Outlook `Thread-Index` header (parsuj pierwsze 22 bajty = conversation ID)
   - Poziom 3: `conversationId` z Microsoft Graph API (Graph sam grupuje watki!)
   - Poziom 4: Fallback na subject + participants matching (najmniej dokladny)
2. **Uzyj `conversationId` z Graph API jako primary** — Microsoft juz rozwiazal ten problem na swoim poziomie
3. Dodaj UI do recznego laczenia/rozdzielania watkow
4. Nie polegaj wylacznie na temacie emaila — tematy w administracji sa zbyt generyczne

**Pewnosc:** HIGH (zrodlo: [JWZ threading algorithm](https://www.jwz.org/doc/threading.html), [Microsoft Graph message resource](https://learn.microsoft.com/en-us/graph/api/message-delta), [Mutant Mail Thread-Index](https://blog.mutantmail.com/unraveling-the-thread-index-email-header-mystery/))

**Faza:** Phase 2 (data processing / thread grouping)

---

### Pitfall M3: Microsoft Graph delta query — utrata synchronizacji

**Co idzie nie tak:** Delta query to mechanizm incremental sync — zamiast pobierac wszystkie emaile za kazdym razem, pobierasz tylko zmiany od ostatniego synca. Ale: deltaToken wygasa (brak oficjalnej dokumentacji o czasie wygasniecia); pusta strona w paginacji (0 wynikow ale jest `nextLink` — trzeba kontynuowac!); ten sam email moze pojawic sie wiele razy w odpowiedzi; query parametry sa zakodowane w tokenie — nie dodawaj ich ponownie.

**Dlaczego tak sie dzieje:**
- Delta query to stateful API — stan jest w tokenach, nie w aplikacji
- Developerzy przerywaja paginacje gdy dostana pusta strone (blad — trzeba isc dalej az do `deltaLink`)
- Developerzy dodaja `$select` lub `$filter` do URL z `skipToken` — lamie to synchronizacje

**Zapobieganie:**
1. **Petla paginacji:** kontynuuj az odpowiedz zawiera `@odata.deltaLink` (nie `nextLink`)
2. **Nigdy nie modyfikuj URL z tokenem** — uzyj go dokladnie tak jak zostal zwrocony
3. **Zapisz `deltaLink` w Supabase** po kazdym ukonczonym cyklu sync
4. **Implementuj full resync fallback** — jezeli deltaToken jest nieaktualny (blad 410 Gone lub reset), wykonaj pelna synchronizacje
5. **Obsluz duplikaty** — uzywaj `upsert` (ON CONFLICT) przy zapisie do bazy
6. **Obsluz usuniete emaile** — Graph zwraca obiekty z `@removed.reason: "deleted"`
7. Limitacja: `$filter=receivedDateTime` ogranicza wyniki do **5000 wiadomosci max**

**Pewnosc:** HIGH (zrodlo: [Microsoft Graph delta query messages](https://learn.microsoft.com/en-us/graph/delta-query-messages), [Microsoft Graph delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview))

**Faza:** Phase 1-2 (sync engine)

---

### Pitfall M4: Konwersja HTML emaili na tekst do analizy AI

**Co idzie nie tak:** Wiekszosc emaili z Outlooka jest w formacie HTML. Wyslanie surowego HTML do OpenAI to marnowanie tokenow na tagi, style, sygnatury, disclaimery prawne. Ale naiwne stripowanie tagow gubi strukture (listy, tabele, cytaty). Dodatkowo outlook wstawia specyficzny HTML z `<o:p>`, `mso-*` styles, komentarze warunkowe `<!--[if gte mso 9]>`.

**Dlaczego tak sie dzieje:** Email HTML to NIE jest web HTML. Outlook generuje specyficzny markup z namespace'ami Office, ktory standardowe parsery HTML nie obsluguja poprawnie. Proste regex `/<[^>]+>/g` gubi formatowanie i pozostawia smieci.

**Zapobieganie:**
1. Uzyj biblioteki `html-to-text` (npm) — obsluguje tabele, listy, linki, formatowanie
2. Przed konwersja usun:
   - Sygnatury email (wzorce: `--`, "Pozdrawiam", "Z powazaniem", "Best regards")
   - Disclaimery prawne (czesto na koncu emaila, po separatorze)
   - Cytowane wiadomosci (linie zaczynajace sie od `>` lub bloki `<blockquote>`)
   - Outlook-specific markup (`<o:p>`, `mso-*`, komentarze warunkowe)
3. Jesli Graph API zwraca zarowno `body.content` (HTML) jak i `uniqueBody` — uzyj `uniqueBody` (tylko nowa tresc, bez cytatow)
4. Zapisz w bazie zarowno `body_html` jak i `body_text` (skonwertowany)

**Pewnosc:** MEDIUM-HIGH (zrodlo: [html-to-text npm](https://www.npmjs.com/package/html-to-text), doswiadczenie z Outlook HTML — LOW confidence na dokladne API response fields, zweryfikowac z Graph docs)

**Faza:** Phase 1-2 (email parsing / pre-processing)

---

### Pitfall M5: Rate limiting Microsoft Graph API przy initial sync

**Co idzie nie tak:** Podczas pierwszej synchronizacji 3 skrzynek x 5000 emaili = 15000 emaili do pobrania. Przy paginacji po 50 to 300 zapytan. Microsoft Graph throttluje na poziomie per-app-per-mailbox i per-tenant. Przekroczenie limitu = blad 429 + Retry-After header.

**Dlaczego tak sie dzieje:** Globalny limit to 130,000 zapytan / 10 sekund per app per tenant, ale Outlook ma dodatkowe, niepublikowane limity per mailbox. W praktyce agresywne rownoczesne zapytania do 3 skrzynek moga szybko wyczerpac limit.

**Zapobieganie:**
1. **Synchronizuj skrzynki sekwencyjnie** (nie rownolegle) podczas initial sync
2. **Implementuj exponential backoff** z obsluga naglowka `Retry-After`
3. **Uzyj `$top=50`** (nie wiecej) dla paginacji — mniejsze strony = mniejsze ryzyko throttlingu
4. **Dodaj opoznienie miedzy stronami** — 200-500ms sleep miedzy zapytaniami
5. **Monitoruj header `x-ms-throttle-limit-percentage`** — wartosc 0.8-1.8 oznacza zblizanie sie do limitu
6. **Uzyj `$select`** aby pobierac tylko potrzebne pola (subject, body, from, to, receivedDateTime, conversationId) — mniejsze odpowiedzi = szybsze przetwarzanie

**Pewnosc:** HIGH (zrodlo: [Microsoft Graph throttling](https://learn.microsoft.com/en-us/graph/throttling), [Microsoft Graph throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits))

**Faza:** Phase 1 (sync engine)

---

## Mniejsze pulapki (Minor Pitfalls)

Problemy irytujace ale naprawialne.

---

### Pitfall m1: Polskie znaki w generowanych raportach .docx / .pdf

**Co idzie nie tak:** Generowanie raportu w formacie DOCX lub PDF z trescia zawierajaca polskie znaki diakrytyczne. Standardowe fonty PDF (Times Roman, Helvetica, Courier) uzywaja kodowania WinAnsi i obsluguja tylko 218 znakow lacniskich — polskie aczelnoszz moga byc pominiete lub zamienione na `?`.

**Zapobieganie:**
1. Dla PDF: **osadz font z pelna obsluga Unicode** (np. Roboto, Noto Sans, Open Sans) — biblioteki jak `pdf-lib` lub `@react-pdf/renderer` wymagaja jawnego embedowania fontu
2. Dla DOCX: uzyj `docx` (npm) z poprawnym `<w:rFonts>` i upewnij sie ze dokument ma `<?xml encoding="UTF-8"?>`
3. **Testuj generowanie z duzym wolumenem polskiego tekstu** wlaczajac najtrudniejsze znaki: z z kreska (z), z z kropka (z), ogonki (a, e)
4. Uwaga na "smart quotes" Worda — szablony DOCX moga zastepowac cudzyslow ASCII na Unicode curly quotes, co psuje templating

**Pewnosc:** MEDIUM (zrodlo: [pdf-lib GitHub](https://github.com/Hopding/pdf-lib), [html-docx-js issue #24](https://github.com/evidenceprime/html-docx-js/issues/24), [react-pdf issue #852](https://github.com/diegomura/react-pdf/issues/852))

**Faza:** Phase 3 (raport generation)

---

### Pitfall m2: Zalaczniki emailowe — nieoczekiwane zuzycie storage i pamieci

**Co idzie nie tak:** Emaile z administracji nieruchomosci czesto zawieraja zalaczniki: skany dokumentow, zdjecia (np. usterki), PDFy. Pobieranie i przechowywanie wszystkich zalacznikow moze szybko wyczerpac storage Supabase i RAM serverless functions.

**Zapobieganie:**
1. **Nie pobieraj zalacznikow domyslnie** — synchronizuj tylko metadane (nazwa, rozmiar, typ MIME)
2. Pobieraj zawartosc zalacznika on-demand (lazy loading)
3. Ustaw limit rozmiaru: ignoruj zalaczniki > 10MB
4. Jesli AI ma analizowac zalaczniki (np. PDFy) — to osobna faza, nie MVP

**Pewnosc:** MEDIUM (logika domenowa — emaile administracyjne czesto maja zalaczniki)

**Faza:** Phase 1 (sync) — decyzja architektoniczna, Phase 3+ (ewentualna obsluga)

---

### Pitfall m3: Jakosc analizy AI dla jezyka polskiego

**Co idzie nie tak:** Modele OpenAI sa trenowane glownie na tresciach anglojezycznych. Analiza sentymentu, kategoryzacja i ekstrakcja informacji z polskich emaili moze byc mniej dokladna. Specyficzny zargon administracji nieruchomosci (wspolnota mieszkaniowa, fundusz remontowy, uchwala, zarzadca) moze byc zle interpretowany.

**Zapobieganie:**
1. **Promptuj w jezyku polskim** — model lepiej rozumie kontekst gdy caly prompt jest po polsku
2. **Dodaj kontekst domenowy w system prompt** — wyjasni terminologie administracji nieruchomosci
3. **Few-shot examples** — dolacz 2-3 przyklady poprawnej klasyfikacji/analizy
4. **Walidacja ludzka** — pierwszych 50-100 analiz powinno byc zweryfikowanych przez czlowieka
5. Testuj z GPT-4o (lepszy w jezykach obcych) nie GPT-4o-mini (gorszy w polskim)
6. Rozwazyc **Claude** (Anthropic) jako alternatywe — czesto lepszy w jezykach europejskich

**Pewnosc:** MEDIUM (doswiadczenia z polskim NLP — brak twardych danych porownawczych, wymaga testow)

**Faza:** Phase 2-3 (AI analysis)

---

### Pitfall m4: Token refresh i wygasanie sesji Graph API

**Co idzie nie tak:** Access token Microsoft Graph wygasa po 60-90 minutach. Jesli synchronizacja trwa dluzej lub cron job nie odswiezy tokena, zapytania koncza sie bledem 401 Unauthorized.

**Zapobieganie:**
1. Dla client credentials flow: tokeny wygasaja po ~3600s. Przed kazdym batchem zapytan sprawdz czy token jest aktualny
2. Implementuj `TokenCache` — przechowuj token + expiry, odswiez 5 minut przed wygasnieciem
3. Nie przechowuj tokenow w Supabase (sa krotkotrwale) — cache w pamieci lub zmiennej srodowiskowej per invocation
4. Dodaj retry logic: jesli 401, odswiez token i ponow zapytanie

**Pewnosc:** HIGH (standardowy wzorzec OAuth2)

**Faza:** Phase 1 (auth / sync engine)

---

## Ostrzezenia specyficzne dla faz (Phase-Specific Warnings)

| Faza | Temat | Prawdopodobna pulapka | Mitygacja |
|------|-------|----------------------|-----------|
| Phase 0 | Decyzje prawne | Brak DPA z OpenAI, brak dokumentacji GDPR | Przygotuj dokumenty przed kodem |
| Phase 1 | OAuth2 setup | Bledne uprawnienia (delegated vs application) | Application permissions + admin consent |
| Phase 1 | Initial sync | Timeout Vercel + rate limiting Graph | Chunked sync + Fluid Compute + backoff |
| Phase 1 | Email parsing | Polskie znaki z Windows-1250 | mailparser + fallback charset detection |
| Phase 2 | Thread grouping | Generyczne tematy w komunikacji administracyjnej | Uzyj Graph `conversationId` jako primary |
| Phase 2 | HTML cleanup | Outlook-specific markup psuje konwersje | html-to-text + dedykowane filtry Outlook |
| Phase 2-3 | AI analysis | Context window overflow | Map-Reduce + token budgeting |
| Phase 2-3 | AI accuracy | Jezyk polski + zargon nieruchomosciowy | Polski system prompt + few-shot + walidacja |
| Phase 3 | Report gen | Polskie znaki w PDF/DOCX | Osadzone fonty Unicode |
| Phase 3 | Koszty AI | Niekontrolowane zuzycie tokenow | Budget per analiza + tani model na Map |
| Ongoing | Sync jobs | Wygasanie deltaToken | Full resync fallback + monitoring |
| Ongoing | Data retention | Dane osobowe przechowywane w nieskonczonosc | Automatyczna retencja + pg_cron |

---

## Podsumowanie priorytetow

**Najtrudniejsze problemy do rozwiazania (zacznij od nich):**
1. GDPR compliance — decyzje architektoniczne PRZED kodem
2. Sync engine z obsluga timeoutow — fundament calej aplikacji
3. Map-Reduce pipeline dla AI — bez tego analiza jest niemozliwa

**Problemy ktore wyglad na proste ale nie sa:**
1. Kodowanie polskich znakow (roznice Windows-1250 vs ISO-8859-2)
2. Grupowanie watkow (generyczne tematy, brakujace naglowki)
3. HTML cleanup (Outlook-specific markup)

**Problemy ktore mozna odlozyc:**
1. Obsluga zalacznikow (metadata teraz, content pozniej)
2. Generowanie PDF/DOCX (HTML report wystarczy na MVP)
3. Automatyczna synchronizacja (manualna wystarczy na MVP)

---

## Zrodla

- [Microsoft Graph throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits) [HIGH]
- [Microsoft Graph delta query messages](https://learn.microsoft.com/en-us/graph/delta-query-messages) [HIGH]
- [Microsoft Graph auth — app-only](https://learn.microsoft.com/en-us/graph/auth-v2-service) [HIGH]
- [Microsoft modern auth enforcement 2026](https://www.getmailbird.com/microsoft-modern-authentication-enforcement-email-guide/) [MEDIUM]
- [Vercel function duration docs](https://vercel.com/docs/functions/configuring-functions/duration) [HIGH]
- [OpenAI Cookbook — Summarizing Long Documents](https://cookbook.openai.com/examples/summarizing_long_documents) [HIGH]
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits) [HIGH]
- [GDPR email compliance](https://gdpr.eu/email-encryption/) [MEDIUM]
- [Supabase GDPR guide](https://www.kontocsv.de/en/ratgeber/supabase-dsgvo-konform) [MEDIUM]
- [JWZ email threading algorithm](https://www.jwz.org/doc/threading.html) [HIGH]
- [Thread-Index header mystery](https://blog.mutantmail.com/unraveling-the-thread-index-email-header-mystery/) [MEDIUM]
- [mailparser npm](https://www.npmjs.com/package/mailparser) [HIGH]
- [html-to-text npm](https://www.npmjs.com/package/html-to-text) [HIGH]
- [Windows-1250 encoding](https://en.wikipedia.org/wiki/Windows-1250) [HIGH]
- [Mozilla Bug 1505315 — Polish charset mismatch](https://bugzilla.mozilla.org/show_bug.cgi?id=1505315) [HIGH]
- [pdf-lib](https://github.com/Hopding/pdf-lib) [MEDIUM]
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference) [HIGH]
