import { admissionClosesAt, formatCohortMonth } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { examBootEnabled } from "@/lib/examboot/client";
import { formatUsdCents } from "@/lib/pricing";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";
import { HOT_LEAD_THRESHOLD } from "@/lib/scoring";

import { type Pace, type SegmentKey, type TestStats, paceFor, publishableTestStats, recommendations, segmentOf } from "./plan";

/** Reads for the admin marketing page (Ben, 28/09). Never sends anything. */

const DAY = 86_400_000;

export type CohortFacts = {
  id: number;
  program: ProgramCode;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  paid: number;
  held: number;
  admissionClosesAt: Date;
  pace: Pace;
  prices: { africa: string | null; international: string | null };
};

/** Upcoming cohorts, soonest first, for the selector. */
export async function marketingCohorts() {
  return prisma.cohort.findMany({
    where: { status: { in: ["planned", "open", "full"] }, startsAt: { gte: new Date(Date.now() - 15 * DAY) } },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true, program: true, startsAt: true, status: true },
  });
}

export async function cohortFacts(cohortId: number, now = new Date()): Promise<CohortFacts | null> {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) return null;
  const [paid, held, tiers, programPrices] = await Promise.all([
    prisma.registration.count({ where: { cohortId, status: "paid" } }),
    prisma.seatHold.count({ where: { cohortId, releasedAt: null, expiresAt: { gt: now } } }),
    prisma.pricingTier.findMany({ select: { code: true, amountUsd: true } }),
    prisma.programPrice.findMany({ where: { program: cohort.program }, select: { tier: true, amountUsd: true } }),
  ]);
  const price = (tier: string) => {
    const amount = cohort.program === "cissp" ? tiers.find((t) => t.code === tier)?.amountUsd : programPrices.find((p) => p.tier === tier)?.amountUsd;
    return amount ? formatUsdCents(amount) : null;
  };
  const closes = admissionClosesAt(cohort.startsAt);
  return {
    id: cohort.id,
    program: cohort.program,
    name: cohort.name,
    startsAt: cohort.startsAt,
    endsAt: cohort.endsAt,
    capacity: cohort.capacity,
    paid,
    held,
    admissionClosesAt: closes,
    pace: paceFor(Math.max(0, cohort.capacity - paid - held), closes, now),
    prices: { africa: price("africa"), international: price("international") },
  };
}

/** Practice test scores of the last 30 days, publishable only above the minimum sample. */
export async function recentTestStats(threshold: number, now = new Date()): Promise<{ done: number; stats: TestStats | null }> {
  const rows = await prisma.practiceTest.findMany({
    where: { status: "completed", percent: { not: null }, finishedAt: { gte: new Date(now.getTime() - 30 * DAY) } },
    select: { percent: true },
    take: 5000,
  });
  const percents = rows.map((r) => r.percent as number);
  return { done: percents.length, stats: publishableTestStats(percents, threshold) };
}

