# Lulkiewicz PR Hub — Propozycje rozwoju modułu FB Analyzer

**Przygotowane na spotkanie z klientem | 2026-03-22**

---

## A. Co już działa (gotowe do użycia)

### 1. Zarządzanie grupami FB
- Lista 52+ grup Facebook przypisanych do deweloperów (Robyg, inne)
- Bulk upload grup z CSV
- Konfiguracja cookies i Apify per grupa
- Archiwizacja (soft delete) nieaktywnych grup

### 2. Scrapowanie postów z Facebooka
- Automatyczne pobieranie postów z grup przez Apify
- Bulk scrape wielu grup z losowymi opóźnieniami (ochrona przed banem)
- Health check cookies przed scrapowaniem
- Progress bar z podglądem postępu

### 3. Analiza AI postów
- Analiza sentymentu (pozytywny / neutralny / negatywny)
- Ocena istotności (relevance score 0-10)
- Kategoryzacja tematyczna
- AI snippet — krótkie podsumowanie posta
- Wzmocnienie score za słowa kluczowe (konfigurowalne)
- Pauza / wznowienie analizy
- Domyślne instrukcje AI per deweloper (edytowalne)

### 4. Raporty FB (AI-generowane)
- Generowanie raportu per deweloper z wybranego zakresu dat
- 4 sekcje AI na grupę: analiza ogólna + sentyment, ryzyko PR, rekomendacje + podsumowanie cross-group
- Spis treści, edycja inline per sekcja
- Eksport do .docx (z profesjonalnym formatowaniem)
- Kopiowanie do schowka (markdown)
- Lista raportów z historią

### 5. Dashboard (podstawowy)
- 6 kafelków KPI: grupy, posty, istotne, negatywne, ostatnie scrapowanie, śr. istotność
- Podsumowania per deweloper
- Quick actions (linki do kluczowych stron)

---

## B. Propozycje nowych feature'ów — do dyskusji

### PRIORYTET WYSOKI (wartość operacyjna)

#### B1. Automatyczne scrapowanie cykliczne (Cron)
**Co:** System automatycznie scrapuje grupy co X dni (np. co tydzień) bez ręcznego uruchamiania.
**Jak działa:** Cron job na serwerze uruchamia scrapowanie w nocy, rano użytkownik widzi świeże dane.
**Wartość:** Eliminuje konieczność pamiętania o ręcznym uruchamianiu.
**Pytanie do klienta:** Jak często chcesz scrapować? Wszystkie grupy naraz czy rotacyjnie?

#### B2. Automatyczna analiza AI po scrapowaniu
**Co:** Po zakończeniu scrapowania system automatycznie uruchamia analizę AI na nowych postach.
**Jak działa:** Pipeline: scrape → analiza AI → raport gotowy rano.
**Wartość:** Zero ręcznych kroków — dane zawsze przeanalizowane.
**Pytanie do klienta:** Czy analiza powinna być automatyczna, czy wolisz ręcznie decydować kiedy?

#### B3. Powiadomienia email o alertach
**Co:** Gdy AI wykryje negatywny post o wysokiej istotności (relevance >= 7), system wysyła email.
**Jak działa:** Po analizie AI sprawdzamy nowe negatywne posty → email z linkiem do posta i snippetem.
**Wartość:** Szybka reakcja na kryzysy wizerunkowe — nie trzeba codziennie logować się do systemu.
**Pytanie do klienta:** Na jaki email? Jaki próg alertu (relevance >= 7 czy inny)?

---

### PRIORYTET ŚREDNI (analityka i UX)

#### B4. Dashboard rozszerzony — trendy sentymentu
**Co:** Wykresy pokazujące jak zmienia się sentyment w czasie (tygodniowo / miesięcznie).
**Jak wygląda:** Wykres liniowy z 3 liniami (pozytywne / neutralne / negatywne) per deweloper.
**Wartość:** Widać czy sytuacja się poprawia czy pogarsza — trend > punkt.
**Pytanie do klienta:** Czy wykresy trendów byłyby przydatne? Jakie okresy (tygodnie, miesiące)?

#### B5. Top negatywne posty — widok alertowy
**Co:** Dedykowana lista najważniejszych negatywnych postów z ostatnich 7/30 dni, posortowana po relevance.
**Jak wygląda:** Tabela z: treść, grupa, data, relevance, link do FB, opcja "oznacz jako obsłużone".
**Wartość:** Jedno miejsce do szybkiego przeglądu co wymaga reakcji.
**Pytanie do klienta:** Czy chcesz oznaczać posty jako "obsłużone" / "do zignorowania"?

