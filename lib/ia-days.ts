import { zonedInstant } from "@/lib/cohort-sessions";

/**
 * Bâtisseur IA journées (Ben, 03/11/2026). Pure: the rules, shared by the
 * admin, the participant's page and the server.
 *
 * - The bootcamp is six journées, J1 to J6, taught in that order (six since
 *   Ben's programme of 05/11: communication, market and an AI agent on MCP).
 * - Each open Saturday or Sunday carries one journée. Ben opens weekends;
 *   journées follow in rotation over the open dates (J1, J2 … J6, J1 …).
 * - A participant enters on a J1 date (that date is their cohort), then
 *   picks the J2 to J6 dates they can attend, each after the last.
 * - A journée is 5 h of teaching plus a 1 h pause, from 10 h Montréal time
 *   by default, with 12 places.
 */

export const IA_ZONE = "America/Toronto";
export const IA_ZONE_LABEL = "heure de Montréal";
export const IA_JOURNEES = 6;
export const IA_TEACHING_HOURS = 5;
export const IA_PAUSE_MINUTES = 60;
export const IA_DEFAULT_START = "10:00";
export const IA_DEFAULT_CAPACITY = 12;
/** A date can be picked until this many hours before it starts. */
export const IA_PICK_LEAD_HOURS = 24;

/**
 * The six journées (Ben, 10/11: the programme of the roll-up). J1 lays the
 * ground every non-developer needs (model, prompt, context, RAG, skills,
 * agents, tools, MCP); J2 maps the business and sets the foundations; J3 to
 * J5 build the data, then the agents, then the specialised agents and their
 * interfaces; J6 puts the business under autonomous steering.
 */
export const JOURNEES: ReadonlyArray<{ n: number; title: string; text: string }> = [
  { n: 1, title: "Introduction aux composantes d’une IA", text: "Modèle, prompt, contexte, RAG, skills, agents, outils, MCP : vous comprenez chaque brique et vous l’essayez sur votre entreprise. Le soir, votre premier assistant répond à partir de vos propres documents." },
  { n: 2, title: "Identification des processus métiers et fondations architecturales", text: "Vous cartographiez vos processus (vendre, livrer, encaisser, communiquer, piloter), vous choisissez ce qui s’automatise, et vous posez les fondations avec Claude Code, GitHub et Vercel : votre vitrine est en ligne à votre nom." },
  { n: 3, title: "Structuration de l’activité et de ses données", text: "Clients, commandes, factures : vos données prennent une structure, une base, des écrans et un tableau de bord. Chaque changement est testé." },
  { n: 4, title: "Construction du système d’agents IA", text: "Des agents qui agissent : ils traitent une demande, préparent un devis, encaissent par carte ou mobile money et relancent. Vous fixez leurs règles et ce qu’ils ne font jamais sans vous." },
  { n: 5, title: "Spécialisation des agents IA et interfaces", text: "Un agent par métier : communication (publications et images à valider), veille du marché, réponses aux clients. Et les interfaces pour travailler avec eux : votre espace d’administration, l’e-mail, un assistant sur votre site." },
  { n: 6, title: "Pilotage autonome de l’entreprise", text: "Vos objectifs et leur courbe, des routines qui relancent et alertent, un rapport chaque semaine, un agent IA analyste sur vos données (MCP, lecture seule) et vos garde-fous." },
];

export type IaDay = { id: number; date: string; journee: number; capacity: number; seats: number; closed: boolean; start: string };
/** Journée number → date (YYYY-MM-DD) chosen by the participant. */
export type Picks = Partial<Record<number, string>>;

export function isWeekendDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function isJournee(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= IA_JOURNEES;
}

/** Start and end of a journée: 5 h of teaching plus the pause. */
export function journeeSlot(date: string, start = IA_DEFAULT_START): { startsAt: Date; endsAt: Date } {
  const startsAt = zonedInstant(date, start, IA_ZONE);
  return { startsAt, endsAt: new Date(startsAt.getTime() + (IA_TEACHING_HOURS * 60 + IA_PAUSE_MINUTES) * 60_000) };
}

