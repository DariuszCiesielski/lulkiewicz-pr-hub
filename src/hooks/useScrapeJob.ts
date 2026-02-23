'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ScrapeUIStatus, ScrapeProgress, ScrapeErrorInfo } from '@/types/fb';
import { SCRAPE_ERROR_MESSAGES } from '@/types/fb';

// --- Constants ---

const POLL_INTERVAL_MS = 5_000;     // 5s — Apify runy trwaja minuty
const DOWNLOAD_INTERVAL_MS = 2_000; // 2s — szybciej przy pobieraniu wynikow
const MIN_DELAY_MS = 180_000;       // 180s = 3 min
const MAX_DELAY_MS = 360_000;       // 360s = 6 min

// --- Interface ---

export interface UseScrapeJobReturn {
  startScrape: (groupId: string, groupName?: string) => Promise<void>;
  startBulkScrape: (groups: Array<{ id: string; name: string }>) => Promise<void>;
  status: ScrapeUIStatus;
  progress: ScrapeProgress;
  error: ScrapeErrorInfo | null;
  jobId: string | null;
  reset: () => void;
  cookieCheckWarning: string | null;
  proceedAfterWarning: () => void;
}

// --- Initial state ---

const INITIAL_PROGRESS: ScrapeProgress = {
  currentGroup: null,
  groupsTotal: 0,
  groupsCompleted: 0,
  postsFound: 0,
  postsNew: 0,
  postsUpdated: 0,
  apifyStatus: null,
  estimatedWaitSeconds: null,
  isWaitingBetweenGroups: false,
  waitSecondsRemaining: 0,
};

// --- Hook ---

