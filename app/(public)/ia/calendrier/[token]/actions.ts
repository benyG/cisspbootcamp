"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type PlanResult, pickJournees } from "@/lib/ia-plan-server";

const schema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/),
  picks: z.record(z.string().regex(/^[2-5]$/), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function pickJourneesAction(input: unknown): Promise<PlanResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choix invalide." };
  let result: PlanResult;
  try {
    result = await pickJournees(parsed.data.token, Object.fromEntries(Object.entries(parsed.data.picks).map(([k, v]) => [Number(k), v])));
  } catch (error) {
    console.error("[ia] calendrier", error);
    return { ok: false, error: "La réservation n’a pas pu être enregistrée. Réessayez dans un instant." };
  }
  if (result.ok) revalidatePath(`/ia/calendrier/${parsed.data.token}`);
  return result;
}
