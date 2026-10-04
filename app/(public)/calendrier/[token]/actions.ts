"use server";

import { z } from "zod";

import { type ActionResult, proposePersonalSchedule } from "@/lib/personal-schedule-send";

const schema = z.object({
  token: z.string().min(20).max(64),
  days: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.number().int().min(0).max(1440), extend: z.boolean() })).min(1).max(31),
});

/** The participant sends their calendar; the token is the credential (no account in V1). */
export async function proposeAction(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Proposition invalide : rechargez la page." };
  return proposePersonalSchedule(parsed.data.token, parsed.data.days);
}
