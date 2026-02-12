// Mock data for FB Analyzer demo UI
// All data is hardcoded — will be replaced with real API calls in later phases

export interface MockFbGroup {
  id: string;
  name: string;
  facebook_url: string;
  developer: string;
  status: 'active' | 'paused';
  total_posts: number;
  relevant_posts: number;
  last_scrape_at: string | null;
  created_at: string;
}

export interface MockFbPost {
  id: string;
  group_id: string;
  group_name: string;
  author_name: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance_score: number;
  ai_summary: string;
  facebook_url: string;
  posted_at: string;
  analyzed_at: string;
}

export interface MockScrapeJob {
  id: string;
  group_id: string;
  group_name: string;
  status: 'completed' | 'running' | 'failed';
  posts_found: number;
  started_at: string;
  finished_at: string | null;
  error?: string;
}

export interface MockAnalysisJob {
  id: string;
  group_id: string;
  group_name: string;
  status: 'completed' | 'running' | 'failed';
  total_posts: number;
  analyzed_posts: number;
  started_at: string;
  finished_at: string | null;
}

export interface MockFbReport {
  id: string;
  title: string;
  status: 'completed' | 'draft';
  groups: string[];
  date_from: string;
  date_to: string;
  created_at: string;
}

// --- Groups ---

export const mockGroups: MockFbGroup[] = [
  {
    id: 'grp-1',
    name: 'Mieszkańcy Royal Apartments Mokotów',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow',
    developer: 'Royal Apartments',
    status: 'active',
    total_posts: 342,
    relevant_posts: 47,
    last_scrape_at: '2026-02-12T08:30:00Z',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'grp-2',
    name: 'Osiedle Sady Ursynów - forum mieszkańców',
    facebook_url: 'https://www.facebook.com/groups/sadyursynow',
    developer: 'Sady Ursynów',
    status: 'active',
    total_posts: 218,
    relevant_posts: 31,
    last_scrape_at: '2026-02-12T07:15:00Z',
    created_at: '2026-01-20T14:00:00Z',
  },
];

// --- Posts ---

