# Handoff: Faza D — Strona promptów profile-aware

## Kontekst

Implementujemy **Analysis Profiles v2 (DB-driven)** — migrację profili analizy z hardcoded TS do bazy danych. Fazy A-C i E-F są UKOŃCZONE. Pozostała **Faza D**: uczynienie strony `/email-analyzer/prompts` świadomą profili.

### Co zostało zrobione

| Faza | Status | Opis |
|------|--------|------|
| A | DONE | Migracja SQL v2 w Supabase — tabela `analysis_profiles`, rozszerzenie `prompt_templates` (+profile_id, +synthetic_focus, +standard_focus, +model, +temperature, +max_tokens) |
| B | DONE | `src/lib/ai/profile-loader.ts` (loadProfile, loadProfileSections, loadGlobalContext, resolveProfileId, loadAllProfiles) + API `/api/analysis-profiles` (GET/POST) + `/api/analysis-profiles/[id]` (GET/PATCH/DELETE) |
| C | DONE | Pipeline integration — `analysis/process`, `reports/route`, `reports/process`, `report-synthesizer` — wszystko czyta prompty z DB |
| D | **TODO** | Strona promptów profile-aware |
| E | DONE | Dropdown profilu na `/analyze`, MailboxForm/List z DB, profile override per-analysis |
| F | DONE | Build przechodzi, interfejsy zaktualizowane |

### Kluczowe UUIDs w DB

- `communication_audit` = `ddd18b04-1182-46d4-a798-e72326162a9e`
- `case_analytics` = `d8c037cc-7f2a-445c-b4f8-be16cc25d5f4`

---

## Cel Fazy D

Strona `/email-analyzer/prompts` musi pozwalać na edycję promptów **per profil**, nie tylko globalnych (`tier='global'`). Obecnie strona:
- Czyta tylko `tier='global'` z `prompt_templates`
- Merguje z hardcoded `DEFAULT_PROMPTS` z `default-prompts.ts`
- Nie ma świadomości profili — traktuje wszystko jako jeden zestaw promptów

Po zmianach:
- Dropdown profilu u góry strony (jak na `/analyze`)
- Wybrany profil ładuje sekcje `tier='profile'` + `profile_id=UUID`
- Opcja "Global overrides" jako osobna pozycja w dropdown (istniejące zachowanie)
- Edycja zapisuje z poprawnym `profile_id` i `tier`

---

## Plan implementacji

### Krok 1: API — rozszerzenie `/api/prompts/route.ts`

**Obecny stan**: GET/POST/DELETE — tylko `tier='global'`, bez `profile_id`.

**Zmiany**:

1. **GET** — dodać opcjonalny query param `?profileId=UUID`:
   - Bez `profileId` → dotychczasowe zachowanie (global overrides + DEFAULT_PROMPTS merge)
   - Z `profileId` → pobierz `prompt_templates` WHERE `profile_id=UUID AND tier='profile' AND is_active=true`, posortowane po `section_order`
   - NIE merguj z DEFAULT_PROMPTS gdy ładujesz profil — profile mają swoje własne sekcje w DB

2. **POST** — dodać opcjonalny `profile_id` w body:
   - Bez `profile_id` → dotychczasowe zachowanie (tier='global', upsert po section_key)
   - Z `profile_id` → tier='profile', upsert po section_key + profile_id
   - Upsert pattern: deactivate existing (`is_active=false` WHERE section_key + profile_id + tier), insert new

3. **DELETE** — dodać opcjonalny `profile_id` w body:
   - Bez `profile_id` → dotychczasowe zachowanie (global tier)
   - Z `profile_id` → filtruj po profile_id + section_key

### Krok 2: UI — dropdown profilu na `prompts/page.tsx`

**Obecny stan**: Brak selektora profilu. Importuje `DEFAULT_PROMPTS` dla reset/delete logic.

**Zmiany**:

1. Dodaj stan:
   ```ts
   const [profiles, setProfiles] = useState<ProfileOption[]>([]);
   const [selectedProfileId, setSelectedProfileId] = useState<string>(''); // '' = global
   ```

2. Dodaj `useEffect` pobierający profile z `/api/analysis-profiles`.

3. Dodaj dropdown u góry strony:
   ```
   [▼ Profil: Global overrides      ]
           | Communication Audit    |
           | Case Analytics          |
   ```
   Wartości: `''` (global), `UUID1` (comm_audit), `UUID2` (case_analytics).

4. Zmień `fetchPrompts` — przekazuj `profileId` jako query param:
   ```ts
   const url = selectedProfileId
     ? `/api/prompts?profileId=${selectedProfileId}`
     : '/api/prompts';
   ```

5. Zmień `handleSave` — dodaj `profile_id` do body gdy `selectedProfileId !== ''`:
   ```ts
   body: JSON.stringify({
     ...promptData,
     profile_id: selectedProfileId || undefined,
   })
   ```

6. Zmień `handleReset`:
   - Dla globalnych → bez zmian (reset do DEFAULT_PROMPTS)
   - Dla profilowych → "reset" oznacza przywrócenie promptu z seed'a. Pobierz oryginalne sekcje z migracji? Alternatywnie: po prostu usuwaj override (is_active=false), a pipeline wróci do hardcoded fallback. Prostsze rozwiązanie.

7. Zmień `handleDelete` — przekaż `profile_id` w body.

