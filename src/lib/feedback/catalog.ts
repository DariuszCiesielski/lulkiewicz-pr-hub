import type {
  ClientFeedbackPayload,
  FeedbackChoice,
  FeedbackProposalState,
} from '@/types/feedback';

export interface FeedbackModuleDescription {
  id: string;
  title: string;
  description: string;
}

export interface FeedbackProposalDefinition {
  id: string;
  title: string;
}

export interface FeedbackProposalSection {
  id: string;
  title: string;
  items: FeedbackProposalDefinition[];
}

export const CURRENT_MODULES: FeedbackModuleDescription[] = [
  {
    id: 'email-analyzer',
    title: 'Analizator Email',
    description:
      'Synchronizacja Outlook, grupowanie wątków, analiza AI jakości komunikacji, raporty 13 sekcji, eksport Word, edytowalne szablony AI i profile analizy.',
  },
  {
    id: 'fb-analyzer',
    title: 'Analizator FB',
    description:
      'Monitoring 52+ grup, pobieranie postów, analiza sentymentu AI, słowa kluczowe per deweloper, raporty AI z analizą ogólną, ryzykiem PR i rekomendacjami, eksport Word oraz dashboard KPI.',
  },
];

export const FEEDBACK_PROPOSAL_SECTIONS: FeedbackProposalSection[] = [
  {
    id: 'email',
    title: 'Rozwój Analizatora Email',
    items: [
      { id: 'EA1', title: 'Automatyczne pobieranie wiadomości email' },
      { id: 'EA2', title: 'Alerty dla pilnych spraw i opóźnień' },
      { id: 'EA3', title: 'Ranking jakości pracy administracji' },
      { id: 'EA4', title: 'Eksport raportów do PDF' },
    ],
  },
  {
    id: 'fb',
    title: 'Rozwój Analizatora FB',
    items: [
      { id: 'FB1', title: 'Automatyczne pobieranie nowych postów' },
      { id: 'FB2', title: 'Automatyczna analiza AI po pobraniu postów' },
      { id: 'FB3', title: 'Alerty dla negatywnych postów i ryzyk PR' },
      { id: 'FB4', title: 'Wykresy trendów i zmian nastrojów' },
      { id: 'FB5', title: 'Lista negatywnych postów z oznaczaniem statusu' },
      { id: 'FB6', title: 'Porównanie wyników między deweloperami' },
      { id: 'FB7', title: 'Filtry czasowe dla analiz i raportów' },
      { id: 'FB8', title: 'Eksport raportów do PDF' },
      { id: 'FB9', title: 'Automatyczne raporty miesięczne' },
      { id: 'FB10', title: 'Analiza komentarzy pod postami' },
    ],
  },
  {
    id: 'general',
    title: 'Rozwiązania wspólne',
    items: [
      { id: 'O1', title: 'Wspólny dashboard dla Email i FB' },
      { id: 'O2', title: 'Konta i podgląd dla deweloperów' },
    ],
  },
];

export const FUTURE_TOOL_LABELS = [
  'Social Media Manager',
  'Generator Artykułów',
  'Cold Mailing',
  'Analizator Kampanii',
  'Kreator Stron WWW',
];

const PROPOSAL_MAP = new Map(
  FEEDBACK_PROPOSAL_SECTIONS.flatMap((section) =>
    section.items.map((item) => [item.id, item] as const)
  )
);

export const ALL_PROPOSAL_IDS = FEEDBACK_PROPOSAL_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.id)
);

function createEmptyProposalState(): FeedbackProposalState {
  return {
    choice: null,
    comment: '',
  };
}

export function isFeedbackChoice(value: unknown): value is FeedbackChoice {
  return value === 'interested' || value === 'not_interested';
}

export function createEmptyFeedbackPayload(): ClientFeedbackPayload {
  return {
    schemaVersion: 1,
    proposals: Object.fromEntries(
      ALL_PROPOSAL_IDS.map((proposalId) => [proposalId, createEmptyProposalState()])
    ) as Record<string, FeedbackProposalState>,
    futureToolsComment: '',
  };
}

export function normalizeClientFeedbackPayload(input: unknown): ClientFeedbackPayload {
  const initial = createEmptyFeedbackPayload();

  if (!input || typeof input !== 'object') {
    return initial;
  }

  const payload = input as {
    schemaVersion?: unknown;
    proposals?: Record<string, unknown>;
    futureToolsComment?: unknown;
  };

  const proposals = { ...initial.proposals };

  for (const proposalId of ALL_PROPOSAL_IDS) {
    const rawProposal = payload.proposals?.[proposalId];

    if (!rawProposal || typeof rawProposal !== 'object') {
      continue;
    }

    const proposal = rawProposal as {
      choice?: unknown;
      comment?: unknown;
    };

    proposals[proposalId] = {
      choice: isFeedbackChoice(proposal.choice) ? proposal.choice : null,
      comment: typeof proposal.comment === 'string' ? proposal.comment.trim() : '',
    };
  }

  return {
    schemaVersion:
      typeof payload.schemaVersion === 'number' && Number.isFinite(payload.schemaVersion)
        ? payload.schemaVersion
        : 1,
    proposals,
    futureToolsComment:
      typeof payload.futureToolsComment === 'string'
        ? payload.futureToolsComment.trim()
        : '',
  };
}

export function getMissingProposalTitles(feedback: ClientFeedbackPayload): string[] {
  return ALL_PROPOSAL_IDS.filter((proposalId) => !feedback.proposals[proposalId]?.choice)
    .map((proposalId) => PROPOSAL_MAP.get(proposalId)?.title || proposalId);
}

export function buildFeedbackEmailText(
  userEmail: string,
  createdAt: string,
  feedback: ClientFeedbackPayload
): string {
  const interested = ALL_PROPOSAL_IDS.filter(
    (proposalId) => feedback.proposals[proposalId]?.choice === 'interested'
  ).map((proposalId) => PROPOSAL_MAP.get(proposalId)?.title || proposalId);

  const notInterested = ALL_PROPOSAL_IDS.filter(
    (proposalId) => feedback.proposals[proposalId]?.choice === 'not_interested'
  ).map((proposalId) => PROPOSAL_MAP.get(proposalId)?.title || proposalId);

  const commentedItems = ALL_PROPOSAL_IDS.filter((proposalId) =>
    Boolean(feedback.proposals[proposalId]?.comment)
  ).map((proposalId) => {
    const title = PROPOSAL_MAP.get(proposalId)?.title || proposalId;
    return `- ${title}: ${feedback.proposals[proposalId].comment}`;
  });

  const createdLabel = new Date(createdAt).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    'Nowa odpowiedź w ankiecie "Propozycje rozwoju".',
    '',
    `Użytkownik: ${userEmail}`,
    `Data wysłania: ${createdLabel}`,
    '',
    'Zainteresowany:',
    interested.length > 0 ? interested.map((item) => `- ${item}`).join('\n') : '- Brak wskazań',
    '',
    'Niezainteresowany:',
    notInterested.length > 0
      ? notInterested.map((item) => `- ${item}`).join('\n')
      : '- Brak wskazań',
    '',
    'Komentarze do propozycji:',
    commentedItems.length > 0 ? commentedItems.join('\n') : '- Brak komentarzy',
    '',
    'Komentarz do przyszłych narzędzi:',
    feedback.futureToolsComment || 'Brak komentarza',
  ].join('\n');
}