export const mockPosts: MockFbPost[] = [
  {
    id: 'post-1',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    author_name: 'Anna Kowalska',
    content: 'Już trzeci tydzień z rzędu nie działa winda w klatce B. Zgłaszałam do administracji dwukrotnie, bez odpowiedzi. Czy ktoś jeszcze ma ten problem?',
    sentiment: 'negative',
    relevance_score: 0.92,
    ai_summary: 'Awaria windy w klatce B — brak reakcji administracji, powtarzające się zgłoszenia.',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow/posts/001',
    posted_at: '2026-02-11T18:45:00Z',
    analyzed_at: '2026-02-12T08:35:00Z',
  },
  {
    id: 'post-2',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    author_name: 'Tomasz Wiśniewski',
    content: 'Chciałbym pochwalić nową firmę sprzątającą — korytarze i klatki schodowe wyglądają zdecydowanie lepiej niż przed miesiącem. Widać różnicę!',
    sentiment: 'positive',
    relevance_score: 0.78,
    ai_summary: 'Pozytywna opinia o nowej firmie sprzątającej — widoczna poprawa czystości.',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow/posts/002',
    posted_at: '2026-02-10T12:20:00Z',
    analyzed_at: '2026-02-12T08:35:00Z',
  },
  {
    id: 'post-3',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    author_name: 'Katarzyna Nowak',
    content: 'Czy ktoś wie kiedy planowany jest remont parkingu podziemnego? Na ostatnim zebraniu wspólnoty była o tym mowa, ale nie dostałam żadnej informacji na piśmie.',
    sentiment: 'neutral',
    relevance_score: 0.65,
    ai_summary: 'Pytanie o termin remontu parkingu — brak oficjalnej komunikacji po zebraniu wspólnoty.',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow/posts/003',
    posted_at: '2026-02-09T09:10:00Z',
    analyzed_at: '2026-02-12T08:35:00Z',
  },
  {
    id: 'post-4',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    author_name: 'Marek Zieliński',
    content: 'UWAGA! Na parkingu znowu ktoś włamuje się do aut. W nocy z środy na czwartek uszkodzono dwa samochody. Monitoring podobno nie działał. Zarządca musi to naprawić natychmiast!',
    sentiment: 'negative',
    relevance_score: 0.95,
    ai_summary: 'Włamania na parkingu — monitoring nie działał, mieszkaniec żąda natychmiastowej interwencji zarządcy.',
    facebook_url: 'https://www.facebook.com/groups/sadyursynow/posts/004',
    posted_at: '2026-02-11T07:30:00Z',
    analyzed_at: '2026-02-12T07:20:00Z',
  },
  {
    id: 'post-5',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    author_name: 'Ewa Mazur',
    content: 'Dzięki za szybką naprawę oświetlenia przy wejściu do bloku 3. Zgłosiłam w poniedziałek, w środę już było naprawione. Tak trzymać!',
    sentiment: 'positive',
    relevance_score: 0.72,
    ai_summary: 'Pochwała za szybką naprawę oświetlenia — reakcja w 2 dni.',
    facebook_url: 'https://www.facebook.com/groups/sadyursynow/posts/005',
    posted_at: '2026-02-10T16:50:00Z',
    analyzed_at: '2026-02-12T07:20:00Z',
  },
  {
    id: 'post-6',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    author_name: 'Piotr Lewandowski',
    content: 'Ogrzewanie w mieszkaniach na 5 piętrze jest stanowczo za słabe. Temperatura w pokojach nie przekracza 18°C mimo ustawienia termostatów na max. Kto jeszcze ma ten problem?',
    sentiment: 'negative',
    relevance_score: 0.88,
    ai_summary: 'Problem z ogrzewaniem na 5 piętrze — za niska temperatura mimo max ustawień termostatów.',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow/posts/006',
    posted_at: '2026-02-08T20:15:00Z',
    analyzed_at: '2026-02-12T08:35:00Z',
  },
  {
    id: 'post-7',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    author_name: 'Joanna Kamińska',
    content: 'Czy administracja planuje jakieś atrakcje na Dzień Dziecka na terenie osiedla? W ubiegłym roku było super, dzieci były zachwycone. Chętnie pomogę w organizacji.',
    sentiment: 'neutral',
    relevance_score: 0.45,
    ai_summary: 'Pytanie o organizację Dnia Dziecka — mieszkanka oferuje pomoc.',
    facebook_url: 'https://www.facebook.com/groups/sadyursynow/posts/007',
    posted_at: '2026-02-07T14:30:00Z',
    analyzed_at: '2026-02-12T07:20:00Z',
  },
  {
    id: 'post-8',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    author_name: 'Robert Dąbrowski',
    content: 'Trzeci miesiąc z rzędu rachunek za wodę jest zawyżony o ~30%. Sąsiedzi mają to samo. Chyba wodomierz główny jest wadliwy. Ktoś jeszcze to zauważył?',
    sentiment: 'negative',
    relevance_score: 0.90,
    ai_summary: 'Zawyżone rachunki za wodę (+30%) — podejrzenie wadliwego wodomierza głównego.',
    facebook_url: 'https://www.facebook.com/groups/sadyursynow/posts/008',
    posted_at: '2026-02-06T11:00:00Z',
    analyzed_at: '2026-02-12T07:20:00Z',
  },
  {
    id: 'post-9',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    author_name: 'Magdalena Wójcik',
    content: 'Nowy plac zabaw jest fantastyczny! Dzieci spędzają tam godziny. Dziękuję administracji za inwestycję w tę przestrzeń.',
    sentiment: 'positive',
    relevance_score: 0.68,
    ai_summary: 'Zadowolenie z nowego placu zabaw — pozytywny odbiór inwestycji.',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow/posts/009',
    posted_at: '2026-02-05T15:40:00Z',
    analyzed_at: '2026-02-12T08:35:00Z',
  },
  {
    id: 'post-10',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    author_name: 'Andrzej Grabowski',
    content: 'Czy ktoś wie, kiedy zostaną wymienione drzwi wejściowe do klatki A? Obecne są nieszczelne i hałas z ulicy jest nie do zniesienia.',
    sentiment: 'neutral',
    relevance_score: 0.70,
    ai_summary: 'Pytanie o wymianę nieszczelnych drzwi wejściowych klatki A — problem z hałasem.',
    facebook_url: 'https://www.facebook.com/groups/royalapartmentsmokotow/posts/010',
    posted_at: '2026-02-04T10:25:00Z',
    analyzed_at: '2026-02-12T08:35:00Z',
  },
];

// --- Scrape Jobs ---

