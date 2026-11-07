import type { Prisma } from "@prisma/client";

import { calendarHealth } from "@/lib/calendar/google";
import { formatAdmissionDeadline, isAdmissionOpen } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { senderFor, signatureFor } from "@/lib/ia-brand";
import { iaUrl } from "@/lib/ia-domain";
import { sendEmail } from "@/lib/messaging/email";
import { forecastSentence, stateLabel } from "@/lib/pilotage";
import { cohortTitle, loadPilotCohorts } from "@/lib/pilotage-server";
import { AUTO_MESSAGE_TYPES, HEALTH_REPEAT_HOURS, MAX_PROSPECT_EMAILS_PER_RUN, type Mode, PLAYBOOK_IDS, PLAYBOOKS, type PlaybookId, PRESSURE_DAYS, UNFINISHED_MAX_DAYS, catchUpPack, healthProblems, lateAlertDue, mayContact, resolveModes, underPressure, unfinishedDue } from "@/lib/playbooks/rules";
import { planContent } from "@/lib/playbooks/content";
import { planFull, planHot, planLastCall, planOpening, planWrapup } from "@/lib/playbooks/cycle";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";

/**
 * The playbook runner (lot 3): each playbook plans its steps from the
 * database without writing anything; the cron executes the steps of the
 * playbooks that are on, the Playbooks page shows the plan of all of them
 * (what an "Essai" playbook would do). Every executed step is logged in
 * actions_log as "playbook_<id>", which is also what keeps it from
 * happening twice.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MODES_KEY = "playbooks";

export type Step = {
  playbook: PlaybookId;
  /** One line for the page: what this step does, to whom. */
  summary: string;
  email: { to: string; subject: string; text: string; fromName?: string };
  log: { type: string; leadId: number | null; payload: Prisma.InputJsonValue };
  /** Content rhythm: drafts to write for this cohort before the e-mail (run by /api/cron/content). */
  generate?: { cohortId: number };
};

export async function loadModes(): Promise<Record<PlaybookId, Mode>> {
  const row = await prisma.siteSetting.findUnique({ where: { key: MODES_KEY } }).catch(() => null);
  return resolveModes(row?.value);
}

export async function saveMode(id: PlaybookId, mode: Mode): Promise<void> {
  const modes = { ...(await loadModes()), [id]: mode };
  await prisma.siteSetting.upsert({ where: { key: MODES_KEY }, create: { key: MODES_KEY, value: modes }, update: { value: modes } });
}

/* ---------- Santé technique ---------- */

export async function planHealth(now: Date): Promise<Step[]> {
  const [calendar, linkedin, recent] = await Promise.all([
    calendarHealth().catch(() => "unreachable" as const),
    prisma.linkedinCredential.findUnique({ where: { id: 1 }, select: { expiresAt: true } }).catch(() => null),
    prisma.actionLog.findMany({ where: { type: "playbook_health", createdAt: { gte: new Date(now.getTime() - HEALTH_REPEAT_HOURS * HOUR_MS) } }, select: { payload: true } }),
  ]);
  const announced = new Set(recent.flatMap((r) => ((r.payload as { codes?: string[] } | null)?.codes ?? [])));
  const problems = healthProblems({ calendar, emailConfigured: !!process.env.RESEND_API_KEY, linkedinExpiresAt: linkedin?.expiresAt ?? null }, now, env.NEXT_PUBLIC_APP_URL).filter((p) => !announced.has(p.code));
  if (!problems.length) return [];
  return [{
    playbook: "health",
    summary: `Alerte : ${problems.map((p) => p.text.split(" :")[0]).join(" ; ")}`,
    email: {
      to: env.ADMIN_EMAIL,
      subject: problems.length === 1 ? `Alerte : ${problems[0]!.text.split(" :")[0]}` : `Alerte : ${problems.length} problèmes techniques`,
      text: ["Bonjour Ben,", "", ...problems.flatMap((p) => [`• ${p.text}`, `  Pour régler : ${p.fix}`, ""]), "Cette alerte revient chaque jour tant que le problème dure."].join("\n"),
    },
    log: { type: "playbook_health", leadId: null, payload: { codes: problems.map((p) => p.code) } },
  }];
}

/* ---------- Inscription non finalisée ---------- */

/** Where to resume the registration, by programme. */
export function resumeUrl(program: string, cohortId: number, tokens: { scanner: string | null; ia: string | null }, appUrl: string): string | null {
  const base = appUrl.replace(/\/$/, "");
  if (program === "ia") return iaUrl(`/ia/inscription?entree=${cohortId}${tokens.ia ? `&t=${tokens.ia}` : ""}`, base);
  if (program === "cc") return `${base}/demarrer/inscription${tokens.scanner ? `?t=${tokens.scanner}` : ""}`;
  return tokens.scanner ? `${base}/inscription?t=${tokens.scanner}` : null;
}

/** "le 7 janvier": the last day a seat can be bought. */
export function admissionDeadline(program: string, startsAt: Date): string {
  if (program !== "ia") return formatAdmissionDeadline(startsAt);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(startsAt.getTime() - DAY_MS));
}

