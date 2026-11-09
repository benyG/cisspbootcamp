import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Campaign } from "@/lib/campaign";
import { MANUAL_COHORT_STATUSES, automaticCohortStatus, cohortHasStarted } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { PROGRAM_CODES } from "@/lib/programs";
import { cisspEndsAt } from "@/lib/reading-plan/page";

import type { OpResult } from "./leads";

/** Cohorts, for the admin forms and the MCP plug. */

const empty = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

export const cohortSchema = z
  .object({
    program: z.enum(PROGRAM_CODES).default("cissp"),
    name: z.string().trim().min(1, "Nom requis").max(120),
    startsAt: z.coerce.date(),
    // CISSP: computed from the reading plan's calendar, whatever was typed.
    endsAt: z.preprocess(empty, z.coerce.date().optional()),
    capacity: z.coerce.number().int().min(1).max(100),
    // Pilotage goal (lot 2): empty = the capacity.
    targetSeats: z.preprocess((v) => empty(v) ?? null, z.coerce.number().int().min(1, "Objectif : au moins 1 place").max(100).nullable()),
    // Ben picks planned or open; full, running and done are set automatically.
    status: z.enum(MANUAL_COHORT_STATUSES),
  })
  .transform((c) => ({ ...c, endsAt: c.program === "cissp" ? cisspEndsAt(c.startsAt) : c.endsAt }))
  .refine((c): c is typeof c & { endsAt: Date } => !!c.endsAt, { message: "Date de fin requise", path: ["endsAt"] })
  .refine((c) => c.endsAt! > c.startsAt, { message: "La fin doit suivre le début", path: ["endsAt"] });

export async function createCohort(input: unknown, campaign: Campaign | null = null, now = new Date()): Promise<OpResult & { id?: number }> {
  const parsed = cohortSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const data = { ...parsed.data, campaign: (campaign ?? Prisma.JsonNull) as never, status: automaticCohortStatus({ ...parsed.data, paid: 0 }, now) as never };
  const cohort = await prisma.cohort.create({ data });
  revalidateTag(COHORTS_CACHE_TAG);
  return { ok: true, id: cohort.id, message: `Cohorte créée (n°${cohort.id}).` };
}

/**
 * Started (Ben, 03/10): only the name can change; the reading plan, the Meet
 * sessions and the e-mails already sent depend on the rest. Moving the start
 * of a cohort whose invitations went out leaves them to replace.
 */
export async function updateCohort(id: number, input: Record<string, unknown>, now = new Date()): Promise<OpResult & { moved?: number }> {
  const existing = await prisma.cohort.findUnique({
    where: { id },
    select: { startsAt: true, status: true, _count: { select: { registrations: { where: { status: "paid" } }, sessions: { where: { sentAt: { not: null } } } } } },
  });
  if (!existing) return { ok: false, error: `Aucune cohorte n°${id}.` };
  let moved = 0;
  if (cohortHasStarted(existing, now)) {
    const name = z.string().trim().min(1, "Nom requis").max(120).safeParse(input.name);
    if (!name.success) return { ok: false, error: "Cohorte commencée : seul le nom peut changer." };
    await prisma.cohort.update({ where: { id }, data: { name: name.data } });
  } else {
    const parsed = cohortSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
    const data = parsed.data;
    if (data.startsAt.getTime() !== existing.startsAt.getTime() && existing._count.sessions > 0) moved = existing._count.sessions;
    const status = automaticCohortStatus({ ...data, paid: existing._count.registrations }, now);
    await prisma.cohort.update({ where: { id }, data: { ...data, status: status as never } });
  }
  revalidateTag(COHORTS_CACHE_TAG);
  return { ok: true, moved, message: `Cohorte mise à jour.${moved ? ` ${moved} invitation${moved > 1 ? "s" : ""} de séance déjà envoyée${moved > 1 ? "s" : ""} à remplacer (page Sessions).` : ""}` };
}

/** A campaign action is done (lot 5): it leaves the queue and shows "Fait". */
export async function markCampaignDone(cohortId: number, key: string): Promise<OpResult> {
  if (!/^[a-z0-9-]{1,40}$/.test(key)) return { ok: false, error: "Étape invalide." };
  await prisma.actionLog.create({ data: { type: "campaign_done", leadId: null, payload: { cohortId, key } } });
  return { ok: true, message: "Étape de campagne cochée." };
}
