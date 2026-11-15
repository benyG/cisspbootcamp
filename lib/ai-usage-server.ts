import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadGuardrails } from "@/lib/guardrails-server";
import { sendEmail } from "@/lib/messaging/email";

import { type AiFeature, type UsageLike, AI_FEATURES, budgetMonth, costUsd, crossedLevels, monthStart } from "./ai-usage";

/**
 * The AI budget at work (lot A): every Claude call is logged with its cost
 * (actions_log "ai_usage"), and no call starts once the month's budget is
 * spent. Ben gets one e-mail at 80 % and one at 100 %.
 */

export type AiSpend = { month: string; spentUsd: number; budgetUsd: number; byFeature: Record<string, number>; calls: number };

export async function aiSpendThisMonth(now = new Date()): Promise<AiSpend> {
  const [g, rows] = await Promise.all([
    loadGuardrails(),
    (async () => {
      try {
        return await prisma.actionLog.findMany({ where: { type: "ai_usage", createdAt: { gte: monthStart(now) } }, select: { payload: true } });
      } catch {
        return [];
      }
    })(),
  ]);
  const byFeature: Record<string, number> = {};
  let spent = 0;
  for (const r of rows) {
    const p = r.payload as { feature?: string; usd?: number } | null;
    const usd = typeof p?.usd === "number" ? p.usd : 0;
    spent += usd;
    if (p?.feature) byFeature[p.feature] = (byFeature[p.feature] ?? 0) + usd;
  }
  return { month: budgetMonth(now), spentUsd: spent, budgetUsd: g.aiBudgetUsd, byFeature, calls: rows.length };
}

/** Whether an AI call may start now. The error is shown as is in the admin. */
export async function aiBudgetGate(feature: AiFeature, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const spend = await aiSpendThisMonth(now);
  if (spend.spentUsd < spend.budgetUsd) return { ok: true };
  console.warn(`[ai-budget] ${feature} blocked: ${spend.spentUsd.toFixed(2)} / ${spend.budgetUsd} USD`);
  return { ok: false, error: `Budget IA du mois atteint (${spend.spentUsd.toFixed(2)} / ${spend.budgetUsd} USD). Relevez-le dans Garde-fous ou attendez le 1er du mois.` };
}

/** Logs one response and warns Ben when it crosses 80 % or 100 % of the budget. Never throws. */
export async function recordAiUsage(feature: AiFeature, response: { model?: string; usage?: UsageLike | null }, now = new Date()): Promise<void> {
  try {
    const usd = costUsd(response.model, response.usage);
    const before = await aiSpendThisMonth(now);
    await prisma.actionLog.create({
      data: {
        type: "ai_usage",
        leadId: null,
        payload: { feature, model: response.model ?? "inconnu", usd, input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0, cacheRead: response.usage?.cache_read_input_tokens ?? 0, cacheWrite: response.usage?.cache_creation_input_tokens ?? 0, searches: response.usage?.server_tool_use?.web_search_requests ?? 0 },
      },
    });
    for (const level of crossedLevels(before.spentUsd, before.spentUsd + usd, before.budgetUsd)) {
      const month = budgetMonth(now);
      const already = await prisma.actionLog.findFirst({ where: { type: "ai_budget_alert", payload: { path: "$.key", equals: `${month}:${level}` } }, select: { id: true } });
      if (already) continue;
      await prisma.actionLog.create({ data: { type: "ai_budget_alert", leadId: null, payload: { key: `${month}:${level}`, month, level } } });
      await sendEmail({
        to: env.ADMIN_EMAIL,
        subject: level === 100 ? "Budget IA atteint : les fonctions IA sont en pause" : "Budget IA : 80 % consommés",
        text:
          `${level === 100 ? "Le budget IA du mois est atteint" : "80 % du budget IA du mois sont consommés"} : ${(before.spentUsd + usd).toFixed(2)} USD sur ${before.budgetUsd} USD (dernier appel : ${AI_FEATURES[feature]}).\n\n` +
          (level === 100 ? "Les appels IA sont bloqués jusqu'au 1er du mois. Les messages après une analyse passent au modèle écrit, sans IA.\n\n" : "") +
          `Le détail et le réglage du budget : ${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/admin/garde-fous`,
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error("[ai-usage]", error);
  }
}
