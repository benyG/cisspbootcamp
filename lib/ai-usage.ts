/**
 * What each Claude call costs (lot A, Ben 15/11: a 30 USD monthly AI
 * budget). Pure: prices per million tokens from the official price list,
 * and the cost of one response from its `usage`. An unknown model is priced
 * as the dearest one listed, so the budget errs on the safe side.
 */

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** USD per million tokens (cache writes: 5-minute cache, 1.25 × input). */
export const AI_PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};
const DEAREST: Price = AI_PRICES["claude-opus-5"]!;

/** One web search through the server tool. */
export const WEB_SEARCH_USD = 0.01;

/** The fields of `response.usage` we price (the SDK names, all optional here). */
export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function priceOf(model: string | undefined): Price {
  if (!model) return DEAREST;
  const key = Object.keys(AI_PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  return key ? AI_PRICES[key]! : DEAREST;
}

/** Cost in USD of one response. */
export function costUsd(model: string | undefined, usage: UsageLike | undefined | null): number {
  const p = priceOf(model);
  if (!usage) return 0;
  const tokens =
    (usage.input_tokens ?? 0) * p.input +
    (usage.output_tokens ?? 0) * p.output +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite;
  return tokens / 1_000_000 + (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
}

/** "2026-11": the budget month, in UTC. */
export function budgetMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** First instant of the budget month. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The alert levels crossed by going from `before` to `after` spent, out of `budget`. */
export function crossedLevels(before: number, after: number, budget: number): Array<80 | 100> {
  if (budget <= 0) return [];
  return ([80, 100] as const).filter((level) => before < (budget * level) / 100 && after >= (budget * level) / 100);
}

/** What is the AI used for: a word per call site, for the guardrails page. */
export const AI_FEATURES = {
  studio: "Studio de contenu",
  followup: "Messages de relance",
  ideas: "Idées de sujets",
  news: "Veille d’actualités",
  analyst: "Analyste de la semaine",
  scanner: "Message après une analyse CISSP",
  assistant: "Assistant du site",
  watch: "Veille concurrents",
  invoice: "Lecture de factures",
} as const;
export type AiFeature = keyof typeof AI_FEATURES;