#### B6. Porównanie deweloperów
**Co:** Zestawienie deweloperów obok siebie: % negatywnych, śr. relevance, liczba grup.
**Jak wygląda:** Bar chart / tabela porównawcza (Robyg vs inni deweloperzy).
**Wartość:** Szybka odpowiedź na pytanie "u którego dewelopera jest najgorzej?".
**Pytanie do klienta:** Czy porównywanie deweloperów jest istotne operacyjnie?

#### B7. Filtry czasowe na dashboardzie
**Co:** Przełącznik: ostatnie 7 dni / 30 dni / 90 dni / cały okres.
**Jak wygląda:** Segmented control na górze dashboardu.
**Wartość:** KPI z kontekstem czasowym (a nie wszystko naraz).
**Pytanie do klienta:** Jakie okresy byłyby najbardziej przydatne?

---

### PRIORYTET NISKI (nice-to-have, przyszłość)

#### B8. Eksport PDF raportów
**Co:** Oprócz .docx, możliwość pobrania raportu jako PDF.
**Wartość:** PDF jest bardziej uniwersalny do wysyłki klientom.
**Pytanie do klienta:** Czy .docx wystarczy, czy potrzebujesz też PDF?

#### B9. Planowane raporty (harmonogram)
**Co:** Automatyczne generowanie raportów co miesiąc i wysyłka na email.
**Jak działa:** Cron: 1. dnia miesiąca → generuj raport za poprzedni miesiąc → wyślij email.
**Wartość:** Raporty pojawiają się same, bez logowania do systemu.
**Pytanie do klienta:** Jak często potrzebujesz raportów? Co miesiąc? Co tydzień?

#### B10. Multi-user (konta dla klientów deweloperów)
**Co:** Klienci-deweloperzy mogą sami logować się i widzieć raporty dla swojego dewelopera.
**Jak działa:** Konto read-only z filtrem na dewelopera.
**Wartość:** Skalowanie — zamiast wysyłać raporty mailem, klient sam sobie je pobiera.
**Pytanie do klienta:** Czy planujesz dawać klientom dostęp do systemu?

#### B11. Integracja z Email Analyzer
**Co:** Wspólny dashboard łączący dane z analizy emaili i FB — pełny obraz reputacji dewelopera.
**Jak wygląda:** Sekcja "Reputacja dewelopera" z danymi z emaili (administracja) + FB (mieszkańcy).
**Wartość:** Holistyczny widok — email pokazuje jak zarządca reaguje, FB jak mieszkańcy postrzegają.
**Pytanie do klienta:** Czy połączenie obu modułów byłoby wartościowe?

#### B12. Analiza komentarzy (nie tylko postów)
**Co:** AI analizuje też komentarze pod postami, nie tylko treść postów.
**Wartość:** Komentarze często zawierają więcej emocji i skarg niż same posty.
**Pytanie do klienta:** Czy komentarze są ważne? (Uwaga: zwiększa koszty AI i scrapowania)

---

## C. Pytania operacyjne do klienta

1. **Cookies FB** — czy masz aktualne cookies do scrapowania? Będą potrzebne dla 57 grup.
2. **Budget AI** — obecny model to GPT-5.1. Przy 57 grupach × ~100 postów/grupę × 2 calle AI/post = ~11 400 calli/miesiąc. Szacunkowy koszt: ~$15-25/miesiąc.
3. **Częstotliwość** — jak często chcesz scrapować? Codziennie (wyższy koszt) vs. co tydzień (wystarczający)?
4. **Priorytety** — z listy B1-B12, co jest najważniejsze? Proponuję zacząć od B1+B2 (automatyzacja) + B3 (alerty email).

---

## D. Sugerowana kolejność wdrażania

| Faza | Feature | Czas | Koszt AI/mies. |
|------|---------|------|----------------|
| **Teraz** | Operacyjne uruchomienie (57 grup, cookies, scrape, analiza) | 1 dzień | ~$15-25 |
| **v1.2** | B1 + B2: Automatyczne scrape + analiza (cron) | 2-3 dni | +$0 (ten sam) |
| **v1.3** | B3: Alerty email | 1-2 dni | +$0 |
| **v1.4** | B4 + B7: Dashboard z trendami + filtry czasowe | 2-3 dni | +$0 |
| **v1.5** | B5: Top negatywne posty + oznaczanie | 1-2 dni | +$0 |
| **Później** | B6, B8-B12 wg priorytetów klienta | — | — |
