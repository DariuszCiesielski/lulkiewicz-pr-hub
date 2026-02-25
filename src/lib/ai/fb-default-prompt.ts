/**
 * Domyślny prompt do analizy postów FB.
 * Używany gdy brak custom prompta w tabeli prompt_templates (section_key: _fb_post_analysis).
 */
export const FB_DEFAULT_PROMPT = `Przeanalizuj poniższy post z grupy mieszkańców na Facebooku. Określ:
1. Sentyment (positive/negative/neutral)
2. Istotność dla zarządcy nieruchomości (0.0 - 1.0)
3. Krótkie podsumowanie (1-2 zdania)
4. Kategoria: usterka, skarga, pochwała, pytanie, inne

Zwróć szczególną uwagę na:
- Problemy wymagające interwencji zarządcy
- Powtarzające się skargi
- Kwestie bezpieczeństwa
- Pozytywne opinie (feedback na temat działań administracji)`;
