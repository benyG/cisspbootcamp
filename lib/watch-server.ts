import Anthropic from "@anthropic-ai/sdk";

import { aiBudgetGate, recordAiUsage } from "@/lib/ai-usage-server";
import { analystWeekKey } from "@/lib/analyst/rules";
import { prisma } from "@/lib/db";
import { MARKETING_MODEL } from "@/lib/marketing/ai";

import { WATCH_SYSTEM, type WatchItem, parseWatch } from "./watch";

const DAY_MS = 86_400_000;

/**
 * Runs the market watch on Sundays, once per week (actions_log
 * "market_watch", keyed by the Monday it feeds). Never throws.
 */
export async function runWatch(now = new Date()): Promise<"not_today" | "already" | "budget" | "done" | "failed"> {
  if (now.getUTCDay() !== 0) return "not_today";
  const week = analystWeekKey(now);
  const done = await prisma.actionLog.findFirst({ where: { type: "market_watch", payload: { path: "$.week", equals: week } }, select: { id: true } }).catch(() => null);
  if (done) return "already";
  const gate = await aiBudgetGate("watch", now);
  if (!gate.ok) return "budget";
  try {
    const client = new Anthropic();
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `Nous sommes le ${now.toISOString().slice(0, 10)}. Fais la veille de la semaine.` }];
    let text = "";
    const urls = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const response = await client.beta.messages.create({
        model: MARKETING_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: WATCH_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        output_config: { effort: "low" },
        messages,
      });
      await recordAiUsage("watch", response, now);
      for (const block of response.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) for (const r of block.content) if (r.type === "web_search_result") urls.add(r.url);
        if (block.type === "text") text += block.text;
      }
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    const items = parseWatch(text, urls);
    await prisma.actionLog.create({ data: { type: "market_watch", leadId: null, payload: { week, items } } });
    return "done";
  } catch (error) {
    console.error("[watch]", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return "failed";
  }
}

/** The watch that feeds this Monday's report, if it ran. */
export async function latestWatch(now = new Date()): Promise<WatchItem[]> {
  try {
    const row = await prisma.actionLog.findFirst({ where: { type: "market_watch", createdAt: { gte: new Date(now.getTime() - 8 * DAY_MS) } }, orderBy: { createdAt: "desc" }, select: { payload: true } });
    const items = (row?.payload as { items?: WatchItem[] } | null)?.items;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
