import { z } from "zod";

import { PAYMENT_MODES, confirmBalance, confirmRegistrationPayment, confirmServiceOrder, deleteCohortCore, deleteLeadCore, publishPostNow, registerDirect, remindSessionBookingCore, sendCohortDocuments, sendDiagnosis, sendLeadEmail, setDiagnosisAside, setPrice } from "@/lib/admin-ops/sensitive";
import type { OpResult } from "@/lib/admin-ops/leads";
import { sendRemainingSessions } from "@/lib/cohort-sessions-send";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/mcp/oauth";
import { sendCatchUp } from "@/lib/playbooks/catchup";

/**
 * Lot 3 of the MCP plug (docs/MCP.md): Claude prepares a sensitive action,
 * Ben reads it in the admin and clicks "Valider"; only then does it run,
 * through the same code as the admin's own button. A request runs once, is
 * re-checked when it runs, and lapses after a week.
 */

export const REQUEST_TTL_DAYS = 7;
const id = z.number().int().positive();

export const PAYLOADS = {
  payment: z.object({ target: z.enum(["registration", "balance", "consulting"]), id, note: z.string().trim().max(200).optional() }),
  registration: z.object({ leadId: id, cohortId: id, amountUsd: z.number().min(0).max(100_000), paymentMode: z.enum(PAYMENT_MODES), paymentDetail: z.string().trim().max(150).optional(), notify: z.boolean(), onboard: z.boolean() }),
  diagnosis: z.object({ scannerResponseId: id, decision: z.enum(["send", "set_aside"]), message: z.string().trim().min(20).max(5000).optional() }),
  email: z.object({ type: z.enum(["followup", "session_reminder"]), leadId: id.optional(), orderId: id.optional(), subject: z.string().trim().min(3).max(160).optional(), text: z.string().trim().min(20).max(5000).optional() }),
  catch_up: z.object({ cohortId: id }),
  // The text Ben read: a post edited after the request is not published.
  linkedin: z.object({ postId: id, imageId: id.optional(), textSha: z.string().length(64) }),
  cohort_send: z.object({ cohortId: id, what: z.enum(["documents", "sessions"]) }),
  price: z.object({ program: z.enum(["cissp", "cc", "ia"]), tier: z.string().min(1).max(32), amountUsd: z.number().min(0).max(100_000) }),
  deletion: z.object({ target: z.enum(["lead", "cohort"]), id, moveToCohortId: id.optional() }),
} as const;

export type RequestKind = keyof typeof PAYLOADS;
export const REQUEST_KINDS = Object.keys(PAYLOADS) as RequestKind[];

export const KIND_LABEL: Record<RequestKind, string> = {
  payment: "Confirmer un paiement",
  registration: "Inscription directe",
  diagnosis: "Analyse à envoyer",
  email: "E-mail à un prospect",
  catch_up: "Rattrapage d’une cohorte",
  linkedin: "Publication LinkedIn immédiate",
  cohort_send: "Envoi aux inscrits d’une cohorte",
  price: "Changement de prix",
  deletion: "Suppression",
};

