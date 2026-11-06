import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { senderFor, signatureFor } from "@/lib/ia-brand";
import { iaUrl } from "@/lib/ia-domain";
import { waMeLink } from "@/lib/messaging/templates";
import { closeDayFor, dayFromStart } from "@/lib/pilotage";
import { cohortTitle } from "@/lib/pilotage-server";
import { AUTO_MESSAGE_TYPES, HOT_MAX_DAYS, HOT_MIN_DAYS, LAST_CALL_LOOKBACK_DAYS, MAX_PROSPECT_EMAILS_PER_RUN, OPENING_LOOKBACK_DAYS, PRESSURE_DAYS, WRAPUP_AFTER_DAYS, lastCallDue, mayContact, openingDue, programOfReadiness, underPressure } from "@/lib/playbooks/rules";
import type { Step } from "@/lib/playbooks/server";
import { admissionDeadline, resumeUrl } from "@/lib/playbooks/server";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";

/**
 * The cycle playbooks (lot 4 of docs/PILOTAGE.md): opening, hot prospect
 * (Bâtisseur IA), last call, full cohort, wrap-up. Same contract as lot 3:
 * plan without writing; the runner sends and logs. Prospect e-mails go to
 * consenting people only, under the pressure cap, once per person and
 * cohort, at most MAX_PROSPECT_EMAILS_PER_RUN per run.
 */

const DAY_MS = 86_400_000;
const base = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
const longDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
const programName = (p: string) => PROGRAMS[p as ProgramCode]?.name ?? p;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

type CohortRow = { id: number; program: string; name: string; startsAt: Date; endsAt: Date; capacity: number; status: string; paid: number; held: number };

async function upcomingCohorts(now: Date): Promise<CohortRow[]> {
  const rows = await prisma.cohort.findMany({
    where: { startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    select: { id: true, program: true, name: true, startsAt: true, endsAt: true, capacity: true, status: true, _count: { select: { registrations: { where: { status: "paid" } }, seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } } } } } },
  });
  return rows.map((r) => ({ id: r.id, program: r.program, name: r.name, startsAt: r.startsAt, endsAt: r.endsAt, capacity: r.capacity, status: r.status, paid: r._count.registrations, held: r._count.seatHolds }));
}

const seatsLeft = (c: CohortRow) => Math.max(0, c.capacity - c.paid - c.held);

/** Consenting prospects of a programme, not registered in it, not written to too recently, not already reached by this playbook for this cohort. */
async function prospectsFor(program: string, since: Date, cohortId: number, type: string, now: Date) {
  const ia = program === "ia";
  const leads = await prisma.lead.findMany({
    where: {
      consentAt: { not: null }, unsubscribedAt: null, status: { notIn: ["registered", "lost"] },
      ...(ia ? { iaDiagnostics: { some: { createdAt: { gte: since } } } } : { scannerResponses: { some: { createdAt: { gte: since } } } }),
    },
    select: {
      id: true, firstName: true, email: true, consentAt: true, unsubscribedAt: true, unsubscribeToken: true, readiness: true,
      scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { resultToken: true } },
      iaDiagnostics: { orderBy: { createdAt: "desc" }, take: 1, select: { token: true } },
      registrations: { where: { status: { in: ["paid", "pending", "pending_manual"] } }, select: { status: true, cohortId: true, cohort: { select: { program: true } } } },
    },
    take: 500,
  });
  const candidates = leads.filter((l) => mayContact(l) && (ia || programOfReadiness(l.readiness) === program) && !l.registrations.some((r) => r.status === "paid" && r.cohort.program === program));
  if (!candidates.length) return [];
  const ids = candidates.map((l) => l.id);
  const [done, recent] = await Promise.all([
    prisma.actionLog.findMany({ where: { type, leadId: { in: ids } }, select: { leadId: true, payload: true } }),
    prisma.actionLog.findMany({ where: { type: { in: [...AUTO_MESSAGE_TYPES] }, leadId: { in: ids }, createdAt: { gte: new Date(now.getTime() - PRESSURE_DAYS * DAY_MS) } }, orderBy: { createdAt: "desc" }, select: { leadId: true, createdAt: true } }),
  ]);
  const reached = new Set(done.filter((d) => (d.payload as { cohortId?: number } | null)?.cohortId === cohortId || type === "playbook_hot").map((d) => d.leadId));
  const last = new Map<number, Date>();
  for (const r of recent) if (r.leadId && !last.has(r.leadId)) last.set(r.leadId, r.createdAt);
  return candidates.filter((l) => !reached.has(l.id) && !underPressure(last.get(l.id), now));
}

