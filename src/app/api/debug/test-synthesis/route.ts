import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/api/admin';
import { loadAIConfig } from '@/lib/ai/ai-provider';
import { THREAD_SUMMARY_SECTION_KEY } from '@/lib/ai/thread-summary-prompt';
import { decrypt } from '@/lib/crypto/encrypt';

/**
 * GET /api/debug/test-synthesis
 *
 * Diagnostic endpoint — tests the full synthesis pipeline for ONE section
 * and returns detailed debug info including the raw API response.
 */
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const adminClient = getAdminClient();
  const debug: Record<string, unknown> = { steps: [] };

  try {
    // Step 1: Load AI config
    const aiConfig = await loadAIConfig(adminClient);
    debug.aiConfig = {
      provider: aiConfig.provider,
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens,
      hasApiKey: !!aiConfig.apiKey,
      apiKeyPrefix: aiConfig.apiKey?.slice(0, 8) + '...',
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

    debug.job = { id: job.id, status: job.status, totalThreads: job.total_threads };
    (debug.steps as string[]).push('2. Latest job found OK');

    // Step 3: Load thread summaries
    const { data: results } = await adminClient
      .from('analysis_results')
      .select('section_key, result_data, thread_id')
      .eq('analysis_job_id', job.id)
      .eq('section_key', THREAD_SUMMARY_SECTION_KEY)
      .limit(100);

    const summariesWithContent = (results || [])
      .filter((r) => r.result_data?.content && typeof r.result_data.content === 'string' && r.result_data.content.length > 0)
      .map((r) => ({
        threadId: r.thread_id,
        threadSubject: r.result_data?.thread_subject || '',
        content: r.result_data.content,
      }));

    debug.summaries = {
      totalResults: (results || []).length,
      withContent: summariesWithContent.length,
      firstSummaryLength: summariesWithContent[0]?.content?.length || 0,
      firstSummaryPreview: summariesWithContent[0]?.content?.slice(0, 300) || '(none)',
    };
    (debug.steps as string[]).push(`3. Got ${summariesWithContent.length} summaries with content`);

    if (summariesWithContent.length === 0) {
      return NextResponse.json({ error: 'Brak podsumowań z contentem', debug });
    }

    // Step 4: Build a mini prompt (use only first 3 summaries to be fast)
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
    (debug.steps as string[]).push('4. Prompt built OK');

    // Step 5: Call OpenAI API directly (to get raw response)
    const SYNTHESIS_MAX_TOKENS = 600;
    const maxTokens = Math.min(aiConfig.maxTokens, SYNTHESIS_MAX_TOKENS);

    const baseUrl = aiConfig.provider === 'azure'
      ? process.env.AZURE_OPENAI_ENDPOINT
      : 'https://api.openai.com/v1';

    const requestBody = {
      model: aiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: aiConfig.temperature,
      max_completion_tokens: maxTokens,
    };

    debug.apiRequest = {
      url: `${baseUrl}/chat/completions`,
      model: requestBody.model,
      temperature: requestBody.temperature,
      max_completion_tokens: requestBody.max_completion_tokens,
      messageCount: requestBody.messages.length,
    };
    (debug.steps as string[]).push('5. Calling OpenAI API...');

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
        body: JSON.stringify(requestBody),
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

    debug.apiResponse = {
      status: res.status,
      statusText: res.statusText,
      headers: {
        contentType: res.headers.get('content-type'),
        xRequestId: res.headers.get('x-request-id'),
      },
      elapsedMs: elapsed,
    };

    if (!res.ok) {
      const errBody = await res.text();
      debug.apiErrorBody = errBody.slice(0, 2000);
      return NextResponse.json({ error: `API returned ${res.status}`, debug });
    }

    const data = await res.json();

    // Step 6: Analyze the raw response
    debug.rawResponse = {
      id: data.id,
      object: data.object,
      model: data.model,
      choicesCount: data.choices?.length ?? 0,
      usage: data.usage,
      systemFingerprint: data.system_fingerprint,
    };

    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      debug.choice0 = {
        finishReason: choice.finish_reason,
        messageRole: choice.message?.role,
        messageContentType: typeof choice.message?.content,
        messageContentLength: choice.message?.content?.length ?? 0,
        messageContentPreview: choice.message?.content
          ? choice.message.content.slice(0, 500)
          : '(null or empty)',
        messageRefusal: choice.message?.refusal,
        hasContent: !!choice.message?.content,
      };
    } else {
      debug.choice0 = 'NO CHOICES IN RESPONSE';
    }

    const content = data.choices?.[0]?.message?.content || '';
    debug.finalContent = {
      length: content.length,
      isEmpty: content === '',
      isFalsy: !content,
      preview: content.slice(0, 500) || '(empty)',
    };

    (debug.steps as string[]).push(`6. API responded in ${elapsed}ms, content length: ${content.length}`);

    return NextResponse.json({ success: content.length > 0, debug });
  } catch (err) {
    debug.topLevelError = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.slice(0, 500) } : String(err);
    return NextResponse.json({ error: 'Top level error', debug });
  }
}
