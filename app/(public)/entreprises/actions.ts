"use server";

import { type SubmitResult, submitQuote } from "@/lib/quotes";
import { recordServerEvent } from "@/lib/tracking/server";

/** The company quote form (Ben, 21/10). Validation lives in lib/quotes.ts. */
export async function submitQuoteAction(raw: unknown): Promise<SubmitResult> {
  const result = await submitQuote(raw);
  if (result.ok) await recordServerEvent({ name: "quote_requested" }).catch(() => undefined);
  return result;
}
