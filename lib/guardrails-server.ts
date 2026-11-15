import { prisma } from "@/lib/db";
import { AUTO_MESSAGE_TYPES } from "@/lib/playbooks/rules";

import { type AutomationKey, GUARDRAILS_KEY, type Guardrails, automationRuns, pressureReached, resolveGuardrails } from "./guardrails";

/** The guardrails as stored; the defaults when nothing is (or the database is unreachable). */
export async function loadGuardrails(): Promise<Guardrails> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: GUARDRAILS_KEY } });
    return resolveGuardrails(row?.value);
  } catch {
    return resolveGuardrails(null);
  }
}

export async function saveGuardrails(next: Guardrails): Promise<Guardrails> {
  const value = resolveGuardrails(next);
  await prisma.siteSetting.upsert({ where: { key: GUARDRAILS_KEY }, create: { key: GUARDRAILS_KEY, value }, update: { value } });
  return value;
}

/**
 * Runs one automation of the cron when its switch allows it; otherwise
 * answers "off" or "stopped" so the cron's JSON says why it did nothing.
 */
export async function guarded<T>(g: Guardrails, key: AutomationKey, run: () => Promise<T>): Promise<T | "off" | "stopped"> {
  if (!automationRuns(g, key)) return g.off.includes(key) ? "off" : "stopped";
  return run();
}

const WEEK_MS = 7 * 86_400_000;

/**
 * The people, among `leadIds`, who reached the pressure cap: as many
 * automatic messages in the last seven days as the guardrails allow per
 * week, whatever automation sent them (actions_log, AUTO_MESSAGE_TYPES).
 */
export async function leadsUnderPressure(leadIds: number[], now: Date, perWeek?: number): Promise<Set<number>> {
  if (!leadIds.length) return new Set();
  const cap = perWeek ?? (await loadGuardrails()).pressurePerWeek;
  const rows = await prisma.actionLog.findMany({
    where: { type: { in: [...AUTO_MESSAGE_TYPES] }, leadId: { in: leadIds }, createdAt: { gt: new Date(now.getTime() - WEEK_MS) } },
    select: { leadId: true, createdAt: true },
  });
  const byLead = new Map<number, Date[]>();
  for (const r of rows) if (r.leadId) byLead.set(r.leadId, [...(byLead.get(r.leadId) ?? []), r.createdAt]);
  return new Set([...byLead].filter(([, dates]) => pressureReached(dates, now, cap)).map(([id]) => id));
}