function footer(program: string, unsubscribeToken: string): string[] {
  return ["", signatureFor(program, "Ben"), "", "—", `Pour ne plus recevoir de messages : ${base()}/desinscription/${unsubscribeToken}`];
}

/* ---------- Ouverture ---------- */

export async function planOpening(now: Date): Promise<Step[]> {
  const steps: Step[] = [];
  for (const c of await upcomingCohorts(now)) {
    const day = dayFromStart(c.startsAt, now);
    if (!openingDue(day)) continue;
    if (c.status === "planned") {
      const reminded = await prisma.actionLog.findFirst({ where: { type: "playbook_opening_admin", createdAt: { gte: new Date(now.getTime() - 3 * DAY_MS) } }, select: { payload: true } });
      if ((reminded?.payload as { cohortId?: number } | null)?.cohortId === c.id) continue;
      steps.push({
        playbook: "opening",
        summary: `Rappel : ouvrir les inscriptions de ${cohortTitle(c)}`,
        email: { to: env.ADMIN_EMAIL, subject: `Campagne ouverte : ${cohortTitle(c)} attend l’ouverture des inscriptions`, text: ["Bonjour Ben,", "", `La campagne de ${cohortTitle(c)} commence (J${day}), mais ses inscriptions ne sont pas ouvertes : personne ne peut encore réserver.`, "", `Pour les ouvrir : ${base()}/admin/cohortes/${c.id}`, "", "Le rappel revient dans trois jours si elles sont toujours fermées."].join("\n") },
        log: { type: "playbook_opening_admin", leadId: null, payload: { cohortId: c.id } },
      });
      continue;
    }
    if (c.status !== "open" || !seatsLeft(c)) continue;
    const prospects = await prospectsFor(c.program, new Date(now.getTime() - OPENING_LOOKBACK_DAYS * DAY_MS), c.id, "playbook_opening", now);
    for (const l of prospects.slice(0, MAX_PROSPECT_EMAILS_PER_RUN)) {
      const link = resumeUrl(c.program, c.id, { scanner: l.scannerResponses[0]?.resultToken ?? null, ia: l.iaDiagnostics[0]?.token ?? null }, base());
      if (!link) continue;
      steps.push({
        playbook: "opening",
        summary: `« Les inscriptions sont ouvertes » à ${l.firstName} (${cohortTitle(c)})`,
        email: {
          to: l.email,
          fromName: senderFor(c.program),
          subject: `Les inscriptions sont ouvertes · ${programName(c.program)}`,
          text: [
            `Bonjour ${l.firstName},`,
            "",
            `Les inscriptions à ${programName(c.program)} (${c.name}) sont ouvertes : démarrage le ${longDate(c.startsAt)}, ${plural(c.capacity, "place")}.`,
            "",
            `Pour réserver la vôtre, par carte ou par mobile money : ${link}`,
            `Les inscriptions ferment le ${admissionDeadline(c.program, c.startsAt)}.`,
            "",
            `Une question ? Répondez simplement à ce message.`,
            ...footer(c.program, l.unsubscribeToken),
          ].join("\n"),
        },
        log: { type: "playbook_opening", leadId: l.id, payload: { cohortId: c.id } },
      });
    }
  }
  return steps;
}

/* ---------- Prospect chaud (Bâtisseur IA) ---------- */

