import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ExamBootError, examBootEnabled } from "@/lib/examboot/client";
import { cisspDomains, createDomainTest, readTest } from "@/lib/examboot/v1";
import {
  type DomainChoice,
  type Kind,
  KINDS,
  MAX_QUESTIONS,
  type RecipientResult,
  domainChoices,
  parseRecipient,
  parseWebhookEvent,
  reminderDue,
  splitQuestions,
} from "@/lib/evaluations";
import { sendEmail } from "@/lib/messaging/email";
import { cohortParticipants } from "@/lib/replays-server";

/**
 * Evaluations (Ben, 14/10): Ben composes a test or a mock exam on chosen
 * CISSP domains, ExamBoot builds it and hands back one personal link per
 * participant, and the site sends the e-mail. Scores come back by webhook,
 * with the cron as a safety net.
 */

export type Result = { ok: true; message: string; id?: number } | { ok: false; error: string };

export async function loadDomains(): Promise<{ ok: true; domains: DomainChoice[] } | { ok: false; error: string }> {
  if (!examBootEnabled()) return { ok: false, error: "ExamBoot n'est pas configuré : ajoutez EXAMBOOT_API_KEY sur Vercel." };
  try {
    return { ok: true, domains: domainChoices(await cisspDomains()) };
  } catch (error) {
    console.error("[evaluations] domaines", error instanceof Error ? error.message : error);
    return { ok: false, error: "ExamBoot ne répond pas : la liste des domaines est indisponible. Réessayez dans un instant." };
  }
}

export type NewEvaluation = {
  cohortId: number;
  title: string;
  kind: Kind;
  split: "weight" | "equal" | "hand";
  total: number;
  domainIds: number[];
  perDomain: Record<number, number>;
  timer: number;
  dueAt: Date;
  remind: boolean;
  message: string;
  leadIds: number[];
};

/** Questions per chosen domain, from Ben's split choice; capped by what ExamBoot holds. */
export function questionPlan(domains: DomainChoice[], input: Pick<NewEvaluation, "split" | "total" | "domainIds" | "perDomain">): Array<DomainChoice & { questions: number }> {
  const chosen = domains.filter((d) => input.domainIds.includes(d.id));
  const counts =
    input.split === "hand"
      ? chosen.map((d) => Math.max(0, Math.min(d.cap, Math.floor(input.perDomain[d.id] ?? 0))))
      : splitQuestions(input.total, chosen.map((d) => (input.split === "equal" ? 1 : d.weight)), chosen.map((d) => d.cap));
  return chosen.map((d, i) => ({ ...d, questions: counts[i] })).filter((d) => d.questions > 0);
}

export async function createEvaluation(input: NewEvaluation, now = new Date()): Promise<Result> {
  if (input.dueAt <= now) return { ok: false, error: "La date limite doit être dans le futur." };
  const [cohort, catalog, people] = await Promise.all([
    prisma.cohort.findUnique({ where: { id: input.cohortId }, select: { id: true, name: true, program: true } }),
    loadDomains(),
    cohortParticipants(input.cohortId),
  ]);
  if (!cohort) return { ok: false, error: "Cohorte introuvable." };
  if (cohort.program !== "cissp") return { ok: false, error: "Les évaluations ExamBoot portent sur le CISSP : choisissez une cohorte CISSP." };
  if (!catalog.ok) return catalog;
  const plan = questionPlan(catalog.domains, input);
  const total = plan.reduce((a, d) => a + d.questions, 0);
  if (plan.length === 0 || total === 0) return { ok: false, error: "Choisissez au moins un domaine et un nombre de questions." };
  if (total > MAX_QUESTIONS) return { ok: false, error: `${MAX_QUESTIONS} questions au maximum.` };
  const chosen = people.filter((p) => input.leadIds.includes(p.id));
  if (chosen.length === 0) return { ok: false, error: "Choisissez au moins une personne inscrite." };

  let test: Awaited<ReturnType<typeof createDomainTest>>;
  try {
    test = await createDomainTest({
      type: input.kind,
      title: input.title,
      domains: plan.map((d) => ({ id: d.id, questions: d.questions })),
      timer: input.kind === "exam" ? input.timer || undefined : undefined,
      dueAt: input.dueAt,
      message: input.message || undefined,
      recipients: chosen.map((p) => ({ email: p.email, name: `${p.firstName} ${p.lastName}`.trim() })),
    });
  } catch (error) {
    console.error("[evaluations] création", error instanceof Error ? error.message : error);
    return { ok: false, error: error instanceof ExamBootError && error.status === 422 ? error.message : "ExamBoot n'a pas créé le test. Réessayez dans un instant." };
  }

  const byEmail = new Map(test.recipients.map((r) => [r.email, r]));
  const linked = chosen.flatMap((p) => {
    const r = byEmail.get(p.email.toLowerCase());
    return r ? [{ leadId: p.id, externalId: r.id, link: r.link }] : [];
  });
  const evaluation = await prisma.evaluation.create({
    data: {
      cohortId: cohort.id,
      title: input.title,
      kind: input.kind,
      questions: total,
      timer: input.kind === "exam" ? input.timer : 0,
      domains: plan.map((d) => ({ n: d.n, id: d.id, name: d.label, questions: d.questions })),
      message: input.message || null,
      dueAt: input.dueAt,
      remind: input.remind,
      code: test.code,
      recipients: { create: linked },
    },
  });

  let emailed = 0;
  for (const r of await prisma.evaluationRecipient.findMany({ where: { evaluationId: evaluation.id }, select: { id: true } })) {
    if ((await sendInvite(r.id, "invite")).ok) emailed++;
  }
  const missing = chosen.length - linked.length;
  return {
    ok: true,
    id: evaluation.id,
    message: `« ${input.title} » envoyé : ${emailed} e-mail(s) sur ${linked.length}${missing ? ` ; ${missing} personne(s) sans lien ExamBoot` : ""}.`,
  };
}

