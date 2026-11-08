"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { generateAnalysis } from "@/lib/analyst/server";
import { MAX_BETS, readDecisions } from "@/lib/analyst/rules";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const back = (week: string | null, message: string, ok = false): never => redirect(`/admin/analyste?${week ? `s=${week}&` : ""}${ok ? "ok" : "erreur"}=${encodeURIComponent(message)}`);
const weekField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Keeps or drops an orientation; a kept one goes to the action queue. Clicking the same choice again undoes it. */
export async function decideBet(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ week: weekField, rank: z.coerce.number().int().min(1).max(MAX_BETS), status: z.enum(["kept", "dropped"]) }).safeParse({ week: formData.get("week"), rank: formData.get("rank"), status: formData.get("status") });
  if (!parsed.success) back(null, "Choix invalide.");
  const { week, rank, status } = parsed.data!;
  const row = await prisma.analystReport.findUnique({ where: { weekKey: week }, select: { decisions: true } });
  if (!row) back(null, "Analyse introuvable.");
  const decisions = readDecisions(row!.decisions);
  const key = String(rank);
  if (decisions[key]?.status === status) delete decisions[key];
  else decisions[key] = { status, at: new Date().toISOString() };
  await prisma.analystReport.update({ where: { weekKey: week }, data: { decisions } });
  revalidatePath("/admin/analyste");
  revalidatePath("/admin");
  redirect(`/admin/analyste?s=${week}#o${rank}`);
}

/** Runs the analysis now (the Sunday run does it on its own). Starts this week's decisions over. */
export async function runAnalysisNow(): Promise<void> {
  await requireAdmin();
  const result = await generateAnalysis();
  revalidatePath("/admin/analyste");
  if (!result.ok) back(null, result.error);
  const r = result as { weekKey: string; bets: number; removed: number };
  back(r.weekKey, `Analyse faite : ${r.bets} orientation${r.bets > 1 ? "s" : ""}.${r.removed ? ` ${r.removed} chiffre${r.removed > 1 ? "s" : ""} sans source retiré${r.removed > 1 ? "s" : ""}.` : ""}`, true);
}

/** From the action queue: a kept orientation is done. */
export async function markBetDone(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ week: weekField, rank: z.coerce.number().int().min(1).max(MAX_BETS) }).safeParse({ week: formData.get("week"), rank: formData.get("rank") });
  if (!parsed.success) return;
  await prisma.actionLog.create({ data: { type: "analyst_done", leadId: null, payload: { week: parsed.data.week, rank: parsed.data.rank } } });
  revalidatePath("/admin");
}