const admissionOpen = (program: string, startsAt: Date, now: Date) => (program === "ia" ? startsAt.getTime() - DAY_MS > now.getTime() : isAdmissionOpen(startsAt, now));

export function unfinishedEmail(input: { program: string; firstName: string; cohortName: string; startsAt: Date; link: string; unsubscribeToken: string; appUrl: string }): { subject: string; text: string; fromName?: string } {
  const programName = PROGRAMS[input.program as ProgramCode]?.name ?? "la formation";
  const ia = input.program === "ia";
  return {
    subject: `Votre place n’est pas encore réservée · ${programName}`,
    fromName: senderFor(input.program),
    text: [
      `Bonjour ${input.firstName},`,
      "",
      `Vous avez commencé votre inscription à ${programName} (${input.cohortName}) sans la terminer : votre place n’est pas encore réservée.`,
      "",
      `Pour la finaliser, par carte ou par mobile money : ${input.link}`,
      `Les inscriptions pour cette date ferment le ${admissionDeadline(input.program, input.startsAt)}.`,
      "",
      `Un souci de paiement ou une question ? Répondez simplement à ce message${ia ? ", nous vous aidons" : ", je vous aide"}.`,
      "",
      signatureFor(input.program, "Ben"),
      "",
      "—",
      `Pour ne plus recevoir de messages : ${input.appUrl.replace(/\/$/, "")}/desinscription/${input.unsubscribeToken}`,
    ].join("\n"),
  };
}

