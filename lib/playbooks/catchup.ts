import { readCampaign } from "@/lib/campaign";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { senderFor, signatureFor } from "@/lib/ia-brand";
import { sendEmail } from "@/lib/messaging/email";
import { closeDayFor, dayFromStart } from "@/lib/pilotage";
import { cohortTitle } from "@/lib/pilotage-server";
import { prospectsFor } from "@/lib/playbooks/cycle";
import { MAX_PROSPECT_EMAILS_PER_RUN } from "@/lib/playbooks/rules";
import type { Step } from "@/lib/playbooks/server";
import { admissionDeadline, resumeUrl } from "@/lib/playbooks/server";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";
import { launchPercent } from "@/lib/promo";

/**
 * Rattrapage en un clic (lot 8 of docs/PILOTAGE.md). For a cohort behind its
 * curve, the pack becomes actions Ben starts from the Pilotage page: an
 * e-mail to the consenting prospects of the programme (last 90 days), under
 * the pressure cap and once per person and cohort, with the real seats left
 * and deadline; three posts written now; the unfinished checkouts and the
 * alumni, prepared in the queue and Codes promo. Nothing leaves without
 * his click.
 */

const DAY_MS = 86_400_000;
/** Prospects of the last this-many days hear about the catch-up. */
export const CATCHUP_LOOKBACK_DAYS = 90;
export const CATCHUP_TYPE = "catchup_email";

const base = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
const longDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
const programName = (p: string) => PROGRAMS[p as ProgramCode]?.name ?? p;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export type CatchUpPlan = {
  cohortId: number;
  title: string;
  /** Why the e-mail cannot go out, or null. */
  blocked: string | null;
  seatsLeft: number;
  /** E-mails ready, at most MAX_PROSPECT_EMAILS_PER_RUN; the rest go with the next click. */
  steps: Step[];
  /** Consenting prospects still to write to, this click and the next ones. */
  eligible: number;
  /** Already written to for this cohort. */
  alreadySent: number;
  unfinished: number;
  alumni: number;
};

export function catchUpEmail(input: { program: string; firstName: string; cohortName: string; startsAt: Date; seatsLeft: number; link: string; launch: { percent: number; until: string } | null; unsubscribeToken: string }): { subject: string; text: string; fromName?: string } {
  const ia = input.program === "ia";
  const deadline = admissionDeadline(input.program, input.startsAt);
  return {
    fromName: senderFor(input.program),
    subject: `Il reste ${plural(input.seatsLeft, "place")} · ${programName(input.program)}`,
    text: [
      `Bonjour ${input.firstName},`,
      "",
      `${ia ? "Nous revenons" : "Je reviens"} vers vous : il reste ${plural(input.seatsLeft, "place")} à ${programName(input.program)} (${input.cohortName}), démarrage le ${longDate(input.startsAt)}. Les inscriptions ferment le ${deadline}.`,
      ...(input.launch ? ["", `Tarif de lancement : -${input.launch.percent} % en payant par carte, jusqu’au ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${input.launch.until}T12:00:00Z`))}.`] : []),
      "",
      `Pour réserver, par carte ou par mobile money : ${input.link}`,
      "",
      ia ? "Une question avant de vous décider ? Répondez simplement à ce message." : "Une question avant de vous décider ? Répondez simplement à ce message, je vous réponds moi-même.",
      "",
      signatureFor(input.program, "Ben"),
      "",
      "—",
      `Pour ne plus recevoir de messages : ${base()}/desinscription/${input.unsubscribeToken}`,
    ].join("\n"),
  };
}

export async function planCatchUp(cohortId: number, now = new Date()): Promise<CatchUpPlan | null> {
  const c = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, program: true, name: true, startsAt: true, capacity: true, status: true, campaign: true, _count: { select: { registrations: { where: { status: "paid" } }, seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } } } } } },
  });
  if (!c) return null;
  const seatsLeft = Math.max(0, c.capacity - c._count.registrations - c._count.seatHolds);
  const [unfinished, alumni, alreadySent] = await Promise.all([
    prisma.registration.count({ where: { cohortId: c.id, status: { in: ["pending", "pending_manual"] }, createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } } }),
    prisma.lead.count({ where: { unsubscribedAt: null, registrations: { some: { status: "paid", cohort: { program: c.program, startsAt: { lt: now } } } } } }),
    prisma.actionLog.findMany({ where: { type: CATCHUP_TYPE }, select: { payload: true } }).then((rows) => rows.filter((r) => (r.payload as { cohortId?: number } | null)?.cohortId === c.id).length),
  ]);
  const plan = { cohortId: c.id, title: cohortTitle(c), seatsLeft, unfinished, alumni, alreadySent };

  const blocked = c.status !== "open" ? "Les inscriptions de cette cohorte ne sont pas ouvertes."
    : !seatsLeft ? "Plus de place libre."
    : dayFromStart(c.startsAt, now) >= closeDayFor(c.program) ? "Les admissions sont fermées."
    : null;
  if (blocked) return { ...plan, blocked, steps: [], eligible: 0 };

  const early = readCampaign(c.campaign)?.promo.early ?? null;
  const percent = launchPercent(early, now);
  const prospects = (await prospectsFor(c.program, new Date(now.getTime() - CATCHUP_LOOKBACK_DAYS * DAY_MS), c.id, CATCHUP_TYPE, now))
    .flatMap((l) => {
      const link = resumeUrl(c.program, c.id, { scanner: l.scannerResponses[0]?.resultToken ?? null, ia: l.iaDiagnostics[0]?.token ?? null }, base());
      return link ? [{ l, link }] : [];
    });
  const steps: Step[] = prospects.slice(0, MAX_PROSPECT_EMAILS_PER_RUN).map(({ l, link }) => ({
    playbook: "late",
    summary: `Rattrapage : ${l.firstName} (${plan.title})`,
    email: { to: l.email, ...catchUpEmail({ program: c.program, firstName: l.firstName, cohortName: c.name, startsAt: c.startsAt, seatsLeft, link, launch: percent && early ? { percent, until: early.until } : null, unsubscribeToken: l.unsubscribeToken }) },
    log: { type: CATCHUP_TYPE, leadId: l.id, payload: { cohortId: c.id } },
  }));
  return { ...plan, blocked: null, steps, eligible: prospects.length };
}

/** Ben's click: sends the ready e-mails and logs each one that left. */
export async function sendCatchUp(cohortId: number, now = new Date()): Promise<{ sent: number; failed: number; remaining: number } | { error: string }> {
  const plan = await planCatchUp(cohortId, now);
  if (!plan) return { error: "Cohorte introuvable." };
  if (plan.blocked) return { error: plan.blocked };
  let sent = 0;
  let failed = 0;
  for (const step of plan.steps) {
    const result = await sendEmail(step.email).catch((error) => ({ sent: false as const, reason: String(error) }));
    if (!result.sent && result.reason !== "RESEND_API_KEY manquante") { failed++; continue; }
    await prisma.actionLog.create({ data: { type: step.log.type, leadId: step.log.leadId, channel: "email", payload: step.log.payload } });
    sent++;
  }
  return { sent, failed, remaining: Math.max(0, plan.eligible - sent) };
}