8. Re-fetch prompts przy zmianie profilu (dodaj `selectedProfileId` do dependency array `useEffect` z `fetchPrompts`).

### Krok 3: Nowe kolumny w edytorze

Profile DB mają dodatkowe kolumny na `prompt_templates`, które warto wyeksponować w UI:

- **`synthetic_focus`** — focus prompt dla syntezy (raport syntetyczny). Tekstowe pole.
- **`standard_focus`** — focus prompt dla raportu standardowego. Tekstowe pole.
- Te pola pojawiają się **tylko** gdy edytujemy sekcje profilu (nie global).

Dodaj do edytora (opcjonalnie — rozdzielone `<hr>` lub accordion):
```
Tytuł sekcji: [...]
System prompt: [...]
User prompt template: [...]
---
Focus — raport syntetyczny: [...] (opcjonalne)
Focus — raport standardowy: [...] (opcjonalne)
```

Pola `model`, `temperature`, `max_tokens` — na razie zostaw bez UI (zaawansowane, per-section override). Są w DB, ale nie muszą być edytowalne w v1.

### Krok 4: Weryfikacja + build

- `npm run build` musi przejść bez błędów
- Zweryfikuj, że zmiana profilu w dropdown przeładowuje listę sekcji
- Zweryfikuj, że zapis promptu z profilem zapisuje poprawny `profile_id` i `tier='profile'`

---

## Kluczowe pliki do modyfikacji

| Plik | Co zmienić |
|------|-----------|
| `src/app/api/prompts/route.ts` | GET: ?profileId, POST: profile_id w body, DELETE: profile_id w body |
| `src/app/(hub)/email-analyzer/prompts/page.tsx` | Dropdown profilu, profile_id w fetch/save/delete, nowe pola focus |

## Pliki referencyjne (tylko czytaj)

| Plik | Po co |
|------|-------|
| `src/lib/ai/profile-loader.ts` | Zrozumienie LoadedProfile/LoadedSection typów |
| `src/app/api/analysis-profiles/route.ts` | Format odpowiedzi GET /api/analysis-profiles |
| `src/types/email.ts` | AnalysisProfileDb, PromptTemplateDb (schemat DB) |
| `src/lib/ai/default-prompts.ts` | DEFAULT_PROMPTS — używane przy global tier merge |
| `supabase/migrations/20260225_analysis_profiles_v2.sql` | Schemat tabel + seed data |

---

## Schemat DB — prompt_templates (po migracji v2)

```
id UUID PK
profile_id UUID FK → analysis_profiles(id) ON DELETE CASCADE  ← NOWE
section_key TEXT
tier TEXT ('default' | 'global' | 'profile' | 'per_report')
title TEXT
system_prompt TEXT
user_prompt_template TEXT
section_order INT
is_active BOOLEAN
in_internal_report BOOLEAN
in_client_report BOOLEAN
synthetic_focus TEXT  ← NOWE
standard_focus TEXT   ← NOWE
model TEXT            ← NOWE (na przyszłość)
temperature NUMERIC   ← NOWE (na przyszłość)
max_tokens INTEGER    ← NOWE (na przyszłość)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Tier logic:
- `default` — nigdy w DB, generowany runtime z DEFAULT_PROMPTS (hardcoded TS)
- `global` — globalne nadpisanie sekcji (profile_id=NULL), obecne zachowanie strony promptów
- `profile` — per-profil sekcje (profile_id=UUID), **nowe — Faza D**
- `per_report` — na przyszłość (per-raport override)

---

## Gotchas

1. **Migracja seed data** — w DB jest już 20 sekcji `tier='profile'` z migracjami (14 comm_audit + 6 case_analytics). Strona promptów powinna je wyświetlić po wybraniu profilu.

2. **Nie mieszaj tier** — gdy wybrany jest profil, czytaj/zapisuj `tier='profile'` z `profile_id=UUID`. Gdy wybrany global, czytaj/zapisuj `tier='global'` z `profile_id=NULL`.

3. **DEFAULT_PROMPTS merge** — dotyczy TYLKO widoku globalnego. Przy profilu, lista sekcji pochodzi w 100% z DB.

4. **Komunikat "Domyślny" vs "Zmodyfikowany"** — przy profilu, tier jest zawsze 'profile'. Porównanie z DEFAULT_PROMPTS nie ma sensu. Rozważ: pokazuj "Z seed" vs "Zmodyfikowany" (na podstawie `created_at` vs `updated_at`?) lub po prostu nie pokazuj tego badge'a dla profili.

5. **"Resetuj do domyślnego"** — przy profilu, nie ma prostego "domyślnego" jak DEFAULT_PROMPTS. Opcje:
   - Usuń sekcję (is_active=false) → pipeline użyje fallback (co może nie być idealne)
   - Nie pokazuj przycisku reset dla sekcji profilu
   - **Rekomendacja**: nie pokazuj przycisku reset dla profili — admin edytuje profil na stałe

6. **Supabase konwencje**: `Record<string, unknown>` cast, `getAdminClient()` lazy init, `verifyScopedAdminAccess()` na początku każdego route.

7. **Projekt jest po polsku** (UI) — nowe labele, placeholdery, komunikaty muszą być po polsku.

---

## Rozpoczęcie pracy

```bash
# 1. Przeczytaj ten handoff
# 2. Przeczytaj pliki referencyjne
# 3. Zacznij od API (krok 1)
# 4. Potem UI (krok 2-3)
# 5. Build + test (krok 4)
```
