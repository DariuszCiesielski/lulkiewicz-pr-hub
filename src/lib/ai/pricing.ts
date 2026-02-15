/**
 * AI Model Pricing — latest models from main providers (Feb 2026).
 * Prices in USD per 1 million tokens.
 * Azure OpenAI token pricing = OpenAI (same rates).
 */

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI (GPT-5 family, Feb 2026)
  'gpt-5.2':      { inputPerMillion: 1.75,  outputPerMillion: 14.00 },
  'gpt-5.1':      { inputPerMillion: 1.25,  outputPerMillion: 10.00 },
  'gpt-5-mini':   { inputPerMillion: 0.25,  outputPerMillion: 2.00 },
  'gpt-5-nano':   { inputPerMillion: 0.05,  outputPerMillion: 0.40 },
  // Anthropic (Claude 4.5/4.6, Feb 2026)
  'claude-opus-4-6':   { inputPerMillion: 5.00,  outputPerMillion: 25.00 },
  'claude-sonnet-4-5': { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
  'claude-haiku-4-5':  { inputPerMillion: 1.00,  outputPerMillion: 5.00 },
  // Google (Gemini 2.5/3, Feb 2026)
  'gemini-2.5-pro':   { inputPerMillion: 1.25,  outputPerMillion: 10.00 },
  'gemini-2.5-flash': { inputPerMillion: 0.15,  outputPerMillion: 0.60 },
  'gemini-3-flash':   { inputPerMillion: 0.50,  outputPerMillion: 3.00 },
};

/** Lookup pricing for a model (handles date-suffixed IDs like claude-sonnet-4-5-20250929). */
export function getModelPricing(model: string): ModelPricing | null {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  const base = model.replace(/-\d{8}$/, '');
  if (MODEL_PRICING[base]) return MODEL_PRICING[base];
  return null;
}

/** Exact cost from separate prompt/completion token counts. */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getModelPricing(model);
  if (!pricing) return 0;
  return (
    (promptTokens * pricing.inputPerMillion +
      completionTokens * pricing.outputPerMillion) /
    1_000_000
  );
}

/** Legacy fallback: blended rate (70% input / 30% output) for old data without split tokens. */
export function calculateCostBlended(
  model: string,
  totalTokens: number,
): number {
  const pricing = getModelPricing(model);
  if (!pricing) return 0;
  const blendedRate =
    (0.7 * pricing.inputPerMillion + 0.3 * pricing.outputPerMillion) /
    1_000_000;
  return totalTokens * blendedRate;
}
