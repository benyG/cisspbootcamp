"use server";

import { z } from "zod";

import { type Result, requestReopen } from "@/lib/replays-server";

/** An expired participant asks Ben to reopen their replays (the token is the credential). */
export async function requestReopenAction(input: { token: string; note: string }): Promise<Result> {
  const parsed = z.object({ token: z.string().min(20).max(64), note: z.string().trim().min(5, "Dites en une phrase pourquoi vous voulez revoir les sessions.").max(1000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  return requestReopen(parsed.data.token, parsed.data.note);
}
