import { revalidateTag } from "next/cache";

import { automaticCohortStatus, remainingSeats } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { type IaDay, isJournee, isWeekendDate, journeeSlot, longDate, rotateJournees, weekendDates } from "@/lib/ia-days";
import { loadOpenCohorts } from "@/lib/registration";
import { cohortDays } from "@/lib/replays-server";

/**
 * Bâtisseur IA weekend dates (lib/ia-days.ts): Ben opens them from the
 * admin; each J1 date opens the IA cohort participants register and pay in.
 */

export type IaResult = { ok: true; message: string } | { ok: false; error: string };

/** A J1 cohort runs until its participants can have taken J5: eight weeks. */
const COHORT_WEEKS = 8;
/** At most this many dates opened in one go. */
const MAX_OPEN = 40;

/** "Entrée du samedi 23 janvier 2027": the e-mails prefix it with the programme name. */
export const iaCohortName = (date: string) => `Entrée du ${longDate(date)}`;

function cohortData(date: string, start: string, capacity: number, now: Date) {
  const { startsAt } = journeeSlot(date, start);
  const endsAt = new Date(startsAt.getTime() + COHORT_WEEKS * 7 * 86_400_000);
  return { program: "ia" as const, name: iaCohortName(date), startsAt, endsAt, capacity, status: automaticCohortStatus({ status: "open", startsAt, endsAt, capacity, paid: 0 }, now) as never };
}

/** Every IA date with its seats taken, oldest first. */
export type AdminIaDay = IaDay & { cohortId: number | null; cohortName: string | null; paid: number; meetUrl: string | null; people: Array<{ leadId: number; name: string; invited: boolean; planToken: string | null }> };

export async function loadIaDays(): Promise<AdminIaDay[]> {
  const days = await prisma.iaDay.findMany({
    orderBy: { date: "asc" },
    include: {
      seats: { orderBy: { createdAt: "asc" }, include: { lead: { select: { id: true, firstName: true, lastName: true, iaPlans: { select: { cohortId: true, token: true } } } } } },
      cohort: { select: { name: true, _count: { select: { registrations: { where: { status: "paid" } } } } } },
    },
  });
  return days.map((d) => ({
    id: d.id, date: d.date, journee: d.journee, capacity: d.capacity, seats: d.seats.length, closed: d.closed, start: d.start, meetUrl: d.meetUrl,
    cohortId: d.cohortId, cohortName: d.cohort?.name ?? null, paid: d.cohort?._count.registrations ?? 0,
    people: d.seats.map((s) => ({ leadId: s.lead.id, name: `${s.lead.firstName} ${s.lead.lastName}`.trim(), invited: !!s.invitedAt, planToken: s.lead.iaPlans.find((p) => p.cohortId === s.cohortId)?.token ?? null })),
  }));
}

/** Weekend dates taught in a CISSP cohort, to warn Ben before he opens one. */
export async function cisspWeekendDates(now = new Date()): Promise<Set<string>> {
  const cohorts = await prisma.cohort.findMany({ where: { program: "cissp", status: { not: "done" }, endsAt: { gte: new Date(now.getTime() - 86_400_000) } }, select: { startsAt: true } });
  return new Set(cohorts.flatMap((c) => cohortDays(c.startsAt).map((d) => d.date)).filter(isWeekendDate));
}

export async function openIaDates(input: { from: string; to: string; which: "both" | "saturday" | "sunday"; start: string; capacity: number }, now = new Date()): Promise<IaResult> {
  const today = now.toISOString().slice(0, 10);
  const dates = weekendDates(input.from, input.to).filter((d) => d > today).filter((d) => {
    const saturday = new Date(`${d}T12:00:00Z`).getUTCDay() === 6;
    return input.which === "both" || (input.which === "saturday") === saturday;
  });
  if (!dates.length) return { ok: false, error: "Aucun samedi ni dimanche à venir dans cette période." };
  if (dates.length > MAX_OPEN) return { ok: false, error: `Ouvrez au plus ${MAX_OPEN} dates à la fois.` };
  const existing = await prisma.iaDay.findMany({ select: { date: true, journee: true, closed: true } });
  const fresh = rotateJournees(existing, dates);
  if (!fresh.length) return { ok: false, error: "Ces dates sont déjà ouvertes." };
  await prisma.$transaction(async (tx) => {
    for (const { date, journee } of fresh) {
      const cohort = journee === 1 ? await tx.cohort.create({ data: cohortData(date, input.start, input.capacity, now) }) : null;
      await tx.iaDay.create({ data: { date, journee, start: input.start, capacity: input.capacity, cohortId: cohort?.id ?? null } });
    }
  });
  revalidateTag(COHORTS_CACHE_TAG);
  const entries = fresh.filter((d) => d.journee === 1).length;
  return { ok: true, message: `${fresh.length} date${fresh.length > 1 ? "s" : ""} ouverte${fresh.length > 1 ? "s" : ""}${entries ? `, dont ${entries} entrée${entries > 1 ? "s" : ""} (J1)` : ""}.` };
}

