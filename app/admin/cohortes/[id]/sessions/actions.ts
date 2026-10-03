"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { isClock } from "@/lib/cohort-sessions";
import { type SessionResult, moveCohortSession, reissueCohortSession, resendCohortSession, sendCohortSession, sendRemainingSessions } from "@/lib/cohort-sessions-send";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();
const clock = z.string().refine(isClock, "Heure invalide");
const pause = z.coerce.number().int().min(0).max(120);

const refresh = (cohortId: number) => revalidatePath(`/admin/cohortes/${cohortId}/sessions`);

export async function sendSessionAction(input: { cohortId: number; day: number; start: string; pause: number; guestEmail: string; reminder: boolean; excludeLeadIds: number[] }): Promise<SessionResult> {
  await requireAdmin();
  const parsed = z
    .object({ cohortId: id, day: id, start: clock, pause, guestEmail: z.union([z.literal(""), z.string().trim().email().max(200)]), reminder: z.boolean(), excludeLeadIds: z.array(id).max(200) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "Heure invalide" ? "Heure de début invalide." : "Vérifiez l'heure et l'adresse de l'invité." };
  const result = await sendCohortSession({ ...parsed.data, guestEmail: parsed.data.guestEmail || null });
  refresh(parsed.data.cohortId);
  return result;
}

export async function moveSessionAction(input: { cohortId: number; day: number; start: string; pause: number }): Promise<SessionResult> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id, day: id, start: clock, pause }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Heure de début invalide." };
  const result = await moveCohortSession(parsed.data);
  refresh(parsed.data.cohortId);
  return result;
}

export async function resendSessionAction(input: { cohortId: number; day: number }): Promise<SessionResult> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id, day: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const result = await resendCohortSession(parsed.data);
  refresh(parsed.data.cohortId);
  return result;
}

export async function sendRemainingAction(input: { cohortId: number }): Promise<SessionResult> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const result = await sendRemainingSessions(parsed.data.cohortId);
  refresh(parsed.data.cohortId);
  return result;
}

export async function reissueSessionAction(input: { cohortId: number; day: number; start: string; pause: number }): Promise<SessionResult> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id, day: id, start: clock, pause }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Heure de début invalide." };
  const result = await reissueCohortSession(parsed.data);
  refresh(parsed.data.cohortId);
  return result;
}