const longDay = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });

/** Pure: the participant's e-mail. No clock time (the date is a day). */
export function inviteEmail(input: {
  firstName: string;
  unsubscribeToken: string;
  link: string;
  reminder: boolean;
  evaluation: { title: string; kind: string; questions: number; timer: number; dueAt: Date; message: string | null; domains: unknown };
}): { subject: string; text: string } {
  const e = input.evaluation;
  const doms = (Array.isArray(e.domains) ? e.domains : []) as Array<{ n: number | null; name: string }>;
  const all = doms.length >= 8;
  const list = doms.map((d) => (d.n ? `${d.n} (${d.name})` : d.name));
  const where = all ? "les 8 domaines" : list.length === 1 ? `le domaine ${list[0]}` : `les domaines ${list.slice(0, -1).join(", ")} et ${list.at(-1)}`;
  const what = e.kind === "exam" ? `un examen blanc de ${e.questions} questions` : `un test de ${e.questions} questions`;
  const how = e.kind === "exam" ? `Il est chronométré${e.timer ? ` (${e.timer} minutes)` : ""} et sans correction pendant l'épreuve, comme le jour de l'examen.` : "Il est corrigé question par question.";
  const due = longDay(e.dueAt);
  return {
    subject: `${input.reminder ? "Rappel : " : ""}${e.title} · à faire avant le ${due}`,
    text: [
      `Bonjour ${input.firstName},`,
      "",
      input.reminder ? `Petit rappel : ${what} sur ${where} vous attend, à faire avant le ${due}.` : `Je vous ai préparé ${what} sur ${where}. ${how}`,
      ...(e.message && !input.reminder ? ["", `« ${e.message} »`] : []),
      "",
      `Commencer : ${input.link}`,
      "",
      `Ce lien est personnel : il vous identifie. Ne le transférez pas. Il reste ouvert jusqu'au ${due}.`,
      "",
      "Bonne révision,",
      "Ben",
      "",
      "—",
      `Pour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${input.unsubscribeToken}`,
    ].join("\n"),
  };
}

