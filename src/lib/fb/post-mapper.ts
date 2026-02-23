// Surowe pola aktora maja MEDIUM confidence. Mapper obsluguje brak pol gracefully.
// Potwierdzone pola z N8N workflow: createdAt, url, text.
// Reszta pol (author, reactions, comments, images) — fallbacki na kazde pole.

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface MappedFbPost {
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
}

export interface MappedFbComment {
  post_id: string;
  facebook_comment_id: string;
  author_name: string | null;
  content: string | null;
  posted_at: string | null;
}

// ---------------------------------------------------------------------------
// 1. Extract Facebook Post ID from URL
// ---------------------------------------------------------------------------

/**
 * Wyciaga unikalny identyfikator posta z URL-a Facebooka.
 * Obsluguje 3 patterny URL + fallback (nigdy nie zwraca pustego stringa).
 */
export function extractFacebookPostId(url: string): string {
  // Pattern 1: /groups/{groupId}/posts/{postId}
  const postsMatch = url.match(/\/groups\/[^/]+\/posts\/(\d+)/);
  if (postsMatch) return postsMatch[1];

  // Pattern 2: /permalink/{postId}
  const permalinkMatch = url.match(/\/permalink\/(\d+)/);
  if (permalinkMatch) return permalinkMatch[1];

  // Pattern 3: story_fbid={id} in query params
  const storyMatch = url.match(/story_fbid=(\d+)/);
  if (storyMatch) return storyMatch[1];

  // Fallback: caly URL jako ID (nigdy pusty string)
  console.warn('Could not extract post ID from URL, using full URL:', url);
  return url;
}

// ---------------------------------------------------------------------------
// 2. Map raw Apify post to FbPost DB row
// ---------------------------------------------------------------------------

/**
 * Mapuje surowy obiekt z Apify Actor na strukture MappedFbPost.
 * Kazde pole ma graceful fallback — brak pola nie powoduje bledu.
 */
export function mapApifyPostToFbPost(
  raw: Record<string, unknown>,
  groupId: string,
): MappedFbPost {
  // facebook_post_id: preferuj URL extraction, fallback na inne pola
  let facebookPostId: string;
  if (raw.url && typeof raw.url === 'string') {
    facebookPostId = extractFacebookPostId(raw.url);
  } else {
    facebookPostId = (
      (raw.postId as string) ||
      (raw.id as string) ||
      crypto.randomUUID()
    );
  }

  // posted_at: parsuj createdAt do ISO, fallback null
  let postedAt: string | null = null;
  if (raw.createdAt) {
    try {
      postedAt = new Date(raw.createdAt as string).toISOString();
    } catch {
      postedAt = null;
    }
  }

  return {
    group_id: groupId,
    facebook_post_id: facebookPostId,
    author_name: (raw.authorName as string) || (raw.author_name as string) || (raw.author as string) || null,
    content: (raw.text as string) || (raw.content as string) || (raw.message as string) || null,
    posted_at: postedAt,
    likes_count: Number(raw.likes ?? raw.likesCount ?? raw.reactions ?? 0),
    comments_count: Number(raw.comments ?? raw.commentsCount ?? 0),
    shares_count: Number(raw.shares ?? raw.sharesCount ?? 0),
    post_url: (raw.url as string) || null,
    media_url: (raw.image as string) || (raw.imageUrl as string) || ((raw.images as string[])?.[0]) || null,
  };
}

// ---------------------------------------------------------------------------
// 3. Map raw Apify comment to FbComment DB row
// ---------------------------------------------------------------------------

/**
 * Mapuje surowy obiekt komentarza z Apify na MappedFbComment.
 * Zwraca null jesli brak tresci (pomijamy puste komentarze).
 */
export function mapApifyCommentToFbComment(
  raw: Record<string, unknown>,
  postId: string,
): MappedFbComment | null {
  const content = (raw.text as string) || (raw.content as string) || null;

  // Pomijamy puste komentarze
  if (!content) return null;

  // posted_at: parsuj do ISO, fallback null
  let postedAt: string | null = null;
  if (raw.createdAt) {
    try {
      postedAt = new Date(raw.createdAt as string).toISOString();
    } catch {
      postedAt = null;
    }
  }

  return {
    post_id: postId,
    facebook_comment_id: (raw.commentId as string) || (raw.id as string) || crypto.randomUUID(),
    author_name: (raw.authorName as string) || (raw.author_name as string) || (raw.author as string) || null,
    content,
    posted_at: postedAt,
  };
}

// ---------------------------------------------------------------------------
// 4. Debug helper — loguj surowe dane z pierwszego scrapowania
// ---------------------------------------------------------------------------

/**
 * Loguje probke surowych danych z Apify do konsoli.
 * Wywolaj przy pierwszym scrapowaniu zeby zweryfikowac faktyczny schemat outputu.
 */
export function logRawPostSample(
  items: Record<string, unknown>[],
  count = 3,
): void {
  console.log(
    'Apify raw post sample:',
    JSON.stringify(items.slice(0, count), null, 2),
  );
}
