-- Phase 2.2 Plan 01: Thread Intelligence
-- Dodaje kolumnę summary do email_threads oraz rozszerza komentarze statusu

-- 1. Kolumna summary — AI-generated 1-2 zdaniowe podsumowanie wątku
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. Komentarze dokumentujące rozszerzony zestaw statusów
COMMENT ON COLUMN email_threads.status IS 'Thread status: open, closed_positive, closed_negative, pending';
COMMENT ON COLUMN email_threads.summary IS 'AI-generated 1-2 sentence summary of the thread conversation';
