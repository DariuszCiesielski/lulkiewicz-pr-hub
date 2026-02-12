// ============================================
// FB Analyzer — Domain Types
// Odzwierciedlaja schemat DB 1:1 (migracja 20260212_07_01_fb_analyzer.sql)
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