/** Every Saturday and Sunday from `from` to `to`, inclusive (YYYY-MM-DD). */
export function weekendDates(from: string, to: string): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T12:00:00Z`).getTime();
  if (Number.isNaN(end)) return out;
  for (let d = new Date(`${from}T12:00:00Z`); !Number.isNaN(d.getTime()) && d.getTime() <= end && out.length < 400; d = new Date(d.getTime() + 86_400_000)) {
    const iso = d.toISOString().slice(0, 10);
    if (isWeekendDate(iso)) out.push(iso);
  }
  return out;
}

/**
 * Journées for new dates, continuing the rotation from the latest open date
 * before each one: J1 when nothing is open before it.
 */
export function rotateJournees(existing: ReadonlyArray<Pick<IaDay, "date" | "journee" | "closed">>, dates: ReadonlyArray<string>): Array<{ date: string; journee: number }> {
  const taken = new Set(existing.map((d) => d.date));
  const open = existing.filter((d) => !d.closed).map((d) => ({ date: d.date, journee: d.journee }));
  const out: Array<{ date: string; journee: number }> = [];
  for (const date of [...new Set(dates)].sort()) {
    if (taken.has(date)) continue;
    const before = [...open, ...out].filter((d) => d.date < date).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    out.push({ date, journee: before ? (before.journee % IA_JOURNEES) + 1 : 1 });
  }
  return out;
}

const pickable = (day: IaDay, now: Date) => !day.closed && day.seats < day.capacity && journeeSlot(day.date, day.start).startsAt.getTime() - now.getTime() >= IA_PICK_LEAD_HOURS * 3_600_000;

/** The next journée to choose, or null once the last one is chosen. */
export function nextJournee(picks: Picks): number | null {
  for (let n = 1; n <= IA_JOURNEES; n++) if (!picks[n]) return n;
  return null;
}

/** Dates the participant can pick for journée n: open, not full, after the previous journée and before the next chosen one. */
export function candidates(days: ReadonlyArray<IaDay>, picks: Picks, n: number, now: Date): IaDay[] {
  if (!isJournee(n)) return [];
  let after = "";
  for (let k = n - 1; k >= 1; k--) if (picks[k]) { after = picks[k]!; break; }
  let before = "9999-12-31";
  for (let k = n + 1; k <= IA_JOURNEES; k++) if (picks[k]) { before = picks[k]!; break; }
  return days.filter((d) => d.journee === n && d.date > after && d.date < before && pickable(d, now)).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Checks new picks against the open days before seats are taken: each
 * journée on a date that carries it, dates strictly in journée order, no
 * full or closed date, and journées already held left as they are.
 */
export function checkPicks(days: ReadonlyArray<IaDay>, held: Picks, wanted: Picks, now: Date): { ok: true; added: Array<{ journee: number; day: IaDay }> } | { ok: false; error: string } {
  const added: Array<{ journee: number; day: IaDay }> = [];
  const merged: Picks = { ...held };
  for (const [key, date] of Object.entries(wanted)) {
    const n = Number(key);
    if (!isJournee(n) || !date) return { ok: false, error: "Journée inconnue." };
    if (held[n]) {
      if (held[n] !== date) return { ok: false, error: `La J${n} est déjà réservée : elle ne change plus.` };
      continue;
    }
    const day = days.find((d) => d.date === date && d.journee === n);
    if (!day) return { ok: false, error: `Cette date ne porte pas la J${n}.` };
    if (!pickable(day, now)) return { ok: false, error: `La J${n} du ${shortDate(date)} n’est plus disponible.` };
    merged[n] = date;
    added.push({ journee: n, day });
  }
  if (!added.length) return { ok: false, error: "Choisissez au moins une journée." };
  let last = "";
  for (let n = 1; n <= IA_JOURNEES; n++) {
    const date = merged[n];
    if (!date) {
      if (Object.keys(merged).some((k) => Number(k) > n)) return { ok: false, error: `Choisissez d’abord la J${n}.` };
      continue;
    }
    if (date <= last) return { ok: false, error: "Les journées se suivent dans l’ordre, à des dates différentes." };
    last = date;
  }
  return { ok: true, added };
}

/** "samedi 23 janvier 2027" */
export function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "samedi 23 janvier" */
export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}
