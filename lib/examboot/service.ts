import { prisma } from "@/lib/db";
import { EXAMBOOT_QUESTIONS, createTest, examBootEnabled, fetchResults } from "@/lib/examboot/client";
import { recordEvent } from "@/lib/tracking/server";

/**
 * Practice tests for prospects (docs/CONVERSION.md §8). A lead gets a test of
 * their own so the score is theirs; anonymous placements (landing, FAQ) share
 * one test per day, which keeps the site under ExamBoot's quota whatever the
 * traffic. Scores are read by the page while it is open and swept by the cron
 * afterwards, so Ben sees them on the lead sheet even if the tab was closed.
 */

export const PLACEMENTS = ["resultat", "email-resultat", "relance", "rdv-confirme", "rappel-24h", "landing-methode", "faq", "daily"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export function isPlacement(value: unknown): value is Placement {
  return typeof value === "string" && (PLACEMENTS as readonly string[]).includes(value);
}

/**
 * ExamBoot allows 30 creations per minute per IP. Under this many creations
 * in the last minute, everyone gets a test of their own (so their score comes
 * back to them); above it, anonymous visitors share the day's test instead.
 */
const PER_CLICK_BUDGET_PER_MINUTE = 20;

/** A lead's pending test younger than this is reused instead of creating another. */
const REUSE_HOURS = 24;
/** Polling of a pending test stops this long after creation (the visitor gave up). */
export const POLL_WINDOW_MINUTES = 30;
/** The cron keeps sweeping pending tests this long, for scores revealed late. */
const SWEEP_HOURS = 48;

export type TestLink = { code: string; url: string; testId: number; shared: boolean };

/** Test for a known lead: their own, created on demand, reused for a day. */
export async function testForLead(input: { leadId: number; placement: Placement; visitorId?: string | null }, now = new Date()): Promise<TestLink> {
  const recent = await prisma.practiceTest.findFirst({
    where: { leadId: input.leadId, createdAt: { gt: new Date(now.getTime() - REUSE_HOURS * 3_600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent && recent.status === "pending") {
    await recordEvent({ name: "examboot_click", leadId: input.leadId, visitorId: input.visitorId ?? null, label: input.placement });
    return { code: recent.code, url: recent.url, testId: recent.id, shared: false };
  }
  const created = await createTest();
  const row = await prisma.practiceTest.create({
    data: { code: created.code, url: created.url, placement: input.placement, leadId: input.leadId, visitorId: input.visitorId ?? null, questions: EXAMBOOT_QUESTIONS },
  });
  await recordEvent({ name: "examboot_click", leadId: input.leadId, visitorId: input.visitorId ?? null, label: input.placement });
  return { code: row.code, url: row.url, testId: row.id, shared: false };
}

/** Test for an anonymous visitor: the day's shared test, created once. */
export async function sharedTest(placement: Placement, visitorId: string | null, now = new Date()): Promise<TestLink> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let row = await prisma.practiceTest.findFirst({ where: { placement: "daily", createdAt: { gte: dayStart } }, orderBy: { createdAt: "desc" } });
  if (!row) {
    const created = await createTest();
    row = await prisma.practiceTest.create({ data: { code: created.code, url: created.url, placement: "daily", questions: EXAMBOOT_QUESTIONS } });
  }
  await recordEvent({ name: "examboot_click", visitorId, label: placement });
  return { code: row.code, url: row.url, testId: row.id, shared: true };
}

/** Test for an anonymous visitor: their own, keyed on the visitor cookie, reused for a day. */
export async function testForVisitor(input: { visitorId: string; placement: Placement }, now = new Date()): Promise<TestLink> {
  const recent = await prisma.practiceTest.findFirst({
    where: { visitorId: input.visitorId, leadId: null, placement: { not: "daily" }, createdAt: { gt: new Date(now.getTime() - REUSE_HOURS * 3_600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent && recent.status === "pending") {
    await recordEvent({ name: "examboot_click", visitorId: input.visitorId, label: input.placement });
    return { code: recent.code, url: recent.url, testId: recent.id, shared: false };
  }
  const created = await createTest();
  const row = await prisma.practiceTest.create({
    data: { code: created.code, url: created.url, placement: input.placement, visitorId: input.visitorId, questions: EXAMBOOT_QUESTIONS },
  });
  await recordEvent({ name: "examboot_click", visitorId: input.visitorId, label: input.placement });
  return { code: row.code, url: row.url, testId: row.id, shared: false };
}

async function underCreationBudget(now: Date): Promise<boolean> {
  const created = await prisma.practiceTest.count({ where: { createdAt: { gt: new Date(now.getTime() - 60_000) } } });
  return created < PER_CLICK_BUDGET_PER_MINUTE;
}

export async function testFor(input: { placement: Placement; leadId: number | null; visitorId: string | null }, now = new Date()): Promise<TestLink> {
  if (input.leadId) return testForLead({ leadId: input.leadId, placement: input.placement, visitorId: input.visitorId }, now);
  if (input.visitorId && (await underCreationBudget(now))) return testForVisitor({ visitorId: input.visitorId, placement: input.placement }, now);
  return sharedTest(input.placement, input.visitorId, now);
}

/**
 * The latest test of a known lead or visitor, with its score pulled from
 * ExamBoot if still pending: this is what makes the score show up again when
 * the prospect comes back to the page, without any button.
 */
export async function latestTestFor(input: { leadId: number | null; visitorId: string | null }, now = new Date()): Promise<(SyncedResult & { code: string; url: string; placement: string; createdAt: Date }) | null> {
  const where = input.leadId ? { leadId: input.leadId } : input.visitorId ? { visitorId: input.visitorId, leadId: null } : null;
  if (!where) return null;
  const row = await prisma.practiceTest.findFirst({ where: { ...where, placement: { not: "daily" } }, orderBy: { createdAt: "desc" } });
  if (!row) return null;
  let synced: SyncedResult | null = null;
  try {
    synced = await syncResult(row.code, now);
  } catch (error) {
    console.warn("[examboot] lecture du score échouée", row.code, error instanceof Error ? error.message : error);
  }
  const base: SyncedResult = synced ?? { status: row.status === "completed" ? "completed" : "pending", nickname: row.nickname, percent: row.percent, correct: row.correct, questions: row.questions, expired: now.getTime() - row.createdAt.getTime() > POLL_WINDOW_MINUTES * 60_000 };
  return { ...base, code: row.code, url: row.url, placement: row.placement, createdAt: row.createdAt };
}

/** Pull the scores of a lead's pending tests; used when Ben opens the lead sheet. */
export async function syncLeadTests(leadId: number, now = new Date()): Promise<void> {
  if (!examBootEnabled()) return;
  const rows = await prisma.practiceTest.findMany({ where: { leadId, status: "pending", createdAt: { gt: new Date(now.getTime() - SWEEP_HOURS * 3_600_000) } }, take: 5 });
  for (const row of rows) {
    try {
      await syncResult(row.code, now);
    } catch (error) {
      console.warn("[examboot] lecture du score échouée", row.code, error instanceof Error ? error.message : error);
    }
  }
}

export type SyncedResult = { status: "pending" | "completed"; nickname: string | null; percent: number | null; correct: number | null; questions: number; expired: boolean };

/**
 * Reads the score from ExamBoot and stores it. A shared test's "latest" is
 * whoever played last, so it is never attached to a lead; only a lead's own
 * test becomes a lead score.
 */
export async function syncResult(code: string, now = new Date()): Promise<SyncedResult | null> {
  const row = await prisma.practiceTest.findUnique({ where: { code } });
  if (!row) return null;
  const expired = now.getTime() - row.createdAt.getTime() > POLL_WINDOW_MINUTES * 60_000;
  if (row.status === "completed") {
    return { status: "completed", nickname: row.nickname, percent: row.percent, correct: row.correct, questions: row.questions, expired };
  }
  if (row.placement === "daily") return { status: "pending", nickname: null, percent: null, correct: null, questions: row.questions, expired };

  const results = await fetchResults(code);
  if (results.status !== "completed" || !results.latest) {
    await prisma.practiceTest.update({ where: { id: row.id }, data: { checkedAt: now } });
    return { status: "pending", nickname: null, percent: null, correct: null, questions: row.questions, expired };
  }
  const { latest } = results;
  await prisma.practiceTest.update({
    where: { id: row.id },
    data: { status: "completed", nickname: latest.nickname || null, percent: latest.percent, correct: latest.correct, questions: latest.questions, finishedAt: latest.finished_at ? new Date(latest.finished_at) : now, checkedAt: now },
  });
  if (row.leadId) {
    await prisma.actionLog.create({ data: { leadId: row.leadId, type: "practice_test_done", payload: { code, percent: latest.percent, correct: latest.correct, questions: latest.questions, placement: row.placement } } });
  }
  await recordEvent({ name: "examboot_done", leadId: row.leadId, visitorId: row.visitorId, label: `${row.placement}:${bucket(latest.percent)}` });
  return { status: "completed", nickname: latest.nickname || null, percent: latest.percent, correct: latest.correct, questions: latest.questions, expired };
}

/** Score bands for the tunnel: where do prospects land? */
export function bucket(percent: number): string {
  if (percent >= 80) return "80+";
  if (percent >= 60) return "60-79";
  if (percent >= 40) return "40-59";
  return "<40";
}

/** Cron: pull the scores of tests still pending (leads and visitors), up to two days back. */
export async function sweepPendingTests(now = new Date()): Promise<{ checked: number; completed: number }> {
  if (!examBootEnabled()) return { checked: 0, completed: 0 };
  const rows = await prisma.practiceTest.findMany({
    where: { status: "pending", placement: { not: "daily" }, createdAt: { gt: new Date(now.getTime() - SWEEP_HOURS * 3_600_000) } },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
  let completed = 0;
  for (const row of rows) {
    try {
      const result = await syncResult(row.code, now);
      if (result?.status === "completed") completed++;
    } catch (error) {
      console.warn("[examboot] lecture du score échouée", row.code, error instanceof Error ? error.message : error);
    }
  }
  return { checked: rows.length, completed };
}

/** Resolve a lead from the tokens our links carry: scanner result or booking. */
export async function leadFromTokens(input: { resultToken?: string | null; rescheduleToken?: string | null }): Promise<number | null> {
  if (input.resultToken && input.resultToken.length >= 10) {
    const r = await prisma.scannerResponse.findUnique({ where: { resultToken: input.resultToken }, select: { leadId: true } });
    if (r) return r.leadId;
  }
  if (input.rescheduleToken && input.rescheduleToken.length >= 10) {
    const b = await prisma.booking.findUnique({ where: { rescheduleToken: input.rescheduleToken }, select: { leadId: true } });
    if (b) return b.leadId;
  }
  return null;
}
