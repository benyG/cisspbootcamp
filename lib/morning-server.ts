import { loadQueue } from "@/lib/action-queue";
import { aiSpendThisMonth } from "@/lib/ai-usage-server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadGuardrails } from "@/lib/guardrails-server";
import { sendEmail } from "@/lib/messaging/email";

import { morningDigest, morningDue } from "./morning";

const KEY = "morning_digest";
const DAY_MS = 86_400_000;

/** The morning e-mail, once a day (lot D). Quiet days send nothing. */
export async function sendMorningDigest(now = new Date()): Promise<"sent" | "quiet" | "not_yet" | "failed"> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!morningDue(now, (row?.value as { day?: string } | null)?.day ?? null)) return "not_yet";
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const range = { gte: yesterday, lt: today };
  const soon = (days: number) => ({ lte: new Date(now.getTime() + days * DAY_MS) });
  const [{ items }, leads, calls, receipts, questions, deadlinesSoon, privacySoon, ai, g] = await Promise.all([
    loadQueue(now),
    prisma.lead.count({ where: { createdAt: range } }),
    prisma.actionLog.count({ where: { type: "call_booked", createdAt: range } }),
    prisma.receipt.findMany({ where: { paidAt: range }, select: { amountUsd: true } }),
    prisma.siteQuestion.count({ where: { answeredAt: null } }),
    prisma.adminDeadline.count({ where: { doneAt: null, dueAt: soon(3) } }),
    prisma.privacyRequest.count({ where: { doneAt: null, dueAt: soon(7) } }),
    aiSpendThisMonth(now),
    loadGuardrails(),
  ]);
  const todo: Record<string, number> = {};
  for (const item of items) todo[item.kind] = (todo[item.kind] ?? 0) + ("count" in item && typeof item.count === "number" ? item.count : 1);
  const digest = morningDigest({
    now,
    todo,
    yesterday: { leads, calls, payments: receipts.length, paidUsdCents: receipts.reduce((s, r) => s + r.amountUsd, 0) },
    questions,
    deadlinesSoon,
    privacySoon,
    ai: { spentUsd: ai.spentUsd, budgetUsd: ai.budgetUsd },
    stopped: g.stopped,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });
  const day = now.toISOString().slice(0, 10);
  const remember = () => prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { day } }, update: { value: { day } } });
  if (!digest) {
    await remember();
    return "quiet";
  }
  const result = await sendEmail({ to: env.ADMIN_EMAIL, ...digest });
  if (!result.sent && result.reason !== "RESEND_API_KEY manquante") return "failed";
  await remember();
  return "sent";
}
