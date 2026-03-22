'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare2,
  Lightbulb,
  Mail,
  MessageSquare,
  Rocket,
  Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALL_PROPOSAL_IDS,
  CURRENT_MODULES,
  FEEDBACK_PROPOSAL_SECTIONS,
  FUTURE_TOOL_LABELS,
  createEmptyFeedbackPayload,
  getMissingProposalTitles,
  normalizeClientFeedbackPayload,
} from '@/lib/feedback/catalog';
import type {
  ClientFeedbackPayload,
  FeedbackChoice,
  FeedbackLoadResponse,
  FeedbackSaveResponse,
} from '@/types/feedback';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeedbackPage() {
  const router = useRouter();
  const { user, hasAccess, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<ClientFeedbackPayload>(createEmptyFeedbackPayload());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (!hasAccess) {
      router.push('/dashboard');
      return;
    }

    let isActive = true;

    async function loadFeedback() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/feedback');
        const data = (await response.json().catch(() => null)) as FeedbackLoadResponse | { error?: string } | null;

        if (!response.ok) {
          throw new Error(
            data && 'error' in data && data.error
              ? data.error
              : 'Nie udało się pobrać ostatniej wersji ankiety'
          );
        }

        if (!isActive) {
          return;
        }

        const payload = normalizeClientFeedbackPayload((data as FeedbackLoadResponse).feedback);
        setForm(payload);
        setLastSavedAt((data as FeedbackLoadResponse).createdAt);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setForm(createEmptyFeedbackPayload());
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Nie udało się pobrać ostatniej wersji ankiety'
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadFeedback();

    return () => {
      isActive = false;
    };
  }, [authLoading, hasAccess, router, user]);

  const answeredCount = ALL_PROPOSAL_IDS.filter(
    (proposalId) => form.proposals[proposalId]?.choice
  ).length;

  const handleChoiceChange = (proposalId: string, choice: FeedbackChoice) => {
    setForm((current) => ({
      ...current,
      proposals: {
        ...current.proposals,
        [proposalId]: {
          ...current.proposals[proposalId],
          choice,
        },
      },
    }));
    setSubmitError(null);
    setSubmitMessage(null);
  };

  const handleCommentChange = (proposalId: string, comment: string) => {
    setForm((current) => ({
      ...current,
      proposals: {
        ...current.proposals,
        [proposalId]: {
          ...current.proposals[proposalId],
          comment,
        },
      },
    }));
    setSubmitMessage(null);
  };

  const handleFutureCommentChange = (comment: string) => {
    setForm((current) => ({
      ...current,
      futureToolsComment: comment,
    }));
    setSubmitMessage(null);
  };

  const handleSubmit = async () => {
    const missingProposalTitles = getMissingProposalTitles(form);

    if (missingProposalTitles.length > 0) {
      setSubmitError('Uzupełnij decyzję przy każdej propozycji rozwoju.');
      setSubmitMessage(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: form }),
      });

      const data = (await response.json().catch(() => null)) as
        | FeedbackSaveResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && 'error' in data && data.error ? data.error : 'Nie udało się zapisać opinii'
        );
      }

      const result = data as FeedbackSaveResponse;
      setLastSavedAt(result.createdAt);
      setSubmitMessage(
        result.emailSent
          ? 'Dziękujemy. Zapisaliśmy nową wersję opinii i wysłaliśmy powiadomienie.'
          : 'Dziękujemy. Zapisaliśmy nową wersję opinii.'
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Nie udało się zapisać opinii'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div
        className="rounded-2xl border p-6"
        style={{
          borderColor: 'var(--border-primary)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 55%)',
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm"
              style={{
                border: '1px solid var(--border-primary)',
                color: 'var(--accent-primary)',
              }}
            >
              <Lightbulb className="h-4 w-4" />
              Propozycje rozwoju
            </div>
            <div>
              <h1
                className="text-3xl font-bold"
                style={{ color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Krótka ankieta rozwojowa
              </h1>
              <p className="mt-2 max-w-3xl text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
                Zbieramy decyzje dotyczące dalszego rozwoju obecnych modułów i kierunków kolejnych
                narzędzi. Każde kliknięcie „Wyślij” zapisuje nową wersję odpowiedzi.
              </p>
            </div>
          </div>

          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <p style={{ color: 'var(--text-secondary)' }}>Uzupełnione decyzje</p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {answeredCount}/{ALL_PROPOSAL_IDS.length}
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              {lastSavedAt
                ? `Ostatnia wersja: ${formatDateTime(lastSavedAt)}`
                : 'Brak zapisanej wersji'}
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div
          className="rounded-md border p-3 text-sm"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          {loadError}
        </div>
      )}

      {submitError && (
        <div
          className="rounded-md border p-3 text-sm"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            color: '#dc2626',
          }}
        >
          {submitError}
        </div>
      )}

      {submitMessage && (
        <div
          className="rounded-md border p-3 text-sm"
          style={{
            borderColor: 'rgba(34, 197, 94, 0.3)',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            color: '#15803d',
          }}
        >
          {submitMessage}
        </div>
      )}

      <section
        className="rounded-2xl border p-6"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <CheckSquare2 className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Co już działa
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Obecny zakres platformy, od którego wychodzimy przy kolejnych decyzjach.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {CURRENT_MODULES.map((module) => {
            const Icon = module.id === 'email-analyzer' ? Mail : MessageSquare;

            return (
              <div
                key={module.id}
                className="rounded-xl border p-5"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {module.title}
                  </h3>
                </div>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {module.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border p-6"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <Rocket className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Propozycje rozwoju
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Przy każdej pozycji zaznacz kierunek decyzji i dodaj komentarz, jeśli chcesz doprecyzować priorytet.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {FEEDBACK_PROPOSAL_SECTIONS.map((section) => (
            <div
              key={section.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
              }}
            >
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {section.title}
              </h3>

              <div className="mt-4 space-y-4">
                {section.items.map((item) => {
                  const proposalState = form.proposals[item.id];
                  const isInterested = proposalState?.choice === 'interested';
                  const isNotInterested = proposalState?.choice === 'not_interested';

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="mb-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs"
                            style={{
                              backgroundColor:
                                'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                              color: 'var(--accent-primary)',
                            }}
                          >
                            {item.id}
                          </div>
                          <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {item.title}
                          </h4>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label
                            className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                            style={{
                              borderColor: isInterested ? 'var(--accent-primary)' : 'var(--border-primary)',
                              backgroundColor: isInterested
                                ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                                : 'transparent',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isInterested}
                              onChange={() => handleChoiceChange(item.id, 'interested')}
                              className="h-4 w-4"
                              style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            Zainteresowany
                          </label>

                          <label
                            className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                            style={{
                              borderColor: isNotInterested ? 'var(--accent-primary)' : 'var(--border-primary)',
                              backgroundColor: isNotInterested
                                ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                                : 'transparent',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isNotInterested}
                              onChange={() => handleChoiceChange(item.id, 'not_interested')}
                              className="h-4 w-4"
                              style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            Niezainteresowany
                          </label>
                        </div>
                      </div>

                      <div className="mt-4">
                        <textarea
                          value={proposalState?.comment || ''}
                          onChange={(event) => handleCommentChange(item.id, event.target.value)}
                          rows={3}
                          placeholder="Komentarz do tej propozycji (opcjonalnie)"
                          className="w-full rounded-lg border px-3 py-2 text-sm resize-y"
                          style={{
                            borderColor: 'var(--border-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border p-6"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <MessageSquare className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Przyszłe narzędzia
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Tu zbieramy ogólny komentarz do kolejnych modułów, bez podejmowania decyzji per funkcja.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FUTURE_TOOL_LABELS.map((toolLabel) => (
            <span
              key={toolLabel}
              className="rounded-full border px-3 py-1 text-sm"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              {toolLabel}
            </span>
          ))}
        </div>

        <textarea
          value={form.futureToolsComment}
          onChange={(event) => handleFutureCommentChange(event.target.value)}
          rows={5}
          placeholder="Komentarz ogólny do przyszłych narzędzi"
          className="w-full rounded-lg border px-3 py-2 text-sm resize-y"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        />
      </section>

      <div
        className="rounded-2xl border p-5"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Gotowe do wysłania
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Po wysłaniu zapiszemy nową wersję odpowiedzi i wyślemy powiadomienie do zespołu.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Zapisywanie...' : 'Wyślij'}
          </button>
        </div>
      </div>
    </div>
  );
}
