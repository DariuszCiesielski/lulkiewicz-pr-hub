/**
 * AI Provider abstraction — currently supports OpenAI.
 * Reads config from ai_config table, decrypts API key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto/encrypt';

export interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  processingTimeMs: number;
}

/** Load active AI config from database */
export async function loadAIConfig(supabase: SupabaseClient): Promise<AIConfig> {
  const { data, error } = await supabase
    .from('ai_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error('Brak aktywnej konfiguracji AI. Ustaw klucz API w Ustawieniach AI.');
  }

  let apiKey = data.api_key_encrypted || '';
  if (apiKey && !apiKey.startsWith('sk-')) {
    try {
      apiKey = decrypt(apiKey);
    } catch (err) {
      throw new Error(`Błąd deszyfrowania klucza API: ${err instanceof Error ? err.message : 'Nieznany błąd'}`);
    }
  }

  if (!apiKey) {
    throw new Error('Brak klucza API. Ustaw klucz w Ustawieniach AI.');
  }

  return {
    provider: data.provider,
    apiKey,
    model: data.model,
    temperature: data.temperature ?? 0.3,
    maxTokens: data.max_tokens ?? 16384,
  };
}

/** Call OpenAI-compatible API */
export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const startTime = Date.now();

  const baseUrl = config.provider === 'azure'
    ? process.env.AZURE_OPENAI_ENDPOINT
    : 'https://api.openai.com/v1';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      `Błąd API AI (${res.status}): ${errData.error?.message || 'Nieznany błąd'}`
    );
  }

  const data = await res.json();
  const processingTimeMs = Date.now() - startTime;

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
    processingTimeMs,
  };
}