export async function planHot(now: Date): Promise<Step[]> {
  const next = (await upcomingCohorts(now)).find((c) => c.program === "ia" && c.status === "open" && seatsLeft(c) > 0 && c.startsAt.getTime() - DAY_MS > now.getTime());
  if (!next) return [];
  const prospects = await prospectsFor("ia", new Date(now.getTime() - HOT_MAX_DAYS * DAY_MS), next.id, "playbook_hot", now);
  const latest = await prisma.iaDiagnostic.findMany({ where: { leadId: { in: prospects.map((p) => p.id) } }, orderBy: { createdAt: "desc" }, select: { leadId: true, createdAt: true, result: true } });
  const steps: Step[] = [];
  for (const l of prospects) {
    const diag = latest.find((d) => d.leadId === l.id);
    if (!diag) continue;
    const age = now.getTime() - diag.createdAt.getTime();
    if (age < HOT_MIN_DAYS * DAY_MS || age > HOT_MAX_DAYS * DAY_MS) continue;
    if (l.registrations.some((r) => r.cohort.program === "ia")) continue; // a started checkout is the other playbook's
    const first = (diag.result as { priorities?: Array<{ title?: string }> } | null)?.priorities?.[0]?.title;
    const link = iaUrl(`/ia/inscription?entree=${next.id}${l.iaDiagnostics[0]?.token ? `&t=${l.iaDiagnostics[0].token}` : ""}`, base());
    steps.push({
      playbook: "hot",
      summary: `Suite du diagnostic à ${l.firstName}`,
      email: {
        to: l.email,
        fromName: senderFor("ia"),
        subject: "Votre diagnostic, et la suite · Bâtisseur IA",
        text: [
          `Bonjour ${l.firstName},`,
          "",
          first ? `Vous avez fait le diagnostic du Bâtisseur IA. La première automatisation conseillée pour vous : « ${first} ». Pendant la formation, vous la construisez vous-même, sur votre propre application.` : "Vous avez fait le diagnostic du Bâtisseur IA : pendant la formation, vous construisez vous-même votre application et ses automatisations.",
          "",
          `Prochaine entrée : ${longDate(next.startsAt)}. Pour choisir votre date et vous inscrire : ${link}`,
          "",
          "Une question ? Répondez à ce message, nous vous répondons.",
          ...footer("ia", l.unsubscribeToken),
        ].join("\n"),
      },
      log: { type: "playbook_hot", leadId: l.id, payload: { cohortId: next.id } },
    });
    if (steps.length >= MAX_PROSPECT_EMAILS_PER_RUN) break;
  }
  return steps;
}

/* ---------- Dernier appel ---------- */

export async function planLastCall(now: Date): Promise<Step[]> {
  const steps: Step[] = [];
  for (const c of await upcomingCohorts(now)) {
    const left = seatsLeft(c);
    if (c.status !== "open" || !left || !lastCallDue(dayFromStart(c.startsAt, now), closeDayFor(c.program))) continue;
    const prospects = await prospectsFor(c.program, new Date(now.getTime() - LAST_CALL_LOOKBACK_DAYS * DAY_MS), c.id, "playbook_last_call", now);
    for (const l of prospects.slice(0, MAX_PROSPECT_EMAILS_PER_RUN)) {
      const link = resumeUrl(c.program, c.id, { scanner: l.scannerResponses[0]?.resultToken ?? null, ia: l.iaDiagnostics[0]?.token ?? null }, base());
      if (!link) continue;
      const deadline = admissionDeadline(c.program, c.startsAt);
      steps.push({
        playbook: "last_call",
        summary: `Dernier appel à ${l.firstName} (${cohortTitle(c)})`,
        email: {
          to: l.email,
          fromName: senderFor(c.program),
          subject: `Les inscriptions ferment le ${deadline} · ${programName(c.program)}`,
          text: [
            `Bonjour ${l.firstName},`,
            "",
            `Les inscriptions à ${programName(c.program)} (${c.name}, démarrage le ${longDate(c.startsAt)}) ferment le ${deadline}. Il reste ${plural(left, "place")}.`,
            "",
            `Pour réserver, par carte ou par mobile money : ${link}`,
            "",
            c.program === "ia" ? "Si le moment n’est pas le bon, aucun souci : répondez-nous simplement, et nous vous écrirons pour la date suivante." : "Si le moment n’est pas le bon, aucun souci : répondez-moi simplement, et je vous écrirai pour la cohorte suivante.",
            ...footer(c.program, l.unsubscribeToken),
          ].join("\n"),
        },
        log: { type: "playbook_last_call", leadId: l.id, payload: { cohortId: c.id } },
      });
    }
  }
  return steps;
}

/* ---------- Cohorte pleine ---------- */