export function useScrapeJob(onComplete?: () => void): UseScrapeJobReturn {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ScrapeUIStatus>('idle');
  const [progress, setProgress] = useState<ScrapeProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<ScrapeErrorInfo | null>(null);

  // Cookie check state
  const [cookieCheckWarning, setCookieCheckWarning] = useState<string | null>(null);
  const skipCookieCheckRef = useRef(false);
  const cookieCheckGroupRef = useRef<{ id: string; name?: string } | null>(null);

  // Refs
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Clear timeout helper
  const clearPollTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // --- Polling loop ---

  const pollScrapeProcess = useCallback(async (jId: string) => {
    if (!mountedRef.current) return;

    try {
      const res = await fetch('/api/fb/scrape/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jId }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Blad HTTP ${res.status}` }));
        const errorKey = data.suggestion ? null : Object.keys(SCRAPE_ERROR_MESSAGES).find(k => data.error?.includes(k));
        setStatus('error');
        setError({
          message: data.error || `Blad scrapowania (HTTP ${res.status})`,
          suggestion: data.suggestion || (errorKey ? SCRAPE_ERROR_MESSAGES[errorKey].suggestion : 'Sprobuj ponownie pozniej.'),
        });
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      // Handle failed status
      if (data.status === 'failed') {
        setStatus('error');
        setError({
          message: data.error || 'Scrapowanie nie powiodlo sie',
          suggestion: data.suggestion || 'Sprawdz logi i sprobuj ponownie.',
        });
        return;
      }

      // Handle running
      if (data.status === 'running') {
        setStatus('running');
        setProgress(prev => ({
          ...prev,
          apifyStatus: data.apifyStatus || null,
        }));
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) pollScrapeProcess(jId);
        }, POLL_INTERVAL_MS);
        return;
      }

      // Handle downloading
      if (data.status === 'downloading') {
        setStatus('downloading');
        setProgress(prev => ({
          ...prev,
          postsFound: data.postsFound ?? prev.postsFound,
          postsNew: data.postsNew ?? prev.postsNew,
          postsUpdated: data.postsUpdated ?? prev.postsUpdated,
        }));

        if (data.hasMore) {
          timeoutRef.current = setTimeout(() => {
            if (mountedRef.current) pollScrapeProcess(jId);
          }, DOWNLOAD_INTERVAL_MS);
        }
        return;
      }

      // Handle completed
      if (data.status === 'completed') {
        setStatus('completed');
        setProgress(prev => ({
          ...prev,
          postsFound: data.postsFound ?? prev.postsFound,
          postsNew: data.postsNew ?? prev.postsNew,
          postsUpdated: data.postsUpdated ?? prev.postsUpdated,
        }));
        onCompleteRef.current?.();
        return;
      }

      // hasMore — kontynuuj polling (fallback)
      if (data.hasMore) {
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) pollScrapeProcess(jId);
        }, POLL_INTERVAL_MS);
      }
    } catch {
      if (!mountedRef.current) return;
      setStatus('error');
      setError({
        message: 'Blad polaczenia z serwerem',
        suggestion: 'Sprawdz polaczenie internetowe i sprobuj ponownie.',
      });
    }
  }, []);

  // --- Start single scrape ---

  const startScrape = useCallback(async (groupId: string, groupName?: string): Promise<void> => {
    clearPollTimeout();
    setJobId(null);
    setProgress(prev => ({
      ...INITIAL_PROGRESS,
      currentGroup: groupName || null,
      groupsTotal: prev.groupsTotal,
      groupsCompleted: prev.groupsCompleted,
    }));
    setError(null);
    mountedRef.current = true;

    // --- Pre-scrape cookie health check ---
    if (!skipCookieCheckRef.current) {
      setStatus('cookie_check');
      setCookieCheckWarning(null);

      try {
        const checkRes = await fetch('/api/fb/scrape/check-cookies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
        });

        if (!mountedRef.current) return;

        if (!checkRes.ok) {
          // Config error (400) — propagate as normal error
          if (checkRes.status === 400) {
            const checkData = await checkRes.json().catch(() => ({ error: 'Blad konfiguracji' }));
            setStatus('error');
            setError({
              message: checkData.error || 'Blad konfiguracji scrapowania',
              suggestion: checkData.suggestion || 'Sprawdz konfiguracje Apify i cookies.',
            });
            return;
          }
          // Other HTTP errors — treat as cookie warning
          setCookieCheckWarning(SCRAPE_ERROR_MESSAGES['COOKIES_EXPIRED'].suggestion);
          cookieCheckGroupRef.current = { id: groupId, name: groupName };
          setStatus('idle');
          return;
        }

        const checkData = await checkRes.json();

        if (!mountedRef.current) return;

        if (!checkData.success || checkData.postsFound === 0) {
          setCookieCheckWarning(SCRAPE_ERROR_MESSAGES['COOKIES_EXPIRED'].suggestion);
          cookieCheckGroupRef.current = { id: groupId, name: groupName };
          setStatus('idle');
          return;
        }

        // Cookie check passed — continue to actual scrape
      } catch {
        if (!mountedRef.current) return;
        // Network error during check — show warning but allow proceeding
        setCookieCheckWarning('Nie udalo sie sprawdzic cookies. Mozesz kontynuowac na wlasne ryzyko.');
        cookieCheckGroupRef.current = { id: groupId, name: groupName };
        setStatus('idle');
        return;
      }
    }

    // Reset skip flag after use
    skipCookieCheckRef.current = false;

    setStatus('starting');

    try {
      const res = await fetch('/api/fb/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Blad HTTP ${res.status}` }));
        setStatus('error');
        setError({
          message: data.error || `Nie udalo sie rozpoczac scrapowania (HTTP ${res.status})`,
          suggestion: data.suggestion || 'Sprawdz konfiguracje i sprobuj ponownie.',
        });
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setJobId(data.jobId);
      setStatus('running');

      // Start polling
      await pollScrapeProcess(data.jobId);
    } catch {
      if (!mountedRef.current) return;
      setStatus('error');
      setError({
        message: 'Blad polaczenia z serwerem',
        suggestion: 'Sprawdz polaczenie internetowe i sprobuj ponownie.',
      });
    }
  }, [clearPollTimeout, pollScrapeProcess]);

  // --- Start bulk scrape ---

  const startBulkScrape = useCallback(async (groups: Array<{ id: string; name: string }>): Promise<void> => {
    clearPollTimeout();
    mountedRef.current = true;

    setProgress({
      ...INITIAL_PROGRESS,
      groupsTotal: groups.length,
    });
    setError(null);

    for (let i = 0; i < groups.length; i++) {
      if (!mountedRef.current) return;

      const group = groups[i];

      // Update progress for current group
      setProgress(prev => ({
        ...prev,
        currentGroup: group.name,
        groupsCompleted: i,
        postsFound: 0,
        postsNew: 0,
        postsUpdated: 0,
        apifyStatus: null,
        isWaitingBetweenGroups: false,
        waitSecondsRemaining: 0,
      }));

      // Scrape this group and wait for completion
      await new Promise<void>((resolve) => {
        // Temporarily override onComplete to resolve this promise
        const originalOnComplete = onCompleteRef.current;
        onCompleteRef.current = () => {
          originalOnComplete?.();
          resolve();
        };

        // Start scrape — uses startScrape but we need to handle the async flow
        // We can't use startScrape directly because it resets groupsTotal
        // Instead, inline the logic
        (async () => {
          clearPollTimeout();
          setJobId(null);
          setStatus('starting');
          setProgress(prev => ({
            ...prev,
            currentGroup: group.name,
            postsFound: 0,
            postsNew: 0,
            postsUpdated: 0,
            apifyStatus: null,
          }));
          setError(null);

          try {
            const res = await fetch('/api/fb/scrape', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ groupId: group.id }),
            });

            if (!mountedRef.current) { resolve(); return; }

            if (!res.ok) {
              const data = await res.json().catch(() => ({ error: `Blad HTTP ${res.status}` }));
              setStatus('error');
              setError({
                message: data.error || `Nie udalo sie rozpoczac scrapowania (HTTP ${res.status})`,
                suggestion: data.suggestion || 'Sprawdz konfiguracje i sprobuj ponownie.',
              });
              resolve();
              return;
            }

            const data = await res.json();

            if (!mountedRef.current) { resolve(); return; }

            setJobId(data.jobId);
            setStatus('running');

            await pollScrapeProcess(data.jobId);
          } catch {
            if (!mountedRef.current) { resolve(); return; }
            setStatus('error');
            setError({
              message: 'Blad polaczenia z serwerem',
              suggestion: 'Sprawdz polaczenie internetowe i sprobuj ponownie.',
            });
            resolve();
          }
        })();
      });

      // If there was an error, stop bulk
      // We check status via a ref-like approach — since setStatus is async,
      // we check if error is set. But since we're in the same async flow
      // and the Promise resolves on complete or error, we can check the current error state.
      // Actually, since error state is set before resolve(), we need a different approach.
      // Use a simple flag.

      // Wait between groups (rate limiting) — only if not last group
      if (i < groups.length - 1 && mountedRef.current) {
        const delayMs = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
        const delaySec = Math.ceil(delayMs / 1000);

        setProgress(prev => ({
          ...prev,
          groupsCompleted: i + 1,
          isWaitingBetweenGroups: true,
          waitSecondsRemaining: delaySec,
          estimatedWaitSeconds: delaySec,
        }));
        setStatus('idle');

        // Countdown timer
        await new Promise<void>((resolve) => {
          let remaining = delaySec;
          const countdown = () => {
            if (!mountedRef.current) { resolve(); return; }
            remaining--;
            if (remaining <= 0) {
              setProgress(prev => ({
                ...prev,
                isWaitingBetweenGroups: false,
                waitSecondsRemaining: 0,
              }));
              resolve();
              return;
            }
            setProgress(prev => ({
              ...prev,
              waitSecondsRemaining: remaining,
            }));
            timeoutRef.current = setTimeout(countdown, 1000);
          };
          timeoutRef.current = setTimeout(countdown, 1000);
        });
      }
    }

    // All groups done
    if (mountedRef.current) {
      setProgress(prev => ({
        ...prev,
        groupsCompleted: groups.length,
        isWaitingBetweenGroups: false,
        waitSecondsRemaining: 0,
      }));
      setStatus('completed');
    }
  }, [clearPollTimeout, pollScrapeProcess]);

  // --- Proceed after cookie warning ---

  const proceedAfterWarning = useCallback(() => {
    const group = cookieCheckGroupRef.current;
    if (!group) return;

    skipCookieCheckRef.current = true;
    setCookieCheckWarning(null);
    cookieCheckGroupRef.current = null;

    // Restart scrape with skip flag set
    startScrape(group.id, group.name);
  }, [startScrape]);

  // --- Reset ---

  const reset = useCallback(() => {
    clearPollTimeout();
    mountedRef.current = false;
    setJobId(null);
    setStatus('idle');
    setProgress(INITIAL_PROGRESS);
    setError(null);
    setCookieCheckWarning(null);
    skipCookieCheckRef.current = false;
    cookieCheckGroupRef.current = null;
  }, [clearPollTimeout]);

  return {
    startScrape,
    startBulkScrape,
    status,
    progress,
    error,
    jobId,
    reset,
    cookieCheckWarning,
    proceedAfterWarning,
  };
}