export const mockScrapeJobs: MockScrapeJob[] = [
  {
    id: 'scrape-1',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    status: 'completed',
    posts_found: 24,
    started_at: '2026-02-12T08:25:00Z',
    finished_at: '2026-02-12T08:30:00Z',
  },
  {
    id: 'scrape-2',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    status: 'completed',
    posts_found: 18,
    started_at: '2026-02-12T07:10:00Z',
    finished_at: '2026-02-12T07:15:00Z',
  },
  {
    id: 'scrape-3',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    status: 'running',
    posts_found: 7,
    started_at: '2026-02-12T10:00:00Z',
    finished_at: null,
  },
  {
    id: 'scrape-4',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    status: 'failed',
    posts_found: 0,
    started_at: '2026-02-11T22:00:00Z',
    finished_at: '2026-02-11T22:01:00Z',
    error: 'Apify API timeout — spróbuj ponownie za kilka minut',
  },
];

// --- Analysis Jobs ---

export const mockAnalysisJobs: MockAnalysisJob[] = [
  {
    id: 'analysis-1',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    status: 'completed',
    total_posts: 24,
    analyzed_posts: 24,
    started_at: '2026-02-12T08:32:00Z',
    finished_at: '2026-02-12T08:35:00Z',
  },
  {
    id: 'analysis-2',
    group_id: 'grp-2',
    group_name: 'Osiedle Sady Ursynów - forum mieszkańców',
    status: 'completed',
    total_posts: 18,
    analyzed_posts: 18,
    started_at: '2026-02-12T07:16:00Z',
    finished_at: '2026-02-12T07:20:00Z',
  },
  {
    id: 'analysis-3',
    group_id: 'grp-1',
    group_name: 'Mieszkańcy Royal Apartments Mokotów',
    status: 'running',
    total_posts: 7,
    analyzed_posts: 3,
    started_at: '2026-02-12T10:05:00Z',
    finished_at: null,
  },
];

// --- Reports ---

export const mockReports: MockFbReport[] = [
  {
    id: 'rpt-1',
    title: 'Raport tygodniowy — grupy FB (5-12 luty)',
    status: 'completed',
    groups: ['Mieszkańcy Royal Apartments Mokotów', 'Osiedle Sady Ursynów - forum mieszkańców'],
    date_from: '2026-02-05',
    date_to: '2026-02-12',
    created_at: '2026-02-12T09:00:00Z',
  },
  {
    id: 'rpt-2',
    title: 'Raport miesięczny — Royal Apartments (styczeń)',
    status: 'draft',
    groups: ['Mieszkańcy Royal Apartments Mokotów'],
    date_from: '2026-01-01',
    date_to: '2026-01-31',
    created_at: '2026-02-01T10:00:00Z',
  },
];

// --- KPI ---

export const mockKpi = {
  totalGroups: mockGroups.length,
  relevantPosts: mockPosts.length,
  negativePosts: mockPosts.filter((p) => p.sentiment === 'negative').length,
  lastScrape: '12 min temu',
  avgRelevance: Math.round(
    (mockPosts.reduce((sum, p) => sum + p.relevance_score, 0) / mockPosts.length) * 100
  ),
};

// --- Developer summaries ---

export const mockDeveloperSummaries = [
  {
    developer: 'Royal Apartments',
    groups: 1,
    relevantPosts: mockPosts.filter((p) => p.group_id === 'grp-1').length,
    negativePosts: mockPosts.filter((p) => p.group_id === 'grp-1' && p.sentiment === 'negative').length,
    topIssue: 'Awaria windy klatka B',
  },
  {
    developer: 'Sady Ursynów',
    groups: 1,
    relevantPosts: mockPosts.filter((p) => p.group_id === 'grp-2').length,
    negativePosts: mockPosts.filter((p) => p.group_id === 'grp-2' && p.sentiment === 'negative').length,
    topIssue: 'Włamania na parkingu',
  },
];

// --- Default AI Prompt ---

export const defaultFbPrompt = `Przeanalizuj poniższy post z grupy mieszkańców na Facebooku. Określ:
1. Sentyment (positive/negative/neutral)
2. Istotność dla zarządcy nieruchomości (0.0 - 1.0)
3. Krótkie podsumowanie (1-2 zdania)
4. Kategoria: usterka, skarga, pochwała, pytanie, inne

Zwróć szczególną uwagę na:
- Problemy wymagające interwencji zarządcy
- Powtarzające się skargi
- Kwestie bezpieczeństwa
- Pozytywne opinie (feedback na temat działań administracji)`;