export async function planFull(now: Date): Promise<Step[]> {
  const cohorts = await upcomingCohorts(now);
  const full = cohorts.filter((c) => c.paid >= c.capacity);
  if (!full.length) return [];
  const told = await prisma.actionLog.findMany({ where: { type: "playbook_full" }, select: { payload: true } });
  const done = new Set(told.map((t) => (t.payload as { cohortId?: number } | null)?.cohortId));
  return full.filter((c) => !done.has(c.id)).map((c) => {
    const next = cohorts.find((x) => x.program === c.program && x.startsAt > c.startsAt);
    return {
      playbook: "full" as const,
      summary: `Cohorte pleine : ${cohortTitle(c)}`,
      email: {
        to: env.ADMIN_EMAIL,
        subject: `Cohorte pleine : ${cohortTitle(c)}`,
        text: [
          "Bonjour Ben,",
          "",
          `Les ${c.capacity} places de ${cohortTitle(c)} sont payées. Les playbooks n’écrivent plus aux prospects pour cette cohorte.`,
          "",
          next ? `La suivante : ${cohortTitle(next)}, démarrage le ${longDate(next.startsAt)} (${next.status === "open" ? "inscriptions ouvertes" : "inscriptions pas encore ouvertes"}) : ${base()}/admin/cohortes/${next.id}` : `Aucune cohorte suivante pour ce programme : créez-la pour que les prochains inscrits aient une date : ${base()}/admin/cohortes`,
        ].join("\n"),
      },
      log: { type: "playbook_full", leadId: null, payload: { cohortId: c.id } },
    };
  });
}

/* ---------- Fin de cohorte ---------- */

export async function planWrapup(now: Date): Promise<Step[]> {
  const cohorts = await prisma.cohort.findMany({
    where: { endsAt: { gte: new Date(now.getTime() - (WRAPUP_AFTER_DAYS + 7) * DAY_MS), lte: new Date(now.getTime() - WRAPUP_AFTER_DAYS * DAY_MS) } },
    select: { id: true, program: true, name: true, registrations: { where: { status: "paid" }, select: { lead: { select: { firstName: true, lastName: true, whatsapp: true } } } } },
  });
  if (!cohorts.length) return [];
  const told = await prisma.actionLog.findMany({ where: { type: "playbook_wrapup" }, select: { payload: true } });
  const done = new Set(told.map((t) => (t.payload as { cohortId?: number } | null)?.cohortId));
  return cohorts.filter((c) => !done.has(c.id) && c.registrations.length).map((c) => {
    const ia = c.program === "ia";
    const lines = c.registrations.map(({ lead }) => {
      const text = ia
        ? `Bonjour ${lead.firstName}, merci d’avoir suivi le Bâtisseur IA. Accepteriez-vous d’écrire quelques lignes sur ce que vous avez construit ? Rien n’est publié sans votre accord écrit. Et si quelqu’un autour de vous pourrait en profiter, n’hésitez pas à lui en parler.`
        : `Bonjour ${lead.firstName}, merci d’avoir suivi le bootcamp. Accepteriez-vous d’écrire quelques lignes sur votre préparation ? Je ne publie rien sans votre accord écrit. Et si un collègue prépare aussi sa certification, n’hésitez pas à lui en parler.`;
      return `• ${lead.firstName} ${lead.lastName}${lead.whatsapp ? ` : ${waMeLink(lead.whatsapp, text)}` : " (pas de WhatsApp : par e-mail)"}`;
    });
    return {
      playbook: "wrapup" as const,
      summary: `Fin de cohorte : ${cohortTitle(c)}, ${plural(c.registrations.length, "participant")}`,
      email: {
        to: env.ADMIN_EMAIL,
        subject: `Fin de cohorte : témoignages et recommandations · ${cohortTitle(c)}`,
        text: [
          "Bonjour Ben,",
          "",
          `${cohortTitle(c)} s’est terminée il y a une semaine. Le bon moment pour demander un témoignage et une recommandation, un message prêt pour chaque participant :`,
          "",
          ...lines,
          "",
          `Les témoignages reçus s’ajoutent dans ${base()}/admin/temoignages, avec l’accord écrit.`,
        ].join("\n"),
      },
      log: { type: "playbook_wrapup", leadId: null, payload: { cohortId: c.id } },
    };
  });
}
