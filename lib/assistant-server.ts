import { randomBytes } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";

import { aiBudgetGate, recordAiUsage } from "@/lib/ai-usage-server";
import { publicCohortSummary } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { automationRuns } from "@/lib/guardrails";
import { loadGuardrails } from "@/lib/guardrails-server";
import { IA_FAQ } from "@/lib/ia-landing";
import { iaUrl } from "@/lib/ia-domain";
import { sendEmail } from "@/lib/messaging/email";
import { PROGRAMS } from "@/lib/programs";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import {
  ANSWER_JSON_SCHEMA,
  ASSISTANT_MODEL,
  type AssistantProgram,
  CONVERSATION_DAYS,
  MAX_TURNS,
  type Source,
  type Turn,
  answerSchema,
  buildKnowledge,
  capState,
  citedSources,
  hashIp,
  systemPrompt,
} from "./assistant";

/**
 * Lot C · the site assistant at work: one visitor message in, one sourced
 * answer out, the transcript kept server-side. Stops with the guardrails
 * (switch, general stop, AI budget) and hands over to Ben instead.
 */

export type AssistantReply =
  | { ok: true; conversationId: string; answer: string; links: Array<{ title: string; url: string }>; handOver: boolean; remaining: number }
  | { ok: false; conversationId: string | null; handOver: true; reason: "off" | "budget" | "limit" | "error" };

async function knowledge(): Promise<Source[]> {
  const app = env.NEXT_PUBLIC_APP_URL;
  const [settings, cissp, ia] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    publicCohortSummary("cissp").catch(() => null),
    publicCohortSummary("ia").catch(() => null),
  ]);
  return buildKnowledge({
    appUrl: app,
    iaUrl: iaUrl("/ia", app),
    cisspFaq: settings.faq,
    iaFaq: IA_FAQ,
    programs: Object.values(PROGRAMS).map((p) => ({ code: p.code, name: p.name, productLine: p.productLine })),
    cohorts: [
      ...(cissp ? [{ program: "cissp", name: cissp.name, startsAt: cissp.startsAt, remaining: cissp.gauge.remaining, capacity: cissp.gauge.capacity }] : []),
      ...(ia ? [{ program: "ia", name: ia.name, startsAt: ia.startsAt, remaining: ia.gauge.remaining, capacity: ia.gauge.capacity }] : []),
    ],
  });
}

const today = (now: Date) => now.toISOString().slice(0, 10);

export async function askAssistant(input: { conversationId: string | null; message: string; program: AssistantProgram; ip: string }, now = new Date()): Promise<AssistantReply> {
  const g = await loadGuardrails();
  if (!automationRuns(g, "assistant")) return { ok: false, conversationId: input.conversationId, handOver: true, reason: "off" };

  const ipHash = hashIp(input.ip, env.AUTH_SECRET, today(now));
  let conversation = input.conversationId ? await prisma.assistantConversation.findUnique({ where: { id: input.conversationId } }) : null;
  const dayStart = new Date(`${today(now)}T00:00:00Z`);
  const todayForIp = (await prisma.assistantConversation.aggregate({ where: { ipHash, updatedAt: { gte: dayStart } }, _sum: { turns: true } }))._sum.turns ?? 0;
  if (capState(conversation?.turns ?? 0, todayForIp) !== "ok") return { ok: false, conversationId: conversation?.id ?? null, handOver: true, reason: "limit" };

  const gate = await aiBudgetGate("assistant", now);
  if (!gate.ok) return { ok: false, conversationId: conversation?.id ?? null, handOver: true, reason: "budget" };

  if (!conversation) {
    conversation = await prisma.assistantConversation.create({ data: { id: randomBytes(12).toString("hex"), program: input.program, ipHash, turns: 0, transcript: [] } });
  }
  const history = (Array.isArray(conversation.transcript) ? (conversation.transcript as Turn[]) : []).slice(-12);
  const sources = await knowledge();

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 1200,
      system: [{ type: "text", text: systemPrompt(sources), cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: { type: "json_schema", schema: ANSWER_JSON_SCHEMA } },
      messages: [
        ...history.map((t) => ({ role: t.role, content: t.text })),
        { role: "user" as const, content: `(Page visitée : ${input.program === "ia" ? "Bâtisseur IA" : "CISSP Bootcamp"})\n${input.message}` },
      ],
    });
    await recordAiUsage("assistant", response, now);
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") throw new Error(`stop ${response.stop_reason}`);
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const parsed = answerSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("unreadable answer");
    const { links, escalate } = citedSources(parsed.data, sources);
    const turns = conversation.turns + 1;
    await prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { turns, transcript: [...history, { role: "user", text: input.message }, { role: "assistant", text: parsed.data.answer }] },
    });
    return { ok: true, conversationId: conversation.id, answer: parsed.data.answer, links, handOver: escalate, remaining: Math.max(0, MAX_TURNS - turns) };
  } catch (error) {
    console.error("[assistant]", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return { ok: false, conversationId: conversation.id, handOver: true, reason: "error" };
  }
}

/** The visitor leaves an e-mail for Ben to answer: explicit consent, one e-mail to Ben. */
export async function handOverQuestion(input: { conversationId: string | null; email: string; question: string }, now = new Date()): Promise<{ ok: true }> {
  const conversation = input.conversationId ? await prisma.assistantConversation.findUnique({ where: { id: input.conversationId }, select: { id: true, transcript: true } }) : null;
  const q = await prisma.siteQuestion.create({ data: { conversationId: conversation?.id ?? null, email: input.email, question: input.question, consentAt: now } });
  const transcript = Array.isArray(conversation?.transcript) ? (conversation!.transcript as Turn[]) : [];
  await sendEmail({
    to: env.ADMIN_EMAIL,
    replyTo: input.email,
    subject: "Question d’un visiteur du site",
    text:
      `${input.email} demande :\n\n${input.question}\n\n` +
      (transcript.length ? `Échange avec l’assistant :\n${transcript.map((t) => `${t.role === "user" ? "Visiteur" : "Assistant"} : ${t.text}`).join("\n")}\n\n` : "") +
      `Répondez directement à cet e-mail, puis marquez la question « répondue » : ${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/admin#questions (n° ${q.id}).`,
  }).catch((error) => console.error("[assistant] e-mail", error));
  return { ok: true };
}

/** Conversations older than 30 days are deleted (the cron, every run). */
export async function purgeConversations(now = new Date()): Promise<number> {
  const { count } = await prisma.assistantConversation.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - CONVERSATION_DAYS * 86_400_000) } } });
  return count;
}
