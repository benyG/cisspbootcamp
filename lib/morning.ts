/**
 * The morning e-mail (lot D): the day's to-do and yesterday in a few lines,
 * so Ben knows in ten seconds whether he needs to open the admin. Pure.
 */

/** Queue kinds (lib/action-queue.ts) in Ben's words, singular / plural. */
export const TODO_LABELS: Record<string, [string, string]> = {
  mcp: ["demande de Claude à valider", "demandes de Claude à valider"],
  review: ["message de relance à valider", "messages de relance à valider"],
  call: ["appel aujourd’hui", "appels aujourd’hui"],
  payment: ["paiement à confirmer", "paiements à confirmer"],
  balance: ["solde à suivre", "soldes à suivre"],
  unfinished: ["inscription non finalisée", "inscriptions non finalisées"],
  followup: ["relance à faire", "relances à faire"],
  hot: ["nouveau lead chaud", "nouveaux leads chauds"],
  hold: ["place tenue", "places tenues"],
  campaign: ["étape de campagne", "étapes de campagne"],
  analyst: ["pari de l’analyste", "paris de l’analyste"],
  drafts: ["lot de brouillons", "lots de brouillons"],
  quote: ["demande de devis", "demandes de devis"],
  session: ["séance à suivre", "séances à suivre"],
  personal: ["plan de révision", "plans de révision"],
  replay: ["replay à publier", "replays à publier"],
};

export type MorningInput = {
  now: Date;
  todo: Record<string, number>;
  yesterday: { leads: number; calls: number; payments: number; paidUsdCents: number };
  questions: number;
  deadlinesSoon: number;
  privacySoon: number;
  ai: { spentUsd: number; budgetUsd: number };
  stopped: boolean;
  appUrl: string;
};

const usd = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} USD`;
const n = (count: number, [one, many]: [string, string]) => `${count} ${count > 1 ? many : one}`;

/** Null on a quiet day: nothing to do, nothing happened. No e-mail then. */
export function morningDigest(i: MorningInput): { subject: string; text: string } | null {
  const todo = Object.entries(TODO_LABELS).filter(([k]) => (i.todo[k] ?? 0) > 0).map(([k, label]) => `• ${n(i.todo[k]!, label)}`);
  if (i.questions) todo.push(`• ${n(i.questions, ["question de visiteur", "questions de visiteurs"])}`);
  if (i.deadlinesSoon) todo.push(`• ${n(i.deadlinesSoon, ["échéance administrative dans 3 jours", "échéances administratives dans 3 jours"])}`);
  if (i.privacySoon) todo.push(`• ${n(i.privacySoon, ["demande sur les données à traiter", "demandes sur les données à traiter"])}`);
  const y = i.yesterday;
  const happened = y.leads + y.calls + y.payments > 0;
  if (!todo.length && !happened && !i.stopped) return null;

  const base = i.appUrl.replace(/\/$/, "");
  const total = todo.length;
  const subject = i.stopped ? "Ce matin : arrêt général en cours" : total ? `Ce matin : ${total} point${total > 1 ? "s" : ""} à traiter` : "Ce matin : rien à traiter";
  const pct = i.ai.budgetUsd > 0 ? Math.round((i.ai.spentUsd / i.ai.budgetUsd) * 100) : 0;
  const text = [
    "Bonjour Ben,",
    "",
    ...(i.stopped ? ["L’arrêt général est en cours : aucun message automatique ne part.", ""] : []),
    ...(todo.length ? ["Aujourd’hui :", ...todo, ""] : ["Rien à traiter aujourd’hui.", ""]),
    `Hier : ${n(y.leads, ["nouveau lead", "nouveaux leads"])}, ${n(y.calls, ["appel réservé", "appels réservés"])}, ${n(y.payments, ["paiement", "paiements"])}${y.payments ? ` (${usd(y.paidUsdCents)})` : ""}.`,
    `Budget IA du mois : ${i.ai.spentUsd.toFixed(2)} USD sur ${i.ai.budgetUsd} USD (${pct} %).`,
    "",
    `Votre file d’actions : ${base}/admin`,
  ].join("\n");
  return { subject, text };
}

/** Sent once a day, from 6 a.m. UTC (6 h à Abidjan et Dakar, 7 h à Douala). */
export const MORNING_HOUR_UTC = 6;
export function morningDue(now: Date, lastDay: string | null): boolean {
  return now.getUTCHours() >= MORNING_HOUR_UTC && lastDay !== now.toISOString().slice(0, 10);
}
