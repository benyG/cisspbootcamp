import { z } from "zod/v4";

import { PAYMENT_MODES } from "@/lib/admin-ops/sensitive";
import { usdCents } from "@/lib/ads";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/mcp/oauth";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";

import { type ToolContext, type ToolDef, ToolError, defineTool } from "./protocol";
import { KIND_LABEL, type RequestKind, createRequest } from "./requests";

/**
 * Lot 3 of the MCP plug (docs/MCP.md): each tool only *prepares* a sensitive
 * action. It checks what it can, writes in plain French what will happen,
 * and leaves it waiting in Admin › Prise MCP › Demandes; nothing happens
 * until Ben clicks "Valider".
 */

const fullName = (l: { firstName: string; lastName: string }) => `${l.firstName} ${l.lastName}`.trim();
const cohortName = (c: { program: string; name: string }) => `${PROGRAMS[c.program as ProgramCode]?.name ?? c.program} — ${c.name}`;
const REVIEW_URL = () => `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/admin/mcp/demandes`;

async function prepare(kind: RequestKind, payload: unknown, lines: string[], ctx: ToolContext) {
  const summary = [KIND_LABEL[kind], ...lines].join("\n");
  const row = await createRequest(kind, payload, summary, ctx.clientName, ctx.now);
  return {
    demande: row.id,
    statut: "en attente de validation par Ben",
    resume: summary,
    aValider: REVIEW_URL(),
    expire: row.expiresAt,
    rappel: "Rien n'est fait tant que Ben n'a pas cliqué « Valider ». Suivez-la avec list_requests.",
  };
}

export const requestPayment = defineTool({
  name: "request_payment_confirmation",
  title: "Préparer une confirmation de paiement",
  description: "Prépare la confirmation manuelle d'un paiement reçu hors application (virement, espèces, mobile money) : une inscription (target registration, registrationId), le solde d'un paiement en deux fois (balance, registrationId), ou une séance de conseil (consulting, orderId). note : n° de transaction ou mode. Ben valide dans l'admin ; c'est ce clic qui fait passer la place en payée.",
  level: "request",
  input: z.object({ target: z.enum(["registration", "balance", "consulting"]), id: z.number().int().positive().describe("registrationId ou orderId"), note: z.string().trim().max(200).optional() }),
  run: async (args, ctx) => {
    if (args.target === "consulting") {
      const o = await prisma.serviceOrder.findUnique({ where: { id: args.id }, include: { lead: true, service: true } });
      if (!o) throw new ToolError(`Aucune commande de conseil n°${args.id}.`);
      if (o.status === "paid") throw new ToolError("Cette commande est déjà payée.");
      return prepare("payment", args, [`${fullName(o.lead)} · ${o.service.name} · ${usdCents(o.amountUsd)} · réf. ${o.reference}`, args.note ? `Note : ${args.note}` : ""].filter(Boolean), ctx);
    }
    const r = await prisma.registration.findUnique({ where: { id: args.id }, include: { lead: true, cohort: true } });
    if (!r) throw new ToolError(`Aucune inscription n°${args.id}.`);
    if (args.target === "registration" && r.status === "paid") throw new ToolError("Cette inscription est déjà payée.");
    if (args.target === "balance" && (r.balanceUsd <= 0 || r.balancePaidAt)) throw new ToolError("Pas de solde dû sur cette inscription.");
    const amount = args.target === "balance" ? `solde de ${usdCents(r.balanceUsd)}` : `${usdCents(r.amountUsd - r.balanceUsd)}`;
    return prepare("payment", args, [`${fullName(r.lead)} · ${cohortName(r.cohort)} · ${amount} · réf. ${r.reference}`, args.note ? `Note : ${args.note}` : ""].filter(Boolean), ctx);
  },
});

