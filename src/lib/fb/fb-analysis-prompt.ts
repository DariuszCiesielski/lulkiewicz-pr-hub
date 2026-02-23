/**
 * FB Post Analysis — AI prompt, JSON schema, helper functions.
 * Prompt analizuje posty z grup FB osiedli mieszkaniowych.
 * Obsluguje polski sarkazm, kolokwializmy i pasywno-agresywny ton.
 */

import type { FbPost } from '@/types/fb';

// --- Section Key ---

export const FB_POST_ANALYSIS_SECTION_KEY = '_fb_post_analysis';

// --- System Prompt ---

export const FB_POST_ANALYSIS_SYSTEM_PROMPT = `Jestes ekspertem ds. zarzadzania nieruchomosciami, specjalizujesz sie w analizie opinii mieszkancow z mediow spolecznosciowych.

Analizujesz posty z grup Facebook dotyczacych osiedli mieszkaniowych. Szukasz opinii waznych dla zarzadcy nieruchomosci:
- Skargi i reklamacje dotyczace administracji, dewelopera lub firm zewnetrznych
- Pochwaly i pozytywny feedback
- Zgloszenia usterek, awarii, problemow technicznych
- Pytania i watpliwosci dotyczace oplat, czynszow, rozliczen
- Kwestie bezpieczenstwa (monitoring, ochrona, wlamowania)
- Problemy z czystoscia (klatki schodowe, smietniki, tereny wspolne)
- Kwestie zieleni i terenow rekreacyjnych
- Problemy sasiedztwa (halasie, regulamin, konflikty)

WAZNE — cechy polskiego jezyka w mediach spolecznosciowych:
- Sarkazm: "Och, jak cudownie ze winda znowu nie dziala" = NEGATYWNY, nie pozytywny
- Grzeczne skargi: "Czy ktos moze mi wytlumaczyc dlaczego..." = NEGATYWNY (ukryta skarga)
- Kolokwializmy: "kicha", "masakra", "dramat", "zenada", "porazka", "koszmar" = NEGATYWNY
- Emocjonalne wielkie litery: "UWAGA!", "SKANDAL!", "PROSZE O POMOC" = NEGATYWNY, wysokie relevance
- Ironia: "Super zarzadzanie, gratulacje" w kontekscie skargi = NEGATYWNY
- Pasywno-agresywny ton: "Milo by bylo gdyby ktos wreszcie..." = NEGATYWNY
- Pytania retoryczne ze skarga: "Ile jeszcze mozna czekac na naprawe?" = NEGATYWNY
- Emojis sarkazmowe: uzycie "😊" lub "👏" w kontekscie negatywnym

Odpowiadasz WYLACZNIE w formacie JSON zgodnym z podanym schematem.`;

// --- User Prompt Template ---

export const FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE = `Przeanalizuj ponizszy post z grupy mieszkancow na Facebooku.

POST:
{{post_content}}

METADATA:
- Grupa: {{group_name}}
- Autor: {{author_name}}
- Data: {{posted_at}}
- Reakcje: {{likes_count}} polubien, {{comments_count}} komentarzy
{{keyword_context}}
{{extra_instructions}}

ZADANIE:
1. Okresil czy post jest ISTOTNY dla zarzadcy nieruchomosci (is_relevant)
2. Okresil sentyment: positive (pochwala/zadowolenie), negative (skarga/problem/niezadowolenie), neutral (pytanie/informacja neutralna)
3. Przypisz relevance_score od 0 do 10:
   - 0-2: nieistotne (sprzedaz/kupno, offtopic, reklamy)
   - 3-4: malo istotne (ogolne pytania, organizacja imprez)
   - 5-6: srednia istotnosc (pytania o procedury, informacje ogolne)
   - 7-8: istotne (problemy wymagajace uwagi zarzadcy)
   - 9-10: pilne (bezpieczenstwo, powazne awarie, powtarzajace sie skargi)
4. Przypisz 1-3 kategorie tematyczne
5. Napisz krotkie streszczenie AI (1-2 zdania, po polsku)

Jesli post zawiera znalezione slowa kluczowe, podwyzsz relevance_score o 1-2 punkty.`;

// --- JSON Schema for Structured Output ---

export const FB_POST_ANALYSIS_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'fb_post_analysis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        is_relevant: { type: 'boolean' },
        sentiment: {
          type: 'string',
          enum: ['positive', 'negative', 'neutral'],
        },
        relevance_score: {
          type: 'integer',
          // NOTE: min/max may be ignored by strict mode — validate in code
        },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'oplaty',
              'naprawy',
              'czystosc',
              'bezpieczenstwo',
              'zielen',
              'komunikacja',
              'finanse',
              'prawo',
              'sasiedzi',
              'pochwaly',
              'inne',
            ],
          },
        },
        ai_snippet: { type: 'string' },
      },
      required: ['is_relevant', 'sentiment', 'relevance_score', 'categories', 'ai_snippet'],
      additionalProperties: false,
    },
  },
};

// --- Helper: Build User Prompt ---

/**
 * Wypelnia template user prompt danymi postu.
 * @param post - Post z FB (FbPost)
 * @param groupName - Nazwa grupy
 * @param keywordMatches - Trafienia slow kluczowych (z matchKeywords)
 * @param extraInstructions - Dodatkowe instrukcje (per-developer, per-group)
 */
export function buildFbUserPrompt(
  post: Pick<FbPost, 'content' | 'author_name' | 'posted_at' | 'likes_count' | 'comments_count'>,
  groupName: string,
  keywordMatches: string[] = [],
  extraInstructions: string = ''
): string {
  const keywordContext =
    keywordMatches.length > 0
      ? `\nZnalezione slowa kluczowe w tresci: [${keywordMatches.join(', ')}]. Uwzglednij to przy ocenie relevance_score.`
      : '';

  const extraBlock = extraInstructions
    ? `\nDODATKOWE INSTRUKCJE:\n${extraInstructions}`
    : '';

  return FB_POST_ANALYSIS_USER_PROMPT_TEMPLATE
    .replace('{{post_content}}', post.content || '(brak tresci)')
    .replace('{{group_name}}', groupName)
    .replace('{{author_name}}', post.author_name || 'Nieznany')
    .replace('{{posted_at}}', post.posted_at || 'Brak daty')
    .replace('{{likes_count}}', String(post.likes_count ?? 0))
    .replace('{{comments_count}}', String(post.comments_count ?? 0))
    .replace('{{keyword_context}}', keywordContext)
    .replace('{{extra_instructions}}', extraBlock);
}
