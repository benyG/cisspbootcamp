import { MAX_BETS, readDecisions } from "@/lib/analyst/rules";
import { prisma } from "@/lib/db";

import type { OpResult } from "./leads";

/** The analyst's orientations (Ben, 08/11): kept, dropped or undecided; done. */

export async function setBetDecision(week: string, rank: number, status: "kept" | "dropped" | null, now = new Date()): Promise<OpResult> {
  if (!Number.isInteger(rank) || rank < 1 || rank > MAX_BETS) return { ok: false, error: `Rang de 1 à ${MAX_BETS}.` };
  const row = await prisma.analystReport.findUnique({ where: { weekKey: week }, select: { decisions: true, output: true } });
  if (!row) return { ok: false, error: "Analyse introuvable pour cette semaine." };
  const bets = (row.output as { bets?: unknown[] } | null)?.bets ?? [];
  if (rank > bets.length) return { ok: false, error: `Cette analyse n’a que ${bets.length} orientation${bets.length > 1 ? "s" : ""}.` };
  const decisions = readDecisions(row.decisions);
  if (status) decisions[String(rank)] = { status, at: now.toISOString() };
  else delete decisions[String(rank)];
  await prisma.analystReport.update({ where: { weekKey: week }, data: { decisions } });
  return { ok: true, message: status === "kept" ? "Orientation retenue : elle est dans la file d’actions." : status === "dropped" ? "Orientation écartée." : "Décision effacée." };
}

/** Admin toggle: clicking the same choice again undoes it. */
export async function toggleBetDecision(week: string, rank: number, status: "kept" | "dropped"): Promise<OpResult> {
  const row = await prisma.analystReport.findUnique({ where: { weekKey: week }, select: { decisions: true } });
  const current = row ? readDecisions(row.decisions)[String(rank)]?.status : undefined;
  return setBetDecision(week, rank, current === status ? null : status);
}

/** A kept orientation is done: it leaves the queue. */
export async function markBetDone(week: string, rank: number): Promise<OpResult> {
  await prisma.actionLog.create({ data: { type: "analyst_done", leadId: null, payload: { week, rank } } });
  return { ok: true, message: "Orientation marquée faite." };
}