/** Runs a validated request through the shared code. */
async function execute(kind: RequestKind, raw: unknown, now: Date): Promise<OpResult> {
  switch (kind) {
    case "payment": {
      const p = PAYLOADS.payment.parse(raw);
      if (p.target === "registration") return confirmRegistrationPayment(p.id, p.note, now);
      if (p.target === "balance") return confirmBalance(p.id, p.note, now);
      return confirmServiceOrder(p.id, p.note, now);
    }
    case "registration": {
      const p = PAYLOADS.registration.parse(raw);
      return registerDirect({ ...p, amountUsdCents: Math.round(p.amountUsd * 100) });
    }
    case "diagnosis": {
      const p = PAYLOADS.diagnosis.parse(raw);
      return p.decision === "send" ? sendDiagnosis(p.scannerResponseId, p.message, now) : setDiagnosisAside(p.scannerResponseId, now);
    }
    case "email": {
      const p = PAYLOADS.email.parse(raw);
      if (p.type === "session_reminder") return p.orderId ? remindSessionBookingCore(p.orderId) : { ok: false, error: "orderId manquant." };
      if (!p.leadId || !p.subject || !p.text) return { ok: false, error: "Destinataire, objet et message requis." };
      return sendLeadEmail(p.leadId, p.subject, p.text);
    }
    case "catch_up": {
      const out = await sendCatchUp(PAYLOADS.catch_up.parse(raw).cohortId, now);
      if ("error" in out) return { ok: false, error: out.error };
      if (out.sent === 0 && out.failed > 0) return { ok: false, error: `${out.failed} e-mail(s) en échec.` };
      return { ok: true, message: `${out.sent} e-mail(s) envoyé(s)${out.failed ? `, ${out.failed} en échec` : ""}${out.remaining ? `, ${out.remaining} à envoyer au prochain rattrapage` : ""}.` };
    }
    case "linkedin": {
      const p = PAYLOADS.linkedin.parse(raw);
      const post = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { text: true } });
      if (post && sha256(post.text) !== p.textSha) return { ok: false, error: "Le post a changé depuis la demande : rien n’a été publié. Demandez à Claude de la refaire." };
      return publishPostNow(p.postId, p.imageId ? { imageId: p.imageId } : null);
    }
    case "cohort_send": {
      const p = PAYLOADS.cohort_send.parse(raw);
      if (p.what === "documents") return sendCohortDocuments(p.cohortId);
      return sendRemainingSessions(p.cohortId, now);
    }
    case "price": {
      const p = PAYLOADS.price.parse(raw);
      return setPrice({ program: p.program, tier: p.tier, amountUsdCents: Math.round(p.amountUsd * 100) });
    }
    case "deletion": {
      const p = PAYLOADS.deletion.parse(raw);
      if (p.target === "lead") return deleteLeadCore(p.id);
      return deleteCohortCore({ cohortId: p.id, targetId: p.moveToCohortId ?? null, acknowledged: true }, now);
    }
  }
}

export async function createRequest(kind: RequestKind, payload: unknown, summary: string, clientName: string, now = new Date()) {
  const data = PAYLOADS[kind].parse(payload);
  const row = await prisma.mcpRequest.create({
    data: { kind, payload: data as object, summary, clientName, expiresAt: new Date(now.getTime() + REQUEST_TTL_DAYS * 86_400_000) },
    select: { id: true, expiresAt: true },
  });
  return row;
}

/**
 * Ben's click. The request is claimed atomically (pending and not lapsed),
 * so a double click or a second tab cannot run it twice.
 */
export async function decideRequest(requestId: number, approve: boolean, now = new Date()): Promise<OpResult> {
  const claimed = await prisma.mcpRequest.updateMany({ where: { id: requestId, status: "pending", expiresAt: { gt: now } }, data: { status: approve ? "running" : "rejected", decidedAt: now } });
  if (claimed.count === 0) return { ok: false, error: "Demande déjà traitée ou expirée." };
  if (!approve) return { ok: true, message: "Demande refusée : rien n’a été fait." };
  const row = await prisma.mcpRequest.findUnique({ where: { id: requestId }, select: { kind: true, payload: true } });
  let result: OpResult;
  try {
    result = row && (REQUEST_KINDS as string[]).includes(row.kind) ? await execute(row.kind as RequestKind, row.payload, now) : { ok: false, error: "Type de demande inconnu." };
  } catch (error) {
    console.error("[mcp] request", requestId, error);
    result = { ok: false, error: "L’action a échoué côté serveur." };
  }
  await prisma.mcpRequest.update({ where: { id: requestId }, data: { status: result.ok ? "done" : "failed", result: result.ok ? result.message : result.error } });
  await prisma.actionLog.create({ data: { type: "mcp_request_decided", payload: { requestId, kind: row?.kind ?? null, ok: result.ok } } });
  return result;
}

/** Lapsed requests leave the queue on their own. */
export async function expireRequests(now = new Date()): Promise<number> {
  const out = await prisma.mcpRequest.updateMany({ where: { status: "pending", expiresAt: { lte: now } }, data: { status: "expired" } });
  return out.count;
}
