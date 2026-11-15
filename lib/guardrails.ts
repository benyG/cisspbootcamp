import { z } from "zod";

/**
 * Guardrails of the autonomous business (lot A, Ben 15/11): what the
 * Bâtisseur IA teaches in J4 and J6, applied to our own app. A global stop,
 * one switch per automation, the pressure cap and the AI budget, all in one
 * SiteSetting so /admin/garde-fous reads and writes them in one place.
 * Pure: no database here (lib/guardrails-server.ts loads and saves).
 */

export const GUARDRAILS_KEY = "guardrails";

/**
 * Every automation the cron runs on its own. `global`: the general stop
 * suspends it. The Monday report only writes to Ben, so it keeps running
 * while everything else is stopped: he still sees where things stand.
 * Not listed, and never stopped: payment confirmations, seat holds expiring,
 * cohort statuses, exchange rates, video and test syncs, receipt numbering. Stopping them would
 * leave seats blocked or payments unconfirmed.
 */
export const AUTOMATIONS = {
  bookingReminders: { label: "Rappels de rendez-vous", detail: "24 h et 1 h avant un appel réservé", global: true },
  sessionReminders: { label: "Rappels de séances", detail: "Séances live des cohortes CISSP et CC", global: true },
  personalReminders: { label: "Rappels du plan de révision", detail: "Le planning personnel de chaque participant", global: true },
  iaParticipants: { label: "Bâtisseur IA : invitations et rappels", detail: "Invitations Google et rappels des journées", global: true },
  balanceReminders: { label: "Rappels de solde", detail: "Paiement en deux fois : J-7 et J-2 avant l’échéance", global: true },
  resultReminders: { label: "Relance après une analyse", detail: "Un e-mail quand une analyse n’a pas mené à un appel", global: true },
  replays: { label: "Replays", detail: "Copie des enregistrements et annonce aux participants", global: true },
  evaluations: { label: "Évaluations de fin de cohorte", detail: "Demande d’avis aux participants", global: true },
  playbooks: { label: "Playbooks", detail: "Chacun garde aussi son propre mode dans Playbooks", global: true },
  scheduledPosts: { label: "Publications programmées", detail: "Publication sur LinkedIn à la date choisie", global: true },
  assistant: { label: "Assistant du site (IA)", detail: "Répond aux visiteurs à partir de la FAQ ; arrêté, il propose de laisser la question par e-mail", global: true },
  content: { label: "Rythme de contenu (IA)", detail: "Brouillons de publications de la semaine", global: true },
  analyst: { label: "Analyste de la semaine (IA)", detail: "Analyse du dimanche pour le rapport du lundi", global: true },
  mondayReport: { label: "Rapport du lundi", detail: "Vous seul le recevez : il continue pendant l’arrêt général", global: false },
  morningDigest: { label: "E-mail du matin", detail: "Ce qui est à faire aujourd’hui et le bilan d’hier : pour vous seul", global: false },
  watch: { label: "Veille du marché (IA)", detail: "Le dimanche, concurrents et nouveautés, pour le rapport du lundi", global: true },
  adminReminders: { label: "Rappels administratifs", detail: "Échéances et demandes sur les données, à J-15 et J-3 : pour vous seul", global: false },
} as const;

export type AutomationKey = keyof typeof AUTOMATIONS;
export const AUTOMATION_KEYS = Object.keys(AUTOMATIONS) as AutomationKey[];

/** Default AI budget (Ben, 15/11) and pressure cap (two automatic messages a week, as the playbooks had). */
export const DEFAULT_AI_BUDGET_USD = 30;
export const DEFAULT_PRESSURE_PER_WEEK = 2;

export type Guardrails = {
  stopped: boolean;
  stoppedAt: string | null;
  off: AutomationKey[];
  aiBudgetUsd: number;
  pressurePerWeek: number;
};

export const DEFAULT_GUARDRAILS: Guardrails = { stopped: false, stoppedAt: null, off: [], aiBudgetUsd: DEFAULT_AI_BUDGET_USD, pressurePerWeek: DEFAULT_PRESSURE_PER_WEEK };

const storedSchema = z.object({
  stopped: z.boolean().catch(false),
  stoppedAt: z.string().nullable().catch(null),
  off: z.array(z.string()).catch([]).transform((keys) => keys.filter((k): k is AutomationKey => k in AUTOMATIONS)),
  aiBudgetUsd: z.number().min(0).max(10_000).catch(DEFAULT_AI_BUDGET_USD),
  pressurePerWeek: z.number().int().min(1).max(7).catch(DEFAULT_PRESSURE_PER_WEEK),
});

/** Whatever is stored, a complete and valid set of guardrails. */
export function resolveGuardrails(raw: unknown): Guardrails {
  const parsed = storedSchema.safeParse({ ...DEFAULT_GUARDRAILS, ...(raw && typeof raw === "object" ? raw : {}) });
  return parsed.success ? parsed.data : { ...DEFAULT_GUARDRAILS };
}

/** True when the cron may run this automation now. */
export function automationRuns(g: Guardrails, key: AutomationKey): boolean {
  if (g.off.includes(key)) return false;
  return !(g.stopped && AUTOMATIONS[key].global);
}

/** Why an automation does not run, for the cron's answer and the page. */
export function automationState(g: Guardrails, key: AutomationKey): "on" | "off" | "stopped" {
  if (g.off.includes(key)) return "off";
  return g.stopped && AUTOMATIONS[key].global ? "stopped" : "on";
}

const WEEK_MS = 7 * 86_400_000;

/**
 * The pressure cap: true when the person already had `perWeek` automatic
 * messages in the last seven days, all automations together.
 */
export function pressureReached(recent: readonly Date[], now: Date, perWeek: number): boolean {
  const since = now.getTime() - WEEK_MS;
  return recent.filter((d) => d.getTime() > since && d.getTime() <= now.getTime()).length >= perWeek;
}
