'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, ExternalLink, Search, Filter, Loader2,
} from 'lucide-react';

interface FbPost {
  id: string;
  group_id: string;
  group_name: string;
  author_name: string | null;
  content: string | null;
  posted_at: string | null;
  post_url: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  relevance_score: number | null;
  ai_snippet: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
}

interface FbGroup {
  id: string;
  name: string;
}

const sentimentConfig = {
  positive: { label: 'Pozytywny', bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  negative: { label: 'Negatywny', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  neutral: { label: 'Neutralny', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FbPostsPage() {
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [relevantOnly, setRelevantOnly] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (filterGroup !== 'all') params.set('group_id', filterGroup);
      if (filterSentiment !== 'all') params.set('sentiment', filterSentiment);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (relevantOnly) params.set('relevant_only', 'true');

      const res = await fetch(`/api/fb-posts?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Błąd (${res.status})`);
      }
      const data = await res.json();
      setPosts(data as FbPost[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    }
  }, [filterGroup, filterSentiment, searchQuery, relevantOnly]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/fb-groups');
      if (res.ok) {
        const data = await res.json();
        setGroups((data as FbGroup[]).map((g) => ({ id: g.id, name: g.name })));
      }
    } catch {
      // Non-critical — group filter just won't populate
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPosts(), fetchGroups()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) fetchPosts();
  }, [filterGroup, filterSentiment, relevantOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search — refetch 500ms after user stops typing
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => fetchPosts(), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Posty
        </h1>
        <button
          onClick={() => setRelevantOnly((v) => !v)}
          className="rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-opacity"
          style={{
            backgroundColor: relevantOnly ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.10)',
            color: relevantOnly ? '#a78bfa' : '#8b5cf6',
            opacity: relevantOnly ? 1 : 0.6,
          }}
        >
          {relevantOnly ? '✓ Tylko istotne' : 'Tylko istotne'}
        </button>
      </div>

      {/* Filters */}
      <div
        className="rounded-lg border p-3 mb-4 flex flex-wrap gap-3 items-center"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Szukaj w treści postów..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="rounded-md border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <option value="all">Wszystkie grupy</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value)}
            className="rounded-md border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <option value="all">Wszystkie sentyment</option>
            <option value="negative">Negatywne</option>
            <option value="positive">Pozytywne</option>
            <option value="neutral">Neutralne</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {loading ? 'Ładowanie...' : `Wyświetlono ${posts.length} postów`}
      </p>

      {/* Error */}
      {error && (
        <div className="rounded-lg border p-3 mb-4 text-sm" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && !error && (
        <div className="text-center py-12">
          <MessageSquare className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Brak postów{relevantOnly ? ' spełniających kryteria istotności' : ''}. Uruchom scrapowanie, żeby pobrać posty z grup FB.
          </p>
        </div>
      )}

      {/* Post list */}
      <div className="space-y-3">
        {posts.map((post) => {
          const sentimentKey = post.sentiment as keyof typeof sentimentConfig | null;
          const sentiment = sentimentKey ? sentimentConfig[sentimentKey] : null;
          // DB: relevance_score 0-10, UI: 0-1
          const relevanceNorm = post.relevance_score != null ? post.relevance_score / 10 : null;

          return (
            <div
              key={post.id}
              className="rounded-lg border p-4"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              {/* Content */}
              <p
                className="text-sm mb-2 line-clamp-3"
                style={{ color: 'var(--text-primary)' }}
              >
                {post.content || '(brak treści)'}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {post.author_name || 'Anonim'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {post.posted_at ? formatDate(post.posted_at) : '—'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {post.group_name}
                </span>
                {(post.likes_count > 0 || post.comments_count > 0) && (
                  <>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {post.likes_count > 0 && `${post.likes_count} reakcji`}
                      {post.likes_count > 0 && post.comments_count > 0 && ', '}
                      {post.comments_count > 0 && `${post.comments_count} komentarzy`}
                    </span>
                  </>
                )}
              </div>

              {/* AI summary */}
              {post.ai_snippet && (
                <p
                  className="text-xs italic mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  AI: {post.ai_snippet}
                </p>
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Sentiment badge */}
                  {sentiment && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: sentiment.bg, color: sentiment.color }}
                    >
                      {sentiment.label}
                    </span>
                  )}

                  {/* Relevance */}
                  {relevanceNorm != null && (
                    <div className="flex items-center gap-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: '60px',
                          backgroundColor: 'var(--border-primary)',
                        }}
                      >
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${relevanceNorm * 100}%`,
                            backgroundColor: relevanceNorm > 0.8 ? '#ef4444' :
                              relevanceNorm > 0.6 ? '#f97316' : '#94a3b8',
                          }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {Math.round(relevanceNorm * 100)}%
                      </span>
                    </div>
                  )}

                  {/* No analysis badge */}
                  {!sentiment && !relevanceNorm && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{ backgroundColor: 'rgba(148, 163, 184, 0.10)', color: 'var(--text-muted)' }}
                    >
                      Oczekuje analizy
                    </span>
                  )}
                </div>

                {/* FB link */}
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:opacity-80"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Otwórz na FB
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
