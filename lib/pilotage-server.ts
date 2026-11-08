import { Prisma } from "@prisma/client";

import { VERDICT_LABEL, verdictText } from "@/lib/ads";
import { analystWeekKey, outputSchema, reportParagraph } from "@/lib/analyst/rules";
import { loadAdCampaigns } from "@/lib/ads-server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { mondayReport, reportWeekKey } from "@/lib/pilotage-report";
import { type Pilot, type PilotInput, pilot } from "@/lib/pilotage";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";

/**
 * Pilotage data (lot 2): the cohorts still to start, with their goal, paid
 * seats and forecast, and the funnel of each programme. Read-only.
 */

const DAY_MS = 86_400_000;
/** Cohorts shown: the next ones to start, at most this many. */
export const PILOT_COHORTS = 8;

export type PilotCohort = {
  id: number;
  program: ProgramCode;
  name: string;
  startsAt: Date;
  capacity: number;
  input: PilotInput;
  pilot: Pilot;
  /** Registrations started (checkout opened) and not paid, still recent. */
  pendingRecent: number;
  /** Seats kept after a call, not yet paid. */
  held: number;
  /** Where the paid participants came from: source → count. */
  sources: Array<{ source: string; count: number }>;
};

/** Registrations started this recently and still unpaid count as "en cours". */
const PENDING_DAYS = 14;

export async function loadPilotCohorts(now = new Date()): Promise<PilotCohort[]> {
  const today = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
  const cohorts = await prisma.cohort.findMany({
    where: { status: { in: ["planned", "open", "full"] }, startsAt: { gte: today } },
    orderBy: { startsAt: "asc" },
    take: PILOT_COHORTS,
    select: {
      id: true, program: true, name: true, startsAt: true, capacity: true, targetSeats: true,
      registrations: {
        where: { status: { in: ["paid", "pending", "pending_manual"] } },
        select: { status: true, paidAt: true, createdAt: true, lead: { select: { utmSource: true, source: true } } },
      },
      seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } }, select: { id: true } },
    },
  });

  return cohorts.map((c) => {
    const paid = c.registrations.filter((r) => r.status === "paid");
    const input: PilotInput = { program: c.program, startsAt: c.startsAt, goal: c.targetSeats ?? c.capacity, paidAt: paid.map((r) => r.paidAt ?? r.createdAt) };
    const counts = new Map<string, number>();
    for (const r of paid) {
      const source = sourceLabel(r.lead.utmSource ?? r.lead.source);
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
    return {
      id: c.id,
      program: c.program as ProgramCode,
      name: c.name,
      startsAt: c.startsAt,
      capacity: c.capacity,
      input,
      pilot: pilot(input, now),
      pendingRecent: c.registrations.filter((r) => r.status !== "paid" && now.getTime() - r.createdAt.getTime() < PENDING_DAYS * DAY_MS).length,
      held: c.seatHolds.length,
      sources: [...counts].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    };
  });
}

/** "linkedin" → "LinkedIn"; nothing → "Direct". */
export function sourceLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "Direct";
  const known: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", whatsapp: "WhatsApp", tiktok: "TikTok", google: "Google", email: "E-mail", newsletter: "E-mail", examboot: "ExamBoot" };
  for (const [k, v] of Object.entries(known)) if (s.includes(k)) return v;
  return raw!.trim().slice(0, 40);
}

/** The top of each programme's funnel: events counted in distinct visitors. */
export const PROGRAM_FUNNEL: Record<ProgramCode, ReadonlyArray<{ name: string; label?: string; title: string; unit: string }>> = {
  cissp: [
    { name: "landing_view", title: "Visites de la page CISSP", unit: "visites" },
    { name: "scanner_submit", title: "Analyses de profil", unit: "analyses de profil" },
    { name: "booking_done", title: "Appels réservés", unit: "appels réservés" },
  ],
  cc: [
    { name: "program_view", label: "cc", title: "Visites de la page CC", unit: "visites" },
  ],
  ia: [
    { name: "ia_view", title: "Visites du Bâtisseur IA", unit: "visites" },
    { name: "ia_diagnostic_submit", title: "Diagnostics", unit: "diagnostics" },
  ],
};

export type FunnelStep = { title: string; unit: string; count: number };