export const requestRegistration = defineTool({
  name: "request_direct_registration",
  title: "Préparer une inscription directe",
  description: "Prépare l'inscription d'un prospect dans une cohorte pour un paiement reçu hors application : la place devient payée à la validation. notify envoie l'e-mail « place réservée » avec le reçu ; onboard envoie les documents de préparation.",
  level: "request",
  input: z.object({
    leadId: z.number().int().positive(),
    cohortId: z.number().int().positive(),
    amountUsd: z.number().min(0).max(100_000),
    paymentMode: z.enum(PAYMENT_MODES),
    paymentDetail: z.string().trim().max(150).optional(),
    notify: z.boolean().default(true),
    onboard: z.boolean().default(false),
  }),
  run: async (args, ctx) => {
    const [lead, cohort] = await Promise.all([prisma.lead.findUnique({ where: { id: args.leadId } }), prisma.cohort.findUnique({ where: { id: args.cohortId } })]);
    if (!lead) throw new ToolError(`Aucun prospect n°${args.leadId}.`);
    if (!cohort) throw new ToolError(`Aucune cohorte n°${args.cohortId}.`);
    return prepare("registration", args, [
      `${fullName(lead)} → ${cohortName(cohort)}`,
      `${usdCents(Math.round(args.amountUsd * 100))} · ${args.paymentMode}${args.paymentDetail ? ` · ${args.paymentDetail}` : ""}`,
      `E-mail « place réservée » : ${args.notify ? "oui" : "non"} · documents de préparation : ${args.onboard ? "oui" : "non"}`,
    ], ctx);
  },
});

export const requestDiagnosis = defineTool({
  name: "request_diagnosis_send",
  title: "Préparer l'envoi d'une analyse",
  description: "Prépare l'envoi au prospect de son analyse du scanner (decision send), avec le message du coach tel quel ou remplacé par message ; ou sa mise de côté (set_aside). Les analyses à valider sont dans action_queue (type review).",
  level: "request",
  input: z.object({ scannerResponseId: z.number().int().positive(), decision: z.enum(["send", "set_aside"]), message: z.string().trim().min(20).max(5000).optional() }),
  run: async (args, ctx) => {
    const r = await prisma.scannerResponse.findUnique({ where: { id: args.scannerResponseId }, include: { lead: true } });
    if (!r) throw new ToolError("Analyse introuvable.");
    if (args.decision === "send" && r.lead.unsubscribedAt) throw new ToolError("Ce prospect s'est désinscrit : envoi impossible.");
    if (args.decision === "set_aside") return prepare("diagnosis", args, [`Mettre de côté l'analyse de ${fullName(r.lead)} (rien n'est envoyé).`], ctx);
    const message = args.message ?? r.coachMessage;
    if (message.trim().length < 20) throw new ToolError("Le message est trop court pour être envoyé.");
    // The message Ben reads is the one sent, even if the draft changes meanwhile.
    return prepare("diagnosis", { ...args, message }, [`À ${fullName(r.lead)} <${r.lead.email}>`, "Message :", message], ctx);
  },
});

export const requestEmail = defineTool({
  name: "request_email",
  title: "Préparer un e-mail à un prospect",
  description: "Prépare un e-mail à un prospect qui a donné son accord : une relance (type followup : leadId, subject, text, par exemple issue de draft_followup), ou le rappel de réserver une séance de conseil payée (session_reminder : orderId). Le lien de désinscription est ajouté. Envoyé seulement après validation.",
  level: "request",
  input: z.object({ type: z.enum(["followup", "session_reminder"]), leadId: z.number().int().positive().optional(), orderId: z.number().int().positive().optional(), subject: z.string().trim().min(3).max(160).optional(), text: z.string().trim().min(20).max(5000).optional() }),
  run: async (args, ctx) => {
    if (args.type === "session_reminder") {
      if (!args.orderId) throw new ToolError("orderId requis.");
      const o = await prisma.serviceOrder.findUnique({ where: { id: args.orderId }, include: { lead: true, service: true } });
      if (!o) throw new ToolError(`Aucune commande de conseil n°${args.orderId}.`);
      if (o.status !== "paid") throw new ToolError("Commande non payée.");
      return prepare("email", args, [`Rappel de réserver la séance « ${o.service.name} » à ${fullName(o.lead)} <${o.lead.email}>`], ctx);
    }
    if (!args.leadId || !args.subject || !args.text) throw new ToolError("leadId, subject et text requis.");
    const lead = await prisma.lead.findUnique({ where: { id: args.leadId } });
    if (!lead) throw new ToolError(`Aucun prospect n°${args.leadId}.`);
    if (!lead.consentAt || lead.unsubscribedAt) throw new ToolError("Cette personne n'a pas accepté d'être recontactée.");
    return prepare("email", args, [`À ${fullName(lead)} <${lead.email}>`, `Objet : ${args.subject}`, "", args.text], ctx);
  },
});