/** Sends (or re-sends) one person's link. Someone who unsubscribed gets nothing. */
export async function sendInvite(recipientId: number, kind: "invite" | "reminder"): Promise<Result> {
  const r = await prisma.evaluationRecipient.findUnique({
    where: { id: recipientId },
    include: { lead: { select: { id: true, firstName: true, email: true, unsubscribeToken: true, unsubscribedAt: true } }, evaluation: true },
  });
  if (!r) return { ok: false, error: "Destinataire introuvable." };
  if (r.status === "completed") return { ok: false, error: "Cette personne a déjà terminé." };
  if (r.lead.unsubscribedAt) return { ok: false, error: `${r.lead.firstName} ne reçoit plus nos e-mails (désinscription) : rien n'est envoyé.` };
  const mail = inviteEmail({ firstName: r.lead.firstName, unsubscribeToken: r.lead.unsubscribeToken, link: r.link, reminder: kind === "reminder", evaluation: r.evaluation });
  const sent = await sendEmail({ to: r.lead.email, ...mail });
  await prisma.actionLog.create({ data: { leadId: r.lead.id, type: kind === "reminder" ? "evaluation_reminded" : "evaluation_sent", channel: "email", payload: { evaluationId: r.evaluationId, sent: sent.sent } } });
  if (!sent.sent) return { ok: false, error: `L'e-mail à ${r.lead.firstName} n'est pas parti (${sent.reason}).` };
  await prisma.evaluationRecipient.update({ where: { id: r.id }, data: { emailedAt: new Date(), ...(r.status === "created" ? { status: "sent" } : {}) } });
  return { ok: true, message: `E-mail envoyé à ${r.lead.firstName}.` };
}

/** Records what ExamBoot says about one recipient; a finished result is never undone. */
async function apply(code: string, result: RecipientResult): Promise<boolean> {
  const r = await prisma.evaluationRecipient.findFirst({ where: { externalId: result.externalId, evaluation: { code } }, select: { id: true, leadId: true, status: true, evaluationId: true } });
  if (!r || r.status === "completed") return false;
  if (result.status === "completed") {
    await prisma.evaluationRecipient.update({ where: { id: r.id }, data: { status: "completed", completedAt: result.completedAt ?? new Date(), percent: result.percent, correct: result.correct, domains: result.domains ?? undefined } });
    await prisma.actionLog.create({ data: { leadId: r.leadId, type: "evaluation_completed", payload: { evaluationId: r.evaluationId, percent: result.percent } } });
    return true;
  }
  if (result.status === "started" && r.status !== "started") {
    await prisma.evaluationRecipient.update({ where: { id: r.id }, data: { status: "started" } });
  }
  return false;
}

/**
 * ExamBoot signs each webhook with HMAC-SHA256 of the raw body and the shared
 * secret (X-Webhook-Signature). Accepts hex, "sha256=<hex>" or base64.
 */
export function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const mac = createHmac("sha256", secret).update(raw, "utf8").digest();
  const given = header.trim().replace(/^sha256=/i, "");
  const candidates = [mac.toString("hex"), mac.toString("base64")];
  return candidates.some((c) => c.length === given.length && timingSafeEqual(Buffer.from(c), Buffer.from(given)));
}

export async function handleWebhook(raw: string, signature: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!validSignature(raw, signature, process.env.EXAMBOOT_WEBHOOK_SECRET ?? "")) return { status: 401, body: { error: "unauthorized" } };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }
  const event = parseWebhookEvent(json);
  if (!event) return { status: 200, body: { received: true, ignored: true } };
  return { status: 200, body: { received: true, recorded: await apply(event.test, event.result) } };
}

/** Cron: reads the open evaluations still waiting on someone, then sends the reminders. */
export async function syncEvaluations(now = new Date()): Promise<{ synced: number; completed: number; reminded: number }> {
  if (!examBootEnabled()) return { synced: 0, completed: 0, reminded: 0 };
  const open = await prisma.evaluation.findMany({
    where: { dueAt: { gt: new Date(now.getTime() - 86_400_000) }, recipients: { some: { status: { not: "completed" } } } },
    orderBy: { dueAt: "asc" },
    take: 10,
  });
  let synced = 0;
  let completed = 0;
  let reminded = 0;
  for (const e of open) {
    try {
      const test = await readTest(e.code);
      synced++;
      for (const raw of test.recipients) {
        const parsed = parseRecipient(raw);
        if (parsed && (await apply(e.code, parsed))) completed++;
      }
    } catch (error) {
      console.error("[evaluations] lecture", e.code, error instanceof Error ? error.message : error);
    }
    if (reminderDue(e, now)) {
      await prisma.evaluation.update({ where: { id: e.id }, data: { remindedAt: now } });
      const late = await prisma.evaluationRecipient.findMany({ where: { evaluationId: e.id, status: { not: "completed" } }, select: { id: true } });
      for (const r of late) if ((await sendInvite(r.id, "reminder")).ok) reminded++;
    }
  }
  return { synced, completed, reminded };
}

export { KINDS };