export async function planUnfinished(now: Date): Promise<Step[]> {
  const registrations = await prisma.registration.findMany({
    where: {
      status: "pending",
      createdAt: { gte: new Date(now.getTime() - UNFINISHED_MAX_DAYS * DAY_MS) },
      cohort: { status: "open", startsAt: { gt: now } },
      lead: { consentAt: { not: null }, unsubscribedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, createdAt: true, reference: true,
      cohort: { select: { id: true, name: true, program: true, startsAt: true } },
      lead: {
        select: {
          id: true, firstName: true, email: true, consentAt: true, unsubscribedAt: true, unsubscribeToken: true,
          scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { resultToken: true } },
          iaDiagnostics: { orderBy: { createdAt: "desc" }, take: 1, select: { token: true } },
          registrations: { where: { status: "paid" }, select: { cohort: { select: { program: true } } } },
        },
      },
    },
  });
  if (!registrations.length) return [];
  const leadIds = [...new Set(registrations.map((r) => r.lead.id))];
  const [sent, recentAuto] = await Promise.all([
    prisma.actionLog.findMany({ where: { type: "playbook_unfinished", leadId: { in: leadIds } }, select: { leadId: true, payload: true } }),
    prisma.actionLog.findMany({ where: { type: { in: [...AUTO_MESSAGE_TYPES] }, leadId: { in: leadIds }, createdAt: { gte: new Date(now.getTime() - PRESSURE_DAYS * DAY_MS) } }, orderBy: { createdAt: "desc" }, select: { leadId: true, createdAt: true } }),
  ]);
  const done = new Set(sent.map((s) => `${s.leadId}:${(s.payload as { cohortId?: number } | null)?.cohortId}`));
  const lastAuto = new Map<number, Date>();
  for (const a of recentAuto) if (a.leadId && !lastAuto.has(a.leadId)) lastAuto.set(a.leadId, a.createdAt);

  const steps: Step[] = [];
  const seen = new Set<string>();
  for (const r of registrations) {
    const key = `${r.lead.id}:${r.cohort.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (done.has(key) || !unfinishedDue(r.createdAt, now) || !mayContact(r.lead) || underPressure(lastAuto.get(r.lead.id), now)) continue;
    if (!admissionOpen(r.cohort.program, r.cohort.startsAt, now)) continue;
    if (r.lead.registrations.some((p) => p.cohort.program === r.cohort.program)) continue;
    const link = resumeUrl(r.cohort.program, r.cohort.id, { scanner: r.lead.scannerResponses[0]?.resultToken ?? null, ia: r.lead.iaDiagnostics[0]?.token ?? null }, env.NEXT_PUBLIC_APP_URL);
    if (!link) continue;
    const email = unfinishedEmail({ program: r.cohort.program, firstName: r.lead.firstName, cohortName: r.cohort.name, startsAt: r.cohort.startsAt, link, unsubscribeToken: r.lead.unsubscribeToken, appUrl: env.NEXT_PUBLIC_APP_URL });
    steps.push({
      playbook: "unfinished",
      summary: `E-mail « finalisez votre place » à ${r.lead.firstName} (${cohortTitle(r.cohort)})`,
      email: { to: r.lead.email, ...email },
      log: { type: "playbook_unfinished", leadId: r.lead.id, payload: { cohortId: r.cohort.id, registrationId: r.id, reference: r.reference } },
    });
  }
  return steps;
}

/* ---------- En retard sur la courbe ---------- */

export async function planLate(now: Date): Promise<Step[]> {
  const late = (await loadPilotCohorts(now)).filter((c) => c.pilot.state === "late");
  if (!late.length) return [];
  const previous = await prisma.actionLog.findMany({ where: { type: "playbook_late", createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } }, orderBy: { createdAt: "desc" }, select: { createdAt: true, payload: true } });
  const since90 = new Date(now.getTime() - 90 * DAY_MS);
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const steps: Step[] = [];
  for (const c of late) {
    const last = previous.find((p) => (p.payload as { cohortId?: number } | null)?.cohortId === c.id);
    if (!lateAlertDue(last ? { at: last.createdAt, behind: Number((last.payload as { behind?: number }).behind ?? 0) } : null, c.pilot.behind, now)) continue;
    const ia = c.program === "ia";
    const [toFollowUp, alumni] = await Promise.all([
      prisma.lead.count({
        where: {
          consentAt: { not: null }, unsubscribedAt: null, createdAt: { gte: since90 }, status: { notIn: ["registered", "lost"] },
          registrations: { none: { status: "paid" } },
          ...(ia ? { iaDiagnostics: { some: {} } } : { scannerResponses: { some: {} } }),
        },
      }),
      prisma.lead.count({ where: { unsubscribedAt: null, registrations: { some: { status: "paid", cohort: { program: c.program, startsAt: { lt: now } } } } } }),
    ]);
    const pack = catchUpPack({ toFollowUp, alumni, unfinished: c.pendingRecent });
    const title = cohortTitle(c);
    steps.push({
      playbook: "late",
      summary: `Alerte : ${title}, ${stateLabel(c.pilot).toLowerCase()}`,
      email: {
        to: env.ADMIN_EMAIL,
        subject: `Cohorte en retard : ${title} (${c.pilot.behind} place${c.pilot.behind > 1 ? "s" : ""})`,
        text: [
          "Bonjour Ben,",
          "",
          `${title} (J${c.pilot.day}) : ${c.pilot.paid} place${c.pilot.paid > 1 ? "s" : ""} payée${c.pilot.paid > 1 ? "s" : ""} sur ${c.pilot.goal}, ${c.pilot.expected} attendue${c.pilot.expected > 1 ? "s" : ""} à ce jour. ${stateLabel(c.pilot)}.`,
          forecastSentence(c.pilot),
          "",
          "Pack de rattrapage proposé (rien ne part sans vous) :",
          ...pack.map((p) => `• ${p}`),
          "",
          `Le pilotage : ${base}/admin/pilotage?c=${c.id}`,
          `Votre file d’actions : ${base}/admin`,
        ].join("\n"),
      },
      log: { type: "playbook_late", leadId: null, payload: { cohortId: c.id, behind: c.pilot.behind, paid: c.pilot.paid, expected: c.pilot.expected } },
    });
  }
  return steps;
}

/* ---------- Runner ---------- */

const PLANNERS: Record<PlaybookId, (now: Date) => Promise<Step[]>> = { health: planHealth, unfinished: planUnfinished, late: planLate, opening: planOpening, hot: planHot, last_call: planLastCall, full: planFull, wrapup: planWrapup, content: planContent };

/** What every playbook would do now, whatever its mode. Writes nothing. */
export async function planAll(now = new Date()): Promise<Record<PlaybookId, Step[]>> {
  const entries = await Promise.all(PLAYBOOK_IDS.map(async (id) => [id, await PLANNERS[id](now).catch((error) => { console.error(`[playbook] ${id}`, error); return [] as Step[]; })] as const));
  return Object.fromEntries(entries) as Record<PlaybookId, Step[]>;
}

/**
 * From the cron: runs the playbooks that are on. A step is logged only when
 * its e-mail left (or when e-mail is not configured, as everywhere else),
 * so a failed send is tried again on the next run.
 */
export async function runPlaybooks(now = new Date()): Promise<Record<PlaybookId, number | Mode>> {
  const modes = await loadModes();
  const out = {} as Record<PlaybookId, number | Mode>;
  // The cron has a minute: prospect e-mails beyond this wait for the next run (nothing is logged for them).
  let prospectBudget = MAX_PROSPECT_EMAILS_PER_RUN * 2;
  for (const id of PLAYBOOK_IDS) {
    if (modes[id] !== "on") { out[id] = modes[id]; continue; }
    // The content rhythm calls the AI: it runs in its own function (/api/cron/content).
    if (id === "content") { out[id] = "on"; continue; }
    const steps = await PLANNERS[id](now).catch((error) => { console.error(`[playbook] ${id}`, error); return [] as Step[]; });
    let done = 0;
    for (const step of steps) {
      if (step.log.leadId !== null && prospectBudget-- <= 0) break;
      const result = await sendEmail(step.email).catch((error) => ({ sent: false as const, reason: String(error) }));
      if (!result.sent && result.reason !== "RESEND_API_KEY manquante") continue;
      await prisma.actionLog.create({ data: { type: step.log.type, leadId: step.log.leadId, channel: "email", payload: step.log.payload } });
      done++;
    }
    out[id] = done;
  }
  return out;
}

export { PLAYBOOKS };