export const requestCatchUp = defineTool({
  name: "request_catch_up",
  title: "Préparer un rattrapage",
  description: "Prépare le rattrapage d'une cohorte en retard (Pilotage) : les e-mails préparés partent aux prospects qui ont donné leur accord, à la validation.",
  level: "request",
  input: z.object({ cohortId: z.number().int().positive() }),
  run: async (args, ctx) => {
    const c = await prisma.cohort.findUnique({ where: { id: args.cohortId } });
    if (!c) throw new ToolError(`Aucune cohorte n°${args.cohortId}.`);
    return prepare("catch_up", args, [`${cohortName(c)} : envoyer les e-mails de rattrapage préparés (voir Admin › Pilotage › Rattrapage pour la liste).`], ctx);
  },
});

export const requestLinkedin = defineTool({
  name: "request_linkedin_publish",
  title: "Préparer une publication LinkedIn",
  description: "Prépare la publication immédiate d'un post sur le profil LinkedIn de Ben (postId, et imageId d'un visuel généré pour ce post). Pour publier un autre jour sans validation supplémentaire, utilisez plutôt schedule_post.",
  level: "request",
  input: z.object({ postId: z.number().int().positive(), imageId: z.number().int().positive().optional() }),
  run: async (args, ctx) => {
    const p = await prisma.marketingPost.findUnique({ where: { id: args.postId } });
    if (!p) throw new ToolError(`Aucun post n°${args.postId}.`);
    if (p.linkedinUrn) throw new ToolError("Ce post est déjà publié sur LinkedIn.");
    if (p.channel !== "linkedin") throw new ToolError("Ce post n'est pas un post LinkedIn.");
    return prepare("linkedin", { ...args, textSha: sha256(p.text) }, [`Post n°${p.id}${args.imageId ? ` avec le visuel n°${args.imageId}` : " sans image"}`, "", p.text], ctx);
  },
});

export const requestCohortSend = defineTool({
  name: "request_cohort_send",
  title: "Préparer un envoi aux inscrits",
  description: "Prépare un envoi aux inscrits payés d'une cohorte : documents de préparation à ceux qui ne les ont pas encore (what documents), ou invitations aux séances pas encore envoyées (sessions).",
  level: "request",
  input: z.object({ cohortId: z.number().int().positive(), what: z.enum(["documents", "sessions"]) }),
  run: async (args, ctx) => {
    const c = await prisma.cohort.findUnique({ where: { id: args.cohortId }, include: { _count: { select: { registrations: { where: { status: "paid" } } } } } });
    if (!c) throw new ToolError(`Aucune cohorte n°${args.cohortId}.`);
    return prepare("cohort_send", args, [`${cohortName(c)} (${c._count.registrations} inscrit${c._count.registrations > 1 ? "s" : ""} payé${c._count.registrations > 1 ? "s" : ""}) : ${args.what === "documents" ? "documents de préparation à ceux qui ne les ont pas encore" : "invitations aux séances pas encore envoyées"}`], ctx);
  },
});

