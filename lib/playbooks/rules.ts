import { z } from "zod";

/**
 * Playbooks (lot 3 of docs/PILOTAGE.md): a trigger, an action, a stop
 * condition, a measure. Pure: the rules and the guardrails, read by the
 * runner (cron), the Playbooks page and the tests. Constants are Ben's.
 */

export const PLAYBOOK_IDS = ["health", "unfinished", "late", "opening", "hot", "last_call", "full", "wrapup"] as const;
export type PlaybookId = (typeof PLAYBOOK_IDS)[number];
export const MODES = ["on", "trial", "off"] as const;
export type Mode = (typeof MODES)[number];

export const PLAYBOOKS: Record<PlaybookId, { title: string; trigger: string; action: string; defaultMode: Mode }> = {
  health: {
    title: "Santé technique",
    trigger: "Agenda Google déconnecté, envoi d’e-mails coupé, LinkedIn qui expire",
    action: "Vous alerte par e-mail, une fois par jour tant que le problème dure",
    defaultMode: "on",
  },
  unfinished: {
    title: "Inscription non finalisée",
    trigger: "Paiement commencé, non réglé depuis 24 h, admissions encore ouvertes",
    action: "Un e-mail « finalisez votre place » ; toujours rien 3 jours après : un appel dans votre file d’actions",
    // It writes to prospects: Ben switches it on after reading what it would send.
    defaultMode: "trial",
  },
  late: {
    title: "En retard sur la courbe",
    trigger: "Une cohorte a au moins une place de retard sur sa courbe cible",
    action: "Vous alerte avec un pack de rattrapage à valider, une fois par semaine par cohorte",
    defaultMode: "on",
  },
  opening: {
    title: "Ouverture",
    trigger: "La campagne d’une cohorte s’ouvre (J-60)",
    action: "Vous rappelle d’ouvrir les inscriptions si besoin ; écrit « les inscriptions sont ouvertes » aux prospects consentants du programme (6 derniers mois)",
    defaultMode: "trial",
  },
  hot: {
    title: "Prospect chaud (Bâtisseur IA)",
    trigger: "Diagnostic fait il y a 2 à 7 jours, sans inscription",
    action: "Un e-mail avec sa première automatisation conseillée et la prochaine date d’entrée (le CISSP a déjà sa relance après l’analyse de profil)",
    defaultMode: "trial",
  },
  last_call: {
    title: "Dernier appel",
    trigger: "Quelques jours avant la fermeture des admissions, s’il reste des places",
    action: "Un e-mail aux prospects engagés (3 derniers mois) avec la vraie date de fermeture et les places restantes",
    defaultMode: "trial",
  },
  full: {
    title: "Cohorte pleine",
    trigger: "Toutes les places sont payées",
    action: "Vous prévient ; les playbooks n’écrivent plus pour cette cohorte et vous indiquent la suivante",
    defaultMode: "on",
  },
  wrapup: {
    title: "Fin de cohorte",
    trigger: "7 jours après le dernier jour",
    action: "Vous envoie la liste des participants avec un message prêt : témoignage (avec accord écrit) et recommandation",
    defaultMode: "on",
  },
};

export const modesSchema = z.object(Object.fromEntries(PLAYBOOK_IDS.map((id) => [id, z.enum(MODES).optional()])) as Record<PlaybookId, z.ZodOptional<z.ZodEnum<["on", "trial", "off"]>>>);

/** Saved modes over the defaults; anything unreadable falls back to the default. */
export function resolveModes(saved: unknown): Record<PlaybookId, Mode> {
  const parsed = modesSchema.safeParse(saved ?? {});
  const values = parsed.success ? parsed.data : {};
  return Object.fromEntries(PLAYBOOK_IDS.map((id) => [id, values[id] ?? PLAYBOOKS[id].defaultMode])) as Record<PlaybookId, Mode>;
}

export const MODE_LABEL: Record<Mode, string> = { on: "Actif", trial: "Essai", off: "Arrêté" };

/* ---------- Guardrails ---------- */

/** At most one automatic message to a prospect every this many days, all playbooks and automatic e-mails together. */
export const PRESSURE_DAYS = 4;
/** Logged types that are automatic messages to a prospect (actions_log.type). */
export const AUTO_MESSAGE_TYPES = ["playbook_unfinished", "playbook_opening", "playbook_hot", "playbook_last_call", "result_reminder", "after_call_email"] as const;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** True when the person had an automatic message too recently to get another one. */
export function underPressure(lastAutoMessageAt: Date | null | undefined, now: Date): boolean {
  return !!lastAutoMessageAt && now.getTime() - lastAutoMessageAt.getTime() < PRESSURE_DAYS * DAY_MS;
}

/** The person can be written to automatically: explicit consent, not unsubscribed. */
export function mayContact(lead: { consentAt: Date | null; unsubscribedAt: Date | null }): boolean {
  return !!lead.consentAt && !lead.unsubscribedAt;
}

/* ---------- Inscription non finalisée ---------- */

/** A started checkout is followed up after this many hours… */
export const UNFINISHED_AFTER_HOURS = 24;
/** …and no longer after this many days (it has gone cold; the queue has it). */
export const UNFINISHED_MAX_DAYS = 7;
/** Still unpaid this many days after the e-mail: a call in Ben's queue. */
export const UNFINISHED_CALL_AFTER_DAYS = 3;