/** The facts handed to the model, one per line. Nothing it may not say. */
export function factsForModel(f: CohortFacts, stats: TestStats | null = null): string {
  const program = PROGRAMS[f.program];
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return [
    `Programme : ${program.productName} — ${program.productLine}`,
    `Cohorte : ${f.name}, du ${fmt(f.startsAt)} au ${fmt(f.endsAt)} (${formatCohortMonth(f.startsAt)}).`,
    f.program === "cissp" ? "Rythme : 2 h en soirée lundi, mardi, jeudi, vendredi ; mercredi sans session, pour lire ; 5 h 30 le samedi et le dimanche. 40 h en direct, en français." : `Rythme : ${program.hours} h en direct sur ${program.days} jours, en français.`,
    `Places : ${f.capacity} au total, ${f.pace.remaining} encore libres.`,
    `Clôture des admissions : ${fmt(f.admissionClosesAt)}.`,
    `Tarif : ${f.prices.africa ?? "?"} en Afrique francophone, ${f.prices.international ?? "?"} à l'international. Paiement par carte ou mobile money.`,
    f.program === "cissp" ? "Frais d'examen ISC² en plus (~750 USD). Sans les 5 ans d'expérience, l'examen réussi donne le titre Associate of ISC²." : "Aucun prérequis. Première marche vers le CISSP.",
    "Coach : Ben, coach CISSP certifié, auditeur ISO 27001, francophone. Plan de lecture interactif et documents de préparation fournis.",
    "Analyse de profil gratuite en 3 minutes : éligibilité, délai estimé, voie conseillée.",
    examBootEnabled() ? "Test gratuit : 5 questions d'entraînement originales, au niveau et dans l'esprit du CISSP (pas des questions officielles), corrigées, sans compte, en 10 minutes." : null,
    stats
      ? `Chiffres réels des 30 derniers jours, à citer exactement ou pas du tout : ${stats.count} tests d'entraînement faits sur le site, score moyen ${stats.averagePercent} %, ${stats.atOrAbove} % des candidats à ${stats.threshold} % ou plus.`
      : "Aucun chiffre de résultats n'est publiable : n'en cite aucun.",
  ].filter((l): l is string => l !== null).join("\n");
}

export type Cockpit = {
  scans30: number;
  scans7: number;
  calls30: number;
  paid30: number;
  tests30: number;
  testStats: TestStats | null;
  hotUnpaid: number;
  callsWithoutSeat: number;
  daysSinceLastPost: number | null;
  todo: string[];
};

export async function cockpit(f: CohortFacts, threshold: number, now = new Date()): Promise<Cockpit> {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);
  const [scans30, scans7, calls30, paid30, segments, lastPost, tests] = await Promise.all([
    prisma.scannerResponse.count({ where: { createdAt: { gte: since30 } } }),
    prisma.scannerResponse.count({ where: { createdAt: { gte: since7 } } }),
    prisma.booking.count({ where: { kind: "discovery", createdAt: { gte: since30 } } }),
    prisma.registration.count({ where: { status: "paid", paidAt: { gte: since30 }, cohort: { program: f.program } } }),
    followupSegments(f.program, threshold),
    prisma.marketingPost.findFirst({ where: { cohortId: f.id, publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, select: { publishedAt: true } }),
    recentTestStats(threshold, now),
  ]);
  const hotUnpaid = segments.find((s) => s.key === "hot")?.leads.length ?? 0;
  const callsWithoutSeat = segments.find((s) => s.key === "called")?.leads.length ?? 0;
  const daysSinceLastPost = lastPost?.publishedAt ? Math.floor((now.getTime() - lastPost.publishedAt.getTime()) / DAY) : null;
  return {
    scans30,
    scans7,
    calls30,
    paid30,
    tests30: tests.done,
    testStats: tests.stats,
    hotUnpaid,
    callsWithoutSeat,
    daysSinceLastPost,
    todo: recommendations({ pace: f.pace, hotUnpaid, callsWithoutSeat, daysSinceLastPost, scansLast7Days: scans7, tests30: examBootEnabled() ? tests.done : undefined }),
  };
}

export type SegmentLead = { id: number; firstName: string; lastName: string; heatScore: number; readiness: string | null; whatsapp: string | null; email: string; lastContactAt: Date | null; testPercent: number | null };
export type Segment = { key: SegmentKey; label: string; hint: string; leads: SegmentLead[] };

const SEGMENT_TEXT: Record<SegmentKey, (threshold: number) => { label: string; hint: string }> = {
  called: () => ({ label: "Appel fait, pas encore inscrit", hint: "Les plus proches de l'inscription." }),
  test_high: (t) => ({ label: "Test réussi, sans place", hint: `Score de ${t} % ou plus : prêts à accélérer.` }),
  test_low: (t) => ({ label: "Test à consolider, sans place", hint: `Score sous ${t} % : le coaching comble les lacunes.` }),
  hot: () => ({ label: "Chauds, pas encore testés", hint: `Chaleur ${HOT_LEAD_THRESHOLD} et plus : proposez-leur le test.` }),
  associate: () => ({ label: "Profil Associate of ISC²", hint: "Éligibles via le titre Associate." }),
  conseil: () => ({ label: "Délai serré : le conseil d'abord", hint: "Leur échéance est plus courte que l'estimation." }),
  cc: () => ({ label: "Pas encore prêts : CC ou conseil", hint: "Première marche : la CC d'ISC², ou un bilan de carrière." }),
};