export const requestPrice = defineTool({
  name: "request_price_change",
  title: "Préparer un changement de prix",
  description: "Prépare le changement du prix d'un programme pour un palier de pays (program cissp, cc ou ia ; tier : code du palier ; amountUsd en dollars). Seul le montant change ; le reste (codes Netticket, paiement en deux fois) se règle dans Admin › Paramètres › Prix.",
  level: "request",
  input: z.object({ program: z.enum(["cissp", "cc", "ia"]), tier: z.string().trim().min(1).max(32), amountUsd: z.number().min(0).max(100_000) }),
  run: async (args, ctx) => {
    const tier = await prisma.pricingTier.findUnique({ where: { code: args.tier } });
    if (!tier) throw new ToolError(`Palier inconnu : ${args.tier}. Paliers : ${(await prisma.pricingTier.findMany({ select: { code: true } })).map((t) => t.code).join(", ")}.`);
    const current = args.program === "cissp" ? tier.amountUsd : (await prisma.programPrice.findUnique({ where: { program_tier: { program: args.program, tier: args.tier } } }))?.amountUsd ?? null;
    return prepare("price", args, [`${PROGRAMS[args.program].name}, palier ${tier.label} (${tier.code}) : ${current === null ? "pas de prix" : usdCents(current)} → ${usdCents(Math.round(args.amountUsd * 100))}`], ctx);
  },
});

export const requestDeletion = defineTool({
  name: "request_deletion",
  title: "Préparer une suppression",
  description: "Prépare la suppression définitive d'un prospect et de toutes ses données (target lead, RGPD), ou d'une cohorte créée par erreur (target cohort) : ses inscriptions et places gardées partent d'abord vers moveToCohortId (même programme), sans rien envoyer. Irréversible une fois validé.",
  level: "request",
  input: z.object({ target: z.enum(["lead", "cohort"]), id: z.number().int().positive(), moveToCohortId: z.number().int().positive().optional() }),
  run: async (args, ctx) => {
    if (args.target === "lead") {
      const lead = await prisma.lead.findUnique({ where: { id: args.id }, include: { _count: { select: { registrations: true, bookings: true } } } });
      if (!lead) throw new ToolError(`Aucun prospect n°${args.id}.`);
      return prepare("deletion", args, [`Supprimer ${fullName(lead)} <${lead.email}> et toutes ses données (${lead._count.registrations} inscription(s), ${lead._count.bookings} rendez-vous). Irréversible.`], ctx);
    }
    const c = await prisma.cohort.findUnique({ where: { id: args.id }, include: { _count: { select: { registrations: true } } } });
    if (!c) throw new ToolError(`Aucune cohorte n°${args.id}.`);
    const target = args.moveToCohortId ? await prisma.cohort.findUnique({ where: { id: args.moveToCohortId } }) : null;
    if (args.moveToCohortId && !target) throw new ToolError(`Aucune cohorte n°${args.moveToCohortId}.`);
    if (c._count.registrations > 0 && !target) throw new ToolError("Cette cohorte a des inscriptions : donnez moveToCohortId.");
    return prepare("deletion", args, [`Supprimer la cohorte ${cohortName(c)}.`, target ? `Ses ${c._count.registrations} inscription(s) vont dans ${cohortName(target)} (personne n'est prévenu automatiquement).` : "Aucune inscription."], ctx);
  },
});

export const listRequests = defineTool({
  name: "list_requests",
  title: "Demandes en attente",
  description: "Les demandes préparées pour Ben : en attente de validation, et les dernières traitées avec leur résultat (fait, échec, refusé, expiré).",
  level: "read",
  input: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
  run: async ({ limit }) => {
    const rows = await prisma.mcpRequest.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, kind: true, summary: true, status: true, result: true, createdAt: true, decidedAt: true, expiresAt: true } });
    return { aValider: REVIEW_URL(), demandes: rows.map((r) => ({ demande: r.id, type: KIND_LABEL[r.kind as RequestKind] ?? r.kind, statut: r.status, resume: r.summary.split("\n").slice(1, 3).join(" · "), resultat: r.result, creee: r.createdAt, decidee: r.decidedAt, expire: r.expiresAt })) };
  },
});

export const REQUEST_TOOLS: readonly ToolDef[] = [requestPayment, requestRegistration, requestDiagnosis, requestEmail, requestCatchUp, requestLinkedin, requestCohortSend, requestPrice, requestDeletion, listRequests];
