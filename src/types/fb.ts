// ============================================
// FB Analyzer — Domain Types
// Odzwierciedlaja schemat DB 1:1
// Migracje: 20260212_07_01_fb_analyzer.sql, 20260212_08_01_fb_groups_settings.sql
// ============================================

// --- Status & Enum Types ---

export type FbGroupStatus = 'active' | 'paused';

export type FbSentiment = 'positive' | 'negative' | 'neutral';

export type FbScrapeStatus = 'pending' | 'running' | 'downloading' | 'completed' | 'failed';

export type FbAnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export type FbReportStatus = 'draft' | 'generating' | 'completed' | 'failed';

// --- Domain Interfaces ---

export interface FbGroup {
  id: string;
  name: string;
  facebook_url: string;
  developer: string | null;
  status: FbGroupStatus;
  last_scraped_at: string | null;
  total_posts: number;
  apify_actor_id: string;
  created_at: string;
  updated_at: string;
  ai_instruction: string | null;      // Phase 8: instrukcja AI (co szukac w postach)
  deleted_at: string | null;          // Phase 8: soft delete timestamp
  cookies_encrypted: string | null;   // Phase 8: override cookies per grupa (encrypted)
}

export interface FbPost {
  id: string;
  group_id: string;
  facebook_post_id: string;
  author_name: string | null;
  content: string | null;
  posted_at: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  post_url: string | null;
  media_url: string | null;
  sentiment: FbSentiment | null;
  relevance_score: number | null;
  ai_snippet: string | null;
  ai_categories: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FbComment {
  id: string;
  post_id: string;
  facebook_comment_id: string;
  author_name: string | null;
  content: string | null;
  posted_at: string | null;
  sentiment: FbSentiment | null;
  created_at: string;
}

export interface FbScrapeJob {
  id: string;
  group_id: string;
  status: FbScrapeStatus;
  posts_found: number;
  posts_new: number;
  posts_updated: number;
  apify_run_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface FbAnalysisJob {
  id: string;
  group_id: string;
  status: FbAnalysisStatus;
  total_posts: number;
  analyzed_posts: number;
  progress: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface FbReport {
  id: string;
  title: string;
  content_markdown: string | null;
  summary_data: Record<string, unknown> | null;
  group_ids: string[] | null;
  date_from: string | null;
  date_to: string | null;
  status: FbReportStatus;
  created_at: string;
  updated_at: string;
}

// --- Phase 8: Settings & Enriched Types ---

export interface FbSettings {
  id: string;
  key: string;
  value_encrypted: string | null;
  value_plain: string | null;
  created_at: string;
  updated_at: string;
}

/** FbGroup wzbogacony o pola obliczane (z API response, nie z DB) */
export interface FbGroupEnriched extends FbGroup {
  relevant_posts: number;        // liczba istotnych postow (obliczana)
  has_custom_cookies: boolean;   // czy ma override cookies (flag, nie wartosc)
}

export type FbSettingsKey =
  | 'apify_token'
  | 'fb_cookies'
  | 'apify_actor_id'
  | `developer_instruction:${string}`;

// --- Phase 9: Scraping Types ---

export interface ApifyCookieObject {
  domain: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: string | null;
  secure: boolean;
  session: boolean;
  storeId: string | null;
  value: string;
}

export interface ApifyActorInput {
  cookie: ApifyCookieObject[];
  'scrapeGroupPosts.groupUrl': string;
  scrapeUntil: string;  // yyyy-M-dd (BEZ leading zero!)
  sortType: 'new_posts';
  minDelay: number;
  maxDelay: number;
  proxy: { useApifyProxy: boolean };
}

export interface ApifyRunStatusResponse {
  id: string;
  status: ApifyRunState;
  statusMessage: string | null;
  defaultDatasetId: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export type ApifyRunState =
  | 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  | 'TIMING-OUT' | 'TIMED-OUT' | 'ABORTING' | 'ABORTED';

export type ApifyStatusAction = 'keep_polling' | 'fetch_results' | 'mark_failed';

export interface ScrapeConfig {
  token: string;
  cookies: ApifyCookieObject[];
  actorId: string;
  groupUrl: string;
}

export type ScrapeUIStatus =
  'idle' | 'starting' | 'cookie_check' | 'running' | 'downloading' | 'completed' | 'error';

export interface ScrapeProgress {
  currentGroup: string | null;
  groupsTotal: number;
  groupsCompleted: number;
  postsFound: number;
  postsNew: number;
  postsUpdated: number;
  apifyStatus: string | null;
  estimatedWaitSeconds: number | null;
  isWaitingBetweenGroups: boolean;
  waitSecondsRemaining: number;
}

export interface ScrapeErrorInfo {
  message: string;
  suggestion: string;
}

// Mapowanie bledow Apify na komunikaty PL
export const SCRAPE_ERROR_MESSAGES: Record<string, ScrapeErrorInfo> = {
  'TIMED-OUT': {
    message: 'Scrapowanie przekroczylo limit czasu Apify',
    suggestion: 'Sprobuj ponownie. Jesli blad sie powtarza, zmniejsz zakres dat.',
  },
  'FAILED': {
    message: 'Apify Actor zakonczyl sie bledem',
    suggestion: 'Sprawdz logi w konsoli Apify. Moze byc problem z cookies lub proxy.',
  },
  'ABORTED': {
    message: 'Scrapowanie zostalo przerwane',
    suggestion: 'Run zostal recznie zatrzymany lub przekroczyl limit pamieci.',
  },
  'NO_TOKEN': {
    message: 'Brak skonfigurowanego tokenu Apify',
    suggestion: 'Przejdz do Ustawienia > Apify API Token i wklej swoj token.',
  },
  'NO_COOKIES': {
    message: 'Brak skonfigurowanych cookies Facebook',
    suggestion: 'Przejdz do Ustawienia > Facebook Cookies i wklej cookies z Cookie-Editor.',
  },
  'COOKIES_EXPIRED': {
    message: 'Cookies Facebook prawdopodobnie wygasly',
    suggestion: 'Zaloguj sie na dedykowane konto FB, wyeksportuj nowe cookies z Cookie-Editor i wklej w Ustawienia.',
  },
  'RATE_LIMITED': {
    message: 'Zbyt czeste scrapowanie — odczekaj przed kolejna proba',
    suggestion: 'Poczekaj minimum 3 minuty miedzy scrapowaniami roznych grup.',
  },
};