/**
 * People who asked to hear from Ben and have no seat yet, sorted by what
 * they actually did (segmentOf). Consent given, never unsubscribed, not lost,
 * and not contacted from here in the last three days: follow-ups stay
 * personal and spaced (docs/CADRAGE.md §6).
 */
export async function followupSegments(program: ProgramCode, threshold: number, now = new Date()): Promise<Segment[]> {
  const recent = new Date(now.getTime() - 3 * DAY);
  const leads = await prisma.lead.findMany({
    where: {
      consentAt: { not: null },
      unsubscribedAt: null,
      status: { notIn: ["lost", "registered"] },
      registrations: { none: { status: "paid" } },
      actions: { none: { type: "marketing_followup_sent", createdAt: { gte: recent } } },
    },
    orderBy: { heatScore: "desc" },
    take: 200,
    select: {
      id: true, firstName: true, lastName: true, heatScore: true, readiness: true, whatsapp: true, email: true,
      bookings: { where: { kind: "discovery", status: "done" }, select: { id: true }, take: 1 },
      actions: { where: { type: "marketing_followup_sent" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      practiceTests: { where: { status: "completed", percent: { not: null } }, orderBy: { finishedAt: "desc" }, take: 1, select: { percent: true } },
      scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { analysis: true } },
    },
  });
  const buckets = new Map<SegmentKey, SegmentLead[]>();
  for (const l of leads) {
    const testPercent = l.practiceTests[0]?.percent ?? null;
    const analysis = l.scannerResponses[0]?.analysis as { goalIsTight?: boolean } | null | undefined;
    const key = segmentOf({ hadCall: l.bookings.length > 0, testPercent, heatScore: l.heatScore, readiness: l.readiness, goalIsTight: analysis?.goalIsTight === true }, threshold, HOT_LEAD_THRESHOLD);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push({ id: l.id, firstName: l.firstName, lastName: l.lastName, heatScore: l.heatScore, readiness: l.readiness, whatsapp: l.whatsapp, email: l.email, lastContactAt: l.actions[0]?.createdAt ?? null, testPercent });
    buckets.set(key, list);
  }
  // A CC cohort is sold to the CC segment first.
  const order: SegmentKey[] = program === "cc" ? ["cc", "called", "test_low", "hot"] : ["called", "test_high", "test_low", "hot", "associate", "conseil", "cc"];
  return order.map((key) => ({ key, ...SEGMENT_TEXT[key](threshold), leads: buckets.get(key) ?? [] }));
}

/** Saved posts with what their tracked link brought in. */
export async function libraryWithResults(cohortId: number) {
  const posts = await prisma.marketingPost.findMany({ where: { cohortId }, orderBy: { createdAt: "desc" }, take: 40 });
  if (posts.length === 0) return [];
  const codes = posts.map((p) => p.code);
  const [leads, tests] = await Promise.all([
    prisma.lead.findMany({
      where: { utmContent: { in: codes } },
      select: { utmContent: true, registrations: { where: { status: "paid" }, select: { id: true }, take: 1 } },
    }),
    prisma.practiceTest.findMany({ where: { campaignCode: { in: codes } }, select: { campaignCode: true, status: true } }),
  ]);
  return posts.map((p) => {
    const mine = leads.filter((l) => l.utmContent === p.code);
    const myTests = tests.filter((t) => t.campaignCode === p.code);
    return { ...p, tests: myTests.length, testsDone: myTests.filter((t) => t.status === "completed").length, leads: mine.length, paid: mine.filter((l) => l.registrations.length > 0).length };
  });
}