/** Each programme's funnel top over [since, until): distinct visitors per step. */
export async function programFunnels(since: Date, until: Date): Promise<Record<ProgramCode, FunnelStep[]>> {
  const names = [...new Set(Object.values(PROGRAM_FUNNEL).flatMap((steps) => steps.map((s) => s.name)))];
  const rows = await prisma.$queryRaw<Array<{ name: string; label: string | null; visitors: bigint | number }>>(Prisma.sql`
    SELECT name, label, COUNT(DISTINCT COALESCE(visitor_id, CONCAT('lead:', lead_id))) AS visitors
    FROM funnel_events
    WHERE created_at >= ${since} AND created_at < ${until} AND name IN (${Prisma.join(names)})
    GROUP BY name, label`);
  const count = (name: string, label?: string) => rows.filter((r) => r.name === name && (label === undefined || r.label === label)).reduce((n, r) => n + Number(r.visitors), 0);
  const out = {} as Record<ProgramCode, FunnelStep[]>;
  for (const [program, steps] of Object.entries(PROGRAM_FUNNEL) as Array<[ProgramCode, (typeof PROGRAM_FUNNEL)[ProgramCode]]>) {
    out[program] = steps.map((s) => ({ title: s.title, unit: s.unit, count: count(s.name, s.label) }));
  }
  return out;
}

/** The marketing posts that brought the most visitors over [since, until). */
export async function topPosts(since: Date, until: Date, take = 3): Promise<Array<{ code: string; channel: string; topic: string; visitors: number }>> {
  const rows = await prisma.$queryRaw<Array<{ code: string; visitors: bigint | number }>>(Prisma.sql`
    SELECT utm_content AS code, COUNT(DISTINCT COALESCE(visitor_id, CONCAT('lead:', lead_id))) AS visitors
    FROM funnel_events
    WHERE utm_content IS NOT NULL AND created_at >= ${since} AND created_at < ${until}
    GROUP BY utm_content
    ORDER BY visitors DESC
    LIMIT ${take}`);
  if (!rows.length) return [];
  const posts = await prisma.marketingPost.findMany({ where: { code: { in: rows.map((r) => r.code) } }, select: { code: true, channel: true, topic: true, angle: true } });
  return rows.flatMap((r) => {
    const p = posts.find((x) => x.code === r.code);
    return p ? [{ code: r.code, channel: p.channel, topic: p.topic ?? p.angle, visitors: Number(r.visitors) }] : [];
  });
}

/** "CISSP Bootcamp — Cohorte de décembre". */
export const cohortTitle = (c: { program: string; name: string }) => `${PROGRAMS[c.program as ProgramCode]?.name ?? c.program} — ${c.name}`;

/** Everything the Monday report needs, read from the database. */
export async function mondayReportInput(now: Date, appUrl: string) {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [cohorts, funnels, posts, ads, analyst] = await Promise.all([
    loadPilotCohorts(now), programFunnels(since, now), topPosts(since, now), loadAdCampaigns({ active: true }).catch(() => []),
    Promise.resolve().then(() => prisma.analystReport.findUnique({ where: { weekKey: analystWeekKey(now) }, select: { output: true } })).catch(() => null),
  ]);
  const analystOutput = analyst ? outputSchema.safeParse(analyst.output) : null;
  const programs = [...new Set(cohorts.map((c) => c.program))];
  return {
    cohorts,
    report: mondayReport({
      now,
      cohorts: cohorts.map((c) => ({ title: cohortTitle(c), startsAt: c.startsAt, pilot: c.pilot, pendingRecent: c.pendingRecent, held: c.held })),
      week: programs.map((p) => ({ program: PROGRAMS[p].name, steps: funnels[p] })),
      posts,
      ads: ads.map((a) => ({ name: a.name, verdict: VERDICT_LABEL[a.metrics.verdict], text: verdictText(a.metrics) })),
      analyst: analystOutput?.success ? reportParagraph(analystOutput.data, `${appUrl.replace(/\/$/, "")}/admin/analyste`) : [],
      appUrl,
    }),
  };
}

const REPORT_KEY = "pilotage_report";

/**
 * Sends the Monday report once per week, from the daily cron: on Mondays
 * only, never twice for the same week, to the admin. Nothing to say (no
 * cohort to come) is still worth one line, so it is sent all the same.
 */
export async function sendMondayReport(now = new Date()): Promise<"sent" | "not_monday" | "already" | "failed"> {
  if (now.getUTCDay() !== 1) return "not_monday";
  const week = reportWeekKey(now);
  const row = await prisma.siteSetting.findUnique({ where: { key: REPORT_KEY } }).catch(() => null);
  if ((row?.value as { week?: string } | null)?.week === week) return "already";
  const { report } = await mondayReportInput(now, env.NEXT_PUBLIC_APP_URL);
  const result = await sendEmail({ to: env.ADMIN_EMAIL, ...report });
  if (!result.sent && result.reason !== "RESEND_API_KEY manquante") return "failed";
  await prisma.siteSetting.upsert({ where: { key: REPORT_KEY }, create: { key: REPORT_KEY, value: { week } }, update: { value: { week } } });
  return "sent";
}