/** The registration is in the window for the "finalisez votre place" e-mail. */
export function unfinishedDue(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= UNFINISHED_AFTER_HOURS * HOUR_MS && age <= UNFINISHED_MAX_DAYS * DAY_MS;
}

/** The e-mail went out long enough ago, unanswered: time for a call. */
export function unfinishedCallDue(emailedAt: Date, now: Date): boolean {
  return now.getTime() - emailedAt.getTime() >= UNFINISHED_CALL_AFTER_DAYS * DAY_MS;
}

/* ---------- Santé technique ---------- */

/** The same problem is announced again after this many hours if it lasts. */
export const HEALTH_REPEAT_HOURS = 24;
/** LinkedIn is flagged this many days before its token expires. */
export const LINKEDIN_WARN_DAYS = 7;

export type HealthProblem = { code: "calendar" | "email" | "linkedin"; text: string; fix: string };

export function healthProblems(input: { calendar: "ok" | "not_connected" | "revoked" | "unreachable"; emailConfigured: boolean; linkedinExpiresAt: Date | null }, now: Date, appUrl: string): HealthProblem[] {
  const base = appUrl.replace(/\/$/, "");
  const out: HealthProblem[] = [];
  if (input.calendar !== "ok") {
    const what = input.calendar === "revoked" ? "Google a déconnecté votre agenda" : input.calendar === "not_connected" ? "L’agenda Google n’est pas connecté" : "L’agenda Google ne répond pas";
    out.push({ code: "calendar", text: `${what} : la prise de rendez-vous est fermée sur le site.`, fix: `${base}/admin/parametres/google` });
  }
  if (!input.emailConfigured) out.push({ code: "email", text: "L’envoi d’e-mails n’est pas configuré : aucun e-mail ne part.", fix: `${base}/admin` });
  if (input.linkedinExpiresAt && input.linkedinExpiresAt.getTime() - now.getTime() < LINKEDIN_WARN_DAYS * DAY_MS) {
    const expired = input.linkedinExpiresAt.getTime() <= now.getTime();
    out.push({ code: "linkedin", text: expired ? "La connexion LinkedIn a expiré : plus de publication depuis l’admin." : "La connexion LinkedIn expire dans moins d’une semaine.", fix: `${base}/admin/parametres/linkedin` });
  }
  return out;
}

/* ---------- En retard sur la courbe ---------- */

/** A late cohort is announced again after this many days, or sooner if it falls further behind. */
export const LATE_REPEAT_DAYS = 7;

export function lateAlertDue(last: { at: Date; behind: number } | null, behind: number, now: Date): boolean {
  if (behind <= 0) return false;
  if (!last) return true;
  return behind > last.behind || now.getTime() - last.at.getTime() >= LATE_REPEAT_DAYS * DAY_MS;
}

/** The catch-up pack: actions for Ben to validate, from real counts only. */
export function catchUpPack(input: { toFollowUp: number; alumni: number; unfinished: number }): string[] {
  const out: string[] = [];
  if (input.unfinished) out.push(`Relancer ${input.unfinished === 1 ? "la personne qui a commencé son paiement" : `les ${input.unfinished} personnes qui ont commencé leur paiement`} sans le terminer.`);
  if (input.toFollowUp) out.push(`Relancer ${input.toFollowUp === 1 ? "le prospect consentant" : `les ${input.toFollowUp} prospects consentants`} des 90 derniers jours qui ne se ${input.toFollowUp === 1 ? "est" : "sont"} pas inscrit${input.toFollowUp === 1 ? "" : "s"} (file d’actions et Marketing › Relances).`);
  out.push("Publier deux fois de plus cette semaine sur le pilier qui amène le plus d’analyses (Marketing).");
  if (input.alumni) out.push(`Demander ${input.alumni === 1 ? "à l’ancien participant" : `aux ${input.alumni} anciens participants`} de recommander la cohorte.`);
  return out;
}

/* ---------- Cycle (lot 4) ---------- */

/** Automatic e-mails to prospects per playbook and per run, at most: the rest goes the next day (the cron has a minute). */
export const MAX_PROSPECT_EMAILS_PER_RUN = 25;

/** The opening e-mail goes out from J-60 until this day, so a missed run catches up. */
export const OPENING_LAST_DAY = -50;
/** Prospects of the last this-many days hear about the opening. */
export const OPENING_LOOKBACK_DAYS = 180;
/** The hot-prospect e-mail: a diagnostic this many days old. */
export const HOT_MIN_DAYS = 2;
export const HOT_MAX_DAYS = 7;
/** The last call goes out this many days before the admissions close, until the day before it. */
export const LAST_CALL_DAYS_BEFORE_CLOSE = 4;
export const LAST_CALL_LOOKBACK_DAYS = 90;
/** The wrap-up comes this many days after the last day (and is still sent for a week after). */
export const WRAPUP_AFTER_DAYS = 7;

/** Opening window, in days from the first day. */
export function openingDue(day: number): boolean {
  return day >= -60 && day <= OPENING_LAST_DAY;
}

/** Last-call window: from 4 days before the close to the day before it. */
export function lastCallDue(day: number, closeDay: number): boolean {
  return day >= closeDay - LAST_CALL_DAYS_BEFORE_CLOSE && day < closeDay;
}

/** Which prospects belong to a programme: readiness for certifications (CC for "not yet"), the diagnostic for the IA. */
export function programOfReadiness(readiness: string | null): "cissp" | "cc" | null {
  if (readiness === "ready" || readiness === "conditional") return "cissp";
  if (readiness === "not_yet") return "cc";
  return null;
}
