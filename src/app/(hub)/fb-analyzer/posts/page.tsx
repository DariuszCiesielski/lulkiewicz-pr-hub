'use client';

import { useState, useMemo } from 'react';
import {
  MessageSquare, ExternalLink, Search, Filter,
} from 'lucide-react';
import { mockPosts, mockGroups } from '@/lib/mock/fb-mock-data';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterSentiment, setFilterSentiment] = useState('all');

  const filteredPosts = useMemo(() => {
    return mockPosts.filter((post) => {
      if (filterGroup !== 'all' && post.group_id !== filterGroup) return false;
      if (filterSentiment !== 'all' && post.sentiment !== filterSentiment) return false;
      if (searchQuery && !post.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [searchQuery, filterGroup, filterSentiment]);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="h-6 w-6" style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Posty
        </h1>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
          }}
        >
          Tylko istotne
        </span>
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
            {mockGroups.map((g) => (
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
        Wyświetlono {filteredPosts.length} z {mockPosts.length} postów
      </p>

      {/* Post list */}
      <div className="space-y-3">
        {filteredPosts.map((post) => {
          const sentiment = sentimentConfig[post.sentiment];
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
                className="text-sm mb-2 line-clamp-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {post.content}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {post.author_name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(post.posted_at)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {post.group_name}
                </span>
              </div>

              {/* AI summary */}
              <p
                className="text-xs italic mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                AI: {post.ai_summary}
              </p>

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Sentiment badge */}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: sentiment.bg, color: sentiment.color }}
                  >
                    {sentiment.label}
                  </span>

                  {/* Relevance */}
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
                          width: `${post.relevance_score * 100}%`,
                          backgroundColor: post.relevance_score > 0.8 ? '#ef4444' :
                            post.relevance_score > 0.6 ? '#f97316' : '#94a3b8',
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(post.relevance_score * 100)}%
                    </span>
                  </div>
                </div>

                {/* FB link */}
                <a
                  href={post.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs hover:opacity-80"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Otwórz na FB
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