/** Changes a date. Its journée only moves while nobody holds a seat on it. */
export async function updateIaDay(input: { id: number; journee: number; start: string; capacity: number; closed: boolean }, now = new Date()): Promise<IaResult> {
  if (!isJournee(input.journee)) return { ok: false, error: "Journée inconnue." };
  const day = await prisma.iaDay.findUnique({ where: { id: input.id }, include: { _count: { select: { seats: true } }, cohort: { select: { id: true, _count: { select: { registrations: true, seatHolds: true } } } } } });
  if (!day) return { ok: false, error: "Date introuvable." };
  if (input.capacity < day._count.seats) return { ok: false, error: `${day._count.seats} places sont déjà prises sur cette date.` };
  if (input.journee !== day.journee) {
    if (day._count.seats > 0) return { ok: false, error: "Des places sont prises : la journée de cette date ne change plus." };
    if (day.cohort && (day.cohort._count.registrations > 0 || day.cohort._count.seatHolds > 0)) return { ok: false, error: "Des personnes sont inscrites sur cette entrée : la journée ne change plus." };
  }
  await prisma.$transaction(async (tx) => {
    let cohortId = day.cohortId;
    if (input.journee === 1 && !cohortId) cohortId = (await tx.cohort.create({ data: cohortData(day.date, input.start, input.capacity, now) })).id;
    if (input.journee !== 1 && cohortId) {
      await tx.iaDay.update({ where: { id: day.id }, data: { cohortId: null } });
      await tx.cohort.delete({ where: { id: cohortId } });
      cohortId = null;
    }
    if (input.journee === 1 && cohortId && cohortId === day.cohortId) {
      const { startsAt, endsAt } = cohortData(day.date, input.start, input.capacity, now);
      await tx.cohort.update({ where: { id: cohortId }, data: { startsAt, endsAt, capacity: input.capacity } });
    }
    await tx.iaDay.update({ where: { id: day.id }, data: { journee: input.journee, start: input.start, capacity: input.capacity, closed: input.closed, cohortId } });
  });
  revalidateTag(COHORTS_CACHE_TAG);
  return { ok: true, message: `${longDate(day.date)} enregistré.` };
}

/** Removes a date nobody holds a seat on, with its J1 cohort if empty. */
export async function deleteIaDay(id: number): Promise<IaResult> {
  const day = await prisma.iaDay.findUnique({ where: { id }, include: { _count: { select: { seats: true } }, cohort: { select: { id: true, _count: { select: { registrations: true, seatHolds: true } } } } } });
  if (!day) return { ok: false, error: "Date introuvable." };
  if (day._count.seats > 0) return { ok: false, error: "Des places sont prises sur cette date : fermez-la plutôt." };
  if (day.cohort && (day.cohort._count.registrations > 0 || day.cohort._count.seatHolds > 0)) return { ok: false, error: "Des personnes sont inscrites sur cette entrée : fermez-la plutôt." };
  await prisma.$transaction(async (tx) => {
    await tx.iaDay.delete({ where: { id } });
    if (day.cohort) await tx.cohort.delete({ where: { id: day.cohort.id } });
  });
  revalidateTag(COHORTS_CACHE_TAG);
  return { ok: true, message: `${longDate(day.date)} supprimé.` };
}

/**
 * The entries (J1 dates) open for registration, soonest first: the IA
 * cohorts the registration code would sell (open, admissions open, seats
 * left), with their date. Used by /ia and /ia/inscription.
 */
export async function openIaEntries(now = new Date(), forLeadId?: number): Promise<Array<{ cohortId: number; date: string; start: string; left: number; capacity: number; startsAt: Date }>> {
  const cohorts = (await loadOpenCohorts(now, forLeadId, "ia")).filter((c) => remainingSeats(c) > 0);
  if (!cohorts.length) return [];
  const days = await prisma.iaDay.findMany({ where: { cohortId: { in: cohorts.map((c) => c.id) }, closed: false }, select: { cohortId: true, date: true, start: true } });
  return cohorts
    .flatMap((c) => {
      const day = days.find((d) => d.cohortId === c.id);
      return day ? [{ cohortId: c.id, date: day.date, start: day.start, left: remainingSeats(c), capacity: c.capacity, startsAt: c.startsAt }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
