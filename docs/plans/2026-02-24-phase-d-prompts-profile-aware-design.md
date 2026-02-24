# Design: Faza D — Strona promptów profile-aware

## Cel

Strona `/email-analyzer/prompts` musi pozwalać na edycję promptów **per profil analizy** (nie tylko globalnych). Dropdown u góry strony przełącza między trybem "Globalne nadpisania" a konkretnymi profilami (Audyt komunikacji, Analityka spraw).

## Podejście

- **Reset profili**: przez najstarszy wiersz w DB (seed z migracji SQL). Query MIN(created_at) dla section_key + profile_id.
- **Pliki do modyfikacji**: `src/app/api/prompts/route.ts` + `src/app/(hub)/email-analyzer/prompts/page.tsx`

## API — /api/prompts/route.ts

### GET
- `?profileId=UUID` → prompt_templates WHERE profile_id=UUID AND tier='profile' AND is_active=true, sorted by section_order. BEZ merge z DEFAULT_PROMPTS.
- Bez profileId → istniejące zachowanie (global + DEFAULT_PROMPTS merge).
- `?profileId=UUID&seed=true&sectionKey=X` → najstarszy wiersz (seed) dla resetu.

### POST
- Nowe opcjonalne pole `profile_id` w body.
- Z profile_id → tier='profile', deactivate po section_key + profile_id + tier='profile'.
- Nowe pola: `synthetic_focus`, `standard_focus` (opcjonalne).

### DELETE
- Nowe opcjonalne pole `profile_id` w body.
- Z profile_id → filtr po profile_id + section_key + tier='profile'.

## UI — prompts/page.tsx

### Dropdown profilu
- Stan: `selectedProfileId` ('' = global, UUID = profil).
- Profile pobierane z GET /api/analysis-profiles.
- Opcje: "Globalne nadpisania" | "Audyt komunikacji" | "Analityka spraw".

### Editor — nowe pola focus
- `synthetic_focus` i `standard_focus` — textarea widoczne tylko gdy selectedProfileId !== ''.
- Label: "Focus — raport syntetyczny", "Focus — raport standardowy".

### Reset
- Global: istniejący reset do DEFAULT_PROMPTS (bez zmian).
- Profil: "Resetuj do seeda" — pobiera seed z GET ?seed=true, zapisuje POST z seed content.
- Badge: profil zawsze "Profilowy" (nie "Domyślny/Zmodyfikowany").

### Zachowania per-tryb
- Global: checkboxy W/K, copy, delete custom, reorder — bez zmian.
- Profil: checkboxy W/K, copy, reorder — zachowane. Delete — tylko custom (nie seed). Reset — seed.
- "Dodaj sekcję" — działa w obu trybach (global: tier='global', profil: tier='profile' + profile_id).
