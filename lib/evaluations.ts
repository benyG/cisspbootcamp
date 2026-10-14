/**
 * Evaluations (Ben, 14/10): pure rules for the tests and mock exams Ben
 * builds on ExamBoot from chosen CISSP domains. No I/O here.
 */

/** The 8 CISSP domains, their French name and their weight in the exam (%). */
export const CISSP_DOMAINS = [
  { n: 1, name: "Sécurité et gestion des risques", weight: 16, match: /risk/i },
  { n: 2, name: "Sécurité des actifs", weight: 10, match: /asset/i },
  { n: 3, name: "Architecture et ingénierie de la sécurité", weight: 13, match: /architecture|engineering/i },
  { n: 4, name: "Sécurité des communications et des réseaux", weight: 13, match: /network|communication/i },
  { n: 5, name: "Gestion des identités et des accès", weight: 13, match: /identity|access management/i },
  { n: 6, name: "Évaluation et tests de sécurité", weight: 12, match: /assessment|testing/i },
  { n: 7, name: "Opérations de sécurité", weight: 13, match: /operations/i },
  { n: 8, name: "Sécurité du développement logiciel", weight: 10, match: /software|development/i },
] as const;

export const KINDS = { test: "Test", exam: "Examen blanc" } as const;
export type Kind = keyof typeof KINDS;
export const MAX_QUESTIONS = 250;
export const MAX_TIMER_MINUTES = 600;
/** The reminder goes to those who have not finished, this many days before the due date. */
export const REMIND_DAYS_BEFORE = 2;
/** Score colours in the admin: green from 70 %, orange from 55 %, red below. */
export const SCORE_GOOD = 70;
export const SCORE_FAIR = 55;

/** ExamBoot names the domains in English: the CISSP domain number they are, if recognised. */
export function domainNumber(name: string): number | null {
  return CISSP_DOMAINS.find((d) => d.match.test(name))?.n ?? null;
}

export type CatalogDomain = { id: number; name: string; questions: number };
export type DomainChoice = { id: number; n: number | null; label: string; weight: number; cap: number };

/** The catalogue in CISSP order, labelled in French where recognised. */
export function domainChoices(catalog: CatalogDomain[]): DomainChoice[] {
  return catalog
    .map((d) => {
      const n = domainNumber(d.name);
      const known = CISSP_DOMAINS.find((c) => c.n === n);
      return { id: d.id, n, label: known ? known.name : d.name, weight: known?.weight ?? 10, cap: Math.max(0, d.questions) };
    })
    .sort((a, b) => (a.n ?? 99) - (b.n ?? 99) || a.id - b.id);
}

/**
 * Splits `total` questions across domains in proportion to `weights`
 * (largest remainder), never giving a domain more than its cap; what a
 * full domain cannot take goes to the others.
 */
export function splitQuestions(total: number, weights: number[], caps: number[] = weights.map(() => Infinity)): number[] {
  const out = weights.map(() => 0);
  let left = Math.max(0, Math.floor(total));
  let open = weights.map((w, i) => (w > 0 && caps[i] > 0 ? i : -1)).filter((i) => i >= 0);
  while (left > 0 && open.length > 0) {
    const sum = open.reduce((a, i) => a + weights[i], 0);
    const raw = open.map((i) => (left * weights[i]) / sum);
    const base = raw.map(Math.floor);
    let rest = left - base.reduce((a, b) => a + b, 0);
    raw.map((r, k) => [r - base[k], k] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, k]) => { if (rest > 0) { base[k]++; rest--; } });
    let given = 0;
    open.forEach((i, k) => {
      const take = Math.min(base[k], caps[i] - out[i]);
      out[i] += take;
      given += take;
    });
    left -= given;
    open = open.filter((i) => out[i] < caps[i]);
    if (given === 0) break;
  }
  return out;
}

export function scoreBand(percent: number | null | undefined): "good" | "fair" | "low" | "none" {
  if (percent == null) return "none";
  return percent >= SCORE_GOOD ? "good" : percent >= SCORE_FAIR ? "fair" : "low";
}

/** The reminder is due once, in the last days before the due date, if Ben asked for it. */
export function reminderDue(e: { dueAt: Date; remind: boolean; remindedAt: Date | null }, now: Date): boolean {
  return e.remind && !e.remindedAt && now < e.dueAt && e.dueAt.getTime() - now.getTime() <= REMIND_DAYS_BEFORE * 86_400_000;
}

/** The due date Ben picks is a day: the test closes at the end of it (UTC). */
export function dueAtFromDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T23:59:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type RecipientResult = {
  externalId: number;
  email: string;
  status: "created" | "sent" | "started" | "completed";
  completedAt: Date | null;
  percent: number | null;
  correct: number | null;
  domains: Array<{ id: number; name: string; questions: number; correct: number; percent: number }> | null;
};

const int = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
};
const STATUSES = ["created", "sent", "started", "completed"] as const;

/** Pure: one recipient from GET /tests/{code}, tolerant to missing fields. */
export function parseRecipient(raw: unknown): RecipientResult | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const externalId = int(r.id, 0, Number.MAX_SAFE_INTEGER);
  if (!externalId || typeof r.email !== "string") return null;
  const result = (r.result ?? null) as Record<string, unknown> | null;
  const status = STATUSES.includes(r.status as (typeof STATUSES)[number]) ? (r.status as RecipientResult["status"]) : "created";
  const done = status === "completed" && result !== null;
  const completed = typeof r.completed_at === "string" ? new Date(r.completed_at) : null;
  return {
    externalId,
    email: r.email.toLowerCase(),
    status: done ? "completed" : status === "completed" ? "started" : status,
    completedAt: done && completed && !Number.isNaN(completed.getTime()) ? completed : null,
    percent: done ? int(result.percent, 0, 100) : null,
    correct: done ? int(result.correct, 0, 1000) : null,
    domains: done ? parseDomainScores(result.domains) : null,
  };
}

export function parseDomainScores(raw: unknown): RecipientResult["domains"] {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((d) => (d ?? {}) as Record<string, unknown>)
    .filter((d) => int(d.id, 1, Number.MAX_SAFE_INTEGER))
    .map((d) => ({ id: int(d.id, 1, Number.MAX_SAFE_INTEGER)!, name: String(d.name ?? "").slice(0, 120), questions: int(d.questions, 0, 1000) ?? 0, correct: int(d.correct, 0, 1000) ?? 0, percent: int(d.percent, 0, 100) ?? 0 }));
}

/** Pure: the `test.completed` webhook payload → the same shape. */
export function parseWebhookEvent(raw: unknown): { event: string; test: string; result: RecipientResult } | null {
  const body = (raw ?? {}) as Record<string, unknown>;
  const p = (body.payload ?? {}) as Record<string, unknown>;
  const recipient = (p.recipient ?? {}) as Record<string, unknown>;
  if (body.event !== "test.completed" || typeof p.test !== "string") return null;
  const parsed = parseRecipient({ id: recipient.id, email: recipient.email, status: "completed", completed_at: p.completed_at, result: { percent: p.score, correct: p.correct, domains: p.domains } });
  return parsed ? { event: body.event, test: p.test, result: parsed } : null;
}
