/**
 * Analysis Profiles — centralny rejestr profili analizy per-mailbox.
 *
 * Każdy profil definiuje:
 *  - threadConfig: prompt systemu i szablon promptu użytkownika dla analizy wątków (faza MAP)
 *  - reportSections: sekcje raportu z focus promptami (faza REDUCE)
 *  - systemPrompts: system prompty dla syntezy raportu (synthetic/standard)
 *
 * Profil `communication_audit` (domyślny) re-eksportuje istniejące DEFAULT_PROMPTS i THREAD_SUMMARY_*.
 * Profil `case_analytics` definiuje zupełnie inny zestaw sekcji.
 */

import type { AnalysisProfileId } from '@/types/email';
import {
  THREAD_SUMMARY_SECTION_KEY,
  THREAD_SUMMARY_SYSTEM_PROMPT,
  THREAD_SUMMARY_USER_PROMPT_TEMPLATE,
} from '@/lib/ai/thread-summary-prompt';
import {
  CASE_THREAD_SUMMARY_SECTION_KEY,
  CASE_THREAD_SYSTEM_PROMPT,
  CASE_THREAD_USER_PROMPT_TEMPLATE,
} from '@/lib/ai/profiles/case-analytics-prompts';
import { CASE_ANALYTICS_SECTIONS } from '@/lib/ai/profiles/case-analytics-sections';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadConfig {
  sectionKey: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface ProfileReportSection {
  section_key: string;
  title: string;
  section_order: number;
  /** Focus prompt for synthetic detail level */
  syntheticFocus: string;
  /** Focus prompt for standard detail level */
  standardFocus: string;
  /** Included in client report? */
  inClientReport: boolean;
}

export interface AnalysisProfile {
  id: AnalysisProfileId;
  label: string;
  description: string;
  threadConfig: ThreadConfig;
  reportSections: ProfileReportSection[];
  /** System prompt for synthetic report synthesis */
  syntheticSystemPrompt: string;
  /** System prompt for standard report synthesis */
  standardSystemPrompt: string;
  /**
   * When true, the report pipeline also loads DEFAULT_PROMPTS + DB overrides
   * for sections not defined in reportSections (backward compat).
   */
  usesDefaultPrompts: boolean;
}

// ---------------------------------------------------------------------------
// Profile: communication_audit (domyślny)
// ---------------------------------------------------------------------------

const communicationAuditProfile: AnalysisProfile = {
  id: 'communication_audit',
  label: 'Audyt komunikacji',
  description: 'Analiza jakości komunikacji — 13 sekcji oceny (domyślny)',
  threadConfig: {
    sectionKey: THREAD_SUMMARY_SECTION_KEY,
    systemPrompt: THREAD_SUMMARY_SYSTEM_PROMPT,
    userPromptTemplate: THREAD_SUMMARY_USER_PROMPT_TEMPLATE,
  },
  // communication_audit uses DEFAULT_PROMPTS via the existing pipeline
  reportSections: [],
  syntheticSystemPrompt: '',
  standardSystemPrompt: '',
  usesDefaultPrompts: true,
};

// ---------------------------------------------------------------------------
// Profile: case_analytics
// ---------------------------------------------------------------------------

const caseAnalyticsProfile: AnalysisProfile = {
  id: 'case_analytics',
  label: 'Analityka spraw',
  description: 'Analityka zgłoszeń — lokalizacje, etapy deweloperskie, typy spraw, problemy',
  threadConfig: {
    sectionKey: CASE_THREAD_SUMMARY_SECTION_KEY,
    systemPrompt: CASE_THREAD_SYSTEM_PROMPT,
    userPromptTemplate: CASE_THREAD_USER_PROMPT_TEMPLATE,
  },
  reportSections: CASE_ANALYTICS_SECTIONS,
  syntheticSystemPrompt: `Jesteś ekspertem ds. analityki zgłoszeniowej w zarządzaniu nieruchomościami. Tworzysz zwięzły raport syntetyczny z analizy korespondencji email.

ZASADY FORMATOWANIA — RAPORT SYNTETYCZNY (5-6 stron A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. Postępuj dokładnie wg FOKUS SEKCJI — jeśli wymaga tabeli, UŻYJ tabeli markdown. Jeśli wymaga listy, UŻYJ listy.
3. Po tabelach/listach dodaj rozbudowany akapit analityczny (8-12 zdań z wnioskami, wzorcami i konkretnymi danymi).
4. NIE opisuj wątków z osobna — podawaj WYŁĄCZNIE ogólne wnioski.
5. Styl: managerski brief — zwięzły, konkretny, z liczbami.
6. NIE używaj nagłówków # — tekst sekcji zaczyna się od razu od treści.
7. NIE powtarzaj obserwacji z innych sekcji.`,
  standardSystemPrompt: `Jesteś ekspertem ds. analityki zgłoszeniowej w zarządzaniu nieruchomościami. Tworzysz profesjonalny raport analityczny z korespondencji email.

ZASADY FORMATOWANIA — RAPORT STANDARDOWY (8-12 stron A4):
1. Pisz po polsku, językiem formalnym i rzeczowym.
2. STRUKTURA KAŻDEJ SEKCJI:
   a) Krótki akapit wprowadzający (2-3 zdania z kluczowym wnioskiem)
   b) Kluczowe obserwacje jako zwięzłe punkty (po 1-2 zdania, max 5-8 punktów)
3. NIE zaczynaj sekcji od nagłówka ## powtarzającego tytuł sekcji.
4. Podawaj konkretne dane: lokalizacje, liczbę zgłoszeń, typy spraw.
5. Jeśli FOKUS SEKCJI wymaga podsekcji, użyj nagłówków ## i ### — NIGDY nagłówka #.
6. Twórz tabele markdown TYLKO gdy wyraźnie wymagane w FOKUSIE SEKCJI.`,
  usesDefaultPrompts: false,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PROFILES: Record<AnalysisProfileId, AnalysisProfile> = {
  communication_audit: communicationAuditProfile,
  case_analytics: caseAnalyticsProfile,
};

export function getAnalysisProfile(id: AnalysisProfileId): AnalysisProfile {
  return PROFILES[id] ?? PROFILES.communication_audit;
}

