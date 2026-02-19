import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { loadAIConfig } from '@/lib/ai/ai-provider';
import { THREAD_SUMMARY_SECTION_KEY } from '@/lib/ai/thread-summary-prompt';
import { synthesizeReportSection } from '@/lib/ai/report-synthesizer';
import type { PerThreadResult, SynthesisInput } from '@/lib/ai/report-synthesizer';

export const maxDuration = 60;

/**
 * GET /api/debug/test-synthesis?mode=full
 *
 * Diagnostic endpoint — tests the synthesis pipeline.
 * - mode=mini (default): 3 summaries, direct API call
 * - mode=full: ALL summaries, uses the ACTUAL synthesizeReportSection function
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'mini';
  const adminClient = getAdminClient();
  const debug: Record<string, unknown> = { mode, steps: [] };

  try {
    // Step 1: Load AI config
    const aiConfig = await loadAIConfig(adminClient);
    debug.aiConfig = {
      provider: aiConfig.provider,
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens,
    };
    (debug.steps as string[]).push('1. AI config loaded OK');

    // Step 2: Get latest completed analysis job
    const { data: job } = await adminClient
      .from('analysis_jobs')
      .select('id, status, total_threads, mailbox_id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Brak ukończonego jobu analizy', debug });
    }

    debug.job = { id: job.id, totalThreads: job.total_threads };
    (debug.steps as string[]).push('2. Latest job found OK');

    // Step 3: Load thread summaries
    const { data: results } = await adminClient
      .from('analysis_results')
      .select('section_key, result_data, thread_id')
      .eq('analysis_job_id', job.id)
      .eq('section_key', THREAD_SUMMARY_SECTION_KEY)
      .limit(500);

    const summariesWithContent: PerThreadResult[] = (results || [])
      .filter((r) => r.result_data?.content && typeof r.result_data.content === 'string' && r.result_data.content.length > 0)
      .map((r) => ({
        threadId: r.thread_id,
        threadSubject: r.result_data?.thread_subject || '',
        content: r.result_data.content,
      }));

    debug.summaries = {
      total: (results || []).length,
      withContent: summariesWithContent.length,
      totalCharsAllSummaries: summariesWithContent.reduce((sum, s) => sum + s.content.length, 0),
      avgCharsPerSummary: summariesWithContent.length > 0
        ? Math.round(summariesWithContent.reduce((sum, s) => sum + s.content.length, 0) / summariesWithContent.length)
        : 0,
    };
    (debug.steps as string[]).push(`3. Got ${summariesWithContent.length} summaries (${(debug.summaries as Record<string, number>).totalCharsAllSummaries} chars total)`);

    if (summariesWithContent.length === 0) {
      return NextResponse.json({ error: 'Brak podsumowań z contentem', debug });
    }

    if (mode === 'full') {
      // ===== FULL MODE: Use the actual synthesizeReportSection function =====
      const sectionKey = 'response_speed';
      const sectionTitle = 'Szybkość reakcji i obsługi zgłoszeń';

      const detailLevel = (request.nextUrl.searchParams.get('detailLevel') === 'standard' ? 'standard' : 'synthetic') as 'synthetic' | 'standard';

      const input: SynthesisInput = {
        sectionKey,
        sectionTitle,
        perThreadResults: summariesWithContent,
        templateType: 'internal',
        mailboxName: 'Test Mailbox',
        globalContext: undefined,
        includeThreadSummaries: false,
        detailLevel,
      };

      debug.synthesisInput = {
        sectionKey,
        perThreadResultsCount: summariesWithContent.length,
        totalInputChars: summariesWithContent.reduce((sum, s) => sum + s.content.length, 0),
      };
      (debug.steps as string[]).push(`4. Calling synthesizeReportSection with ${summariesWithContent.length} summaries...`);

      const startTime = Date.now();
      try {
        const output = await synthesizeReportSection(aiConfig, input);
        const elapsed = Date.now() - startTime;

        debug.synthesisOutput = {
          sectionKey: output.sectionKey,
          markdownLength: output.markdown?.length ?? 0,
          markdownEmpty: !output.markdown,
          markdownFalsy: !output.markdown ? true : false,
          markdownPreview: output.markdown ? output.markdown.slice(0, 500) : '(empty)',
          tokensUsed: output.tokensUsed,
          processingTimeMs: output.processingTimeMs,
          elapsedMs: elapsed,
        };
        (debug.steps as string[]).push(`5. synthesizeReportSection completed in ${elapsed}ms, markdown: ${output.markdown?.length ?? 0} chars`);

        // Also test the fallback logic from reports/process
        const contentMarkdown = output.markdown || '*Brak danych dla tej sekcji.*';
        debug.finalResult = {
          contentMarkdown: contentMarkdown.slice(0, 500),
          usedFallback: !output.markdown,
        };

        return NextResponse.json({ success: !!output.markdown, debug });
      } catch (synthError) {
        const elapsed = Date.now() - startTime;
        debug.synthesisError = {
          name: synthError instanceof Error ? synthError.name : 'unknown',
          message: synthError instanceof Error ? synthError.message : String(synthError),
          stack: synthError instanceof Error ? synthError.stack?.slice(0, 500) : undefined,
          elapsedMs: elapsed,
        };
        (debug.steps as string[]).push(`5. synthesizeReportSection THREW after ${elapsed}ms`);
        return NextResponse.json({ error: 'Synthesis threw', debug });
      }
    } else {
      // ===== MINI MODE: Direct API call with 3 summaries =====
      const miniSummaries = summariesWithContent.slice(0, 3);
      const resultsBlock = miniSummaries
        .map((r, i) => `[${i + 1}] ${r.threadSubject || '(brak tematu)'}: ${r.content}`)
        .join('\n---\n');

      const systemPrompt = `Jesteś ekspertem ds. zarządzania nieruchomościami. Tworzysz ZWIĘZŁY raport kierowniczy. Pisz po polsku.`;

      const userPrompt = `Napisz ZWIĘZŁE podsumowanie sekcji "Szybkość reakcji" na podstawie ${miniSummaries.length} analiz wątków email.

FOKUS SEKCJI: Skup się na wymiarze "2. SZYBKOŚĆ REAKCJI" — czasy odpowiedzi, potwierdzenia odbioru, benchmarki.

DANE ŹRÓDŁOWE:
${resultsBlock.slice(0, 15000)}

INSTRUKCJA: Napisz MAX 8-12 zdań. Podaj ogólną ocenę i główne wzorce.`;

      debug.prompt = {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        totalChars: systemPrompt.length + userPrompt.length,
      };
      (debug.steps as string[]).push('4. Prompt built OK (mini mode)');

      const SYNTHESIS_MAX_TOKENS = 600;
      const maxTokens = Math.min(aiConfig.maxTokens, SYNTHESIS_MAX_TOKENS);

      const baseUrl = aiConfig.provider === 'azure'
        ? process.env.AZURE_OPENAI_ENDPOINT
        : 'https://api.openai.com/v1';

      debug.apiRequest = {
        url: `${baseUrl}/chat/completions`,
        model: aiConfig.model,
        max_completion_tokens: maxTokens,
      };
      (debug.steps as string[]).push('5. Calling OpenAI API (mini)...');

      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 50_000);

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: aiConfig.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: aiConfig.temperature,
            max_completion_tokens: maxTokens,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        debug.fetchError = err instanceof Error ? { name: err.name, message: err.message } : String(err);
        return NextResponse.json({ error: 'Fetch failed', debug });
      } finally {
        clearTimeout(timeout);
      }

      const elapsed = Date.now() - startTime;
      const data = await res.json();

      debug.apiResponse = { status: res.status, elapsedMs: elapsed };
      debug.rawResponse = {
        id: data.id,
        model: data.model,
        choicesCount: data.choices?.length ?? 0,
        usage: data.usage,
      };

      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        debug.choice0 = {
          finishReason: choice.finish_reason,
          contentLength: choice.message?.content?.length ?? 0,
          contentPreview: choice.message?.content?.slice(0, 500) || '(empty)',
          refusal: choice.message?.refusal,
        };
      }

      const content = data.choices?.[0]?.message?.content || '';
      debug.finalContent = { length: content.length, isEmpty: !content };
      (debug.steps as string[]).push(`6. API responded in ${elapsed}ms, content: ${content.length} chars`);

      return NextResponse.json({ success: content.length > 0, debug });
    }
  } catch (err) {
    debug.topLevelError = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.slice(0, 500) } : String(err);
    return NextResponse.json({ error: 'Top level error', debug });
  }
}
