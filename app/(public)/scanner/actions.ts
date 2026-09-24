"use server";

import { z } from "zod";

import { analyseProfile, prospectAxes } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { nextFollowupAt } from "@/lib/followups";
import { sendEmail } from "@/lib/messaging/email";
import { formatAdmissionDeadline, formatCohortMonth } from "@/lib/cohorts";
import { resolveTierCode } from "@/lib/pricing";
import { draftSalesMessage } from "@/lib/scanner/ai-message";
import { recommendedProgram } from "@/lib/programs";
import { loadScannerContext, priceLabelFor } from "@/lib/scanner/context";
import { answersSchema } from "@/lib/scoring";
import { createToken } from "@/lib/tokens";
import { recordServerEvent } from "@/lib/tracking/server";

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(180),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Numéro WhatsApp au format international, ex. +221771234567")
    .max(32)
    .optional()
    .or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  goals: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Must be literally true: an unchecked box never reaches the server as consent. */
  consent: z.literal(true, {
    errorMap: () => ({ message: "Votre accord est nécessaire pour recevoir votre analyse." }),
  }),
});

const submissionSchema = z.object({
  answers: answersSchema,
  contact: contactSchema,
  utm: z
    .object({
      source: z.string().max(120).optional(),
      medium: z.string().max(120).optional(),
      campaign: z.string().max(120).optional(),
      content: z.string().max(120).optional(),
      term: z.string().max(120).optional(),
    })
    .optional(),
});

export type SubmissionInput = z.input<typeof submissionSchema>;

export type SubmissionResult =
  | { ok: true; resultToken: string }
  | { ok: false; errors: Record<string, string> };

/**
 * Records the questionnaire and returns the result token: the prospect sees
 * their analysis right away (Ben's decision, 21/09/2026), receives it by
 * e-mail, and Ben is notified.
 *
 * The verdict comes from the rules, never from the model. What the model
 * drafts is the follow-up sales message Ben validates in the admin — and it
 * is drafted after the prospect has been answered, so a slow or failing API
 * never delays the result.
 */
export async function submitScanner(raw: SubmissionInput): Promise<SubmissionResult> {
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".")] = issue.message;
    return { ok: false, errors };
  }

  const { answers, contact, utm } = parsed.data;
  const context = await loadScannerContext();
  const tier = resolveTierCode(answers.country, context.tiers);
  const analysis = analyseProfile(answers);
  const consentAt = new Date();
  const resultToken = createToken();
  // Scanner without a call → J+2 (SPECS A6). A "pas encore" lead is parked in nurture instead.
  const followup = analysis.readiness === "not_yet" ? null : nextFollowupAt("scanner", 0, consentAt);

  // A placeholder until the AI draft lands; the admin shows it as "en cours".
  const placeholder = "Rédaction du message en cours…";

  const { lead, response } = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.upsert({
      where: { email: contact.email },
      create: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        whatsapp: contact.whatsapp || null,
        country: answers.country,
        tier,
        readiness: analysis.readiness,
        heatScore: analysis.heatScore,
        jobTitle: contact.jobTitle || null,
        goals: contact.goals || null,
        consentAt,
        source: "scanner",
        utmSource: utm?.source,
        utmMedium: utm?.medium,
        utmCampaign: utm?.campaign,
        utmContent: utm?.content,
        utmTerm: utm?.term,
        unsubscribeToken: createToken(),
        status: analysis.readiness === "not_yet" ? "nurture" : "new",
        nextFollowupAt: followup,
        followupCount: 0,
      },
      update: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        whatsapp: contact.whatsapp || null,
        country: answers.country,
        tier,
        readiness: analysis.readiness,
        heatScore: analysis.heatScore,
        jobTitle: contact.jobTitle || null,
        goals: contact.goals || null,
        consentAt,
        unsubscribedAt: null,
        nextFollowupAt: followup,
        followupCount: 0,
      },
    });

    const response = await tx.scannerResponse.create({
      data: {
        leadId: lead.id,
        answers,
        readiness: analysis.readiness,
        heatScore: analysis.heatScore,
        analysis: JSON.parse(JSON.stringify(analysis)),
        coachMessage: placeholder,
        resultToken,
      },
    });

    await tx.actionLog.create({
      data: { leadId: lead.id, type: "scanner_submitted", payload: { readiness: analysis.readiness, heatScore: analysis.heatScore } },
    });

    return { lead, response };
  });

  await recordServerEvent({
    name: "scanner_submit",
    leadId: lead.id,
    label: analysis.readiness,
    country: answers.country,
    utm: utm ? { source: utm.source, medium: utm.medium, campaign: utm.campaign } : null,
  });

  const resultUrl = `${env.NEXT_PUBLIC_APP_URL}/scanner/resultat/${resultToken}`;
  const axes = prospectAxes(analysis.axes);

  // 1. The prospect gets the result by e-mail, in parallel with seeing it on screen.
  const prospectEmail = sendEmail({
    to: lead.email,
    subject: `${contact.firstName}, votre analyse CISSP`,
    text:
      `Bonjour ${contact.firstName},\n\n` +
      `${analysis.headline}\n\n` +
      axes.map((a) => `• ${a.label} : ${a.detail}`).join("\n") +
      `\n\nDélai réaliste jusqu'à l'examen : ${analysis.timeline.label} accompagné, ${analysis.timeline.soloLabel} seul.\n\n` +
      `Votre analyse complète : ${resultUrl}\n\n` +
      (examBootEnabled()
        ? `Envie de vérifier ? Cinq vraies questions d'examen, corrigées, en dix minutes : ${env.NEXT_PUBLIC_APP_URL}/test-cissp?t=${resultToken}&from=email-resultat\n\n`
        : "") +
      (context.cohort && analysis.readiness !== "not_yet"
        ? `Prix promotionnel de lancement : ${priceLabelFor(answers.country, context.tiers)}, garanti jusqu'au ${formatAdmissionDeadline(context.cohort.startsAt)} (fin des admissions de la cohorte de ${formatCohortMonth(context.cohort.startsAt)}).\n\n`
        : analysis.readiness === "not_yet"
          ? recommendedProgram(analysis.readiness, answers) === "cc"
            ? `La marche qui vous convient maintenant : la certification CC d'ISC², sans prérequis, préparée en 15 jours avec moi. Votre première certification, dans la maison du CISSP : ${env.NEXT_PUBLIC_APP_URL}/demarrer?t=${resultToken}\nEt si vous préférez d'abord en parler, une heure de conseil : ${env.NEXT_PUBLIC_APP_URL}/conseil?t=${resultToken}\n\n`
            : `La marche qui vous convient maintenant : une heure de conseil carrière avec moi, pour choisir la voie et la première certification, avec un plan écrit. Déduite du bootcamp si vous le rejoignez dans les 90 jours : ${env.NEXT_PUBLIC_APP_URL}/conseil?t=${resultToken}\n\n`
          : "") +
      `Je reviens vers vous personnellement sous 24 h.\n\nBen\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${lead.unsubscribeToken}`,
  });

  // 2. Ben is notified: the sales funnel starts here.
  const coachEmail = sendEmail({
    to: env.ADMIN_EMAIL,
    subject: `Nouveau profil : ${contact.firstName} ${contact.lastName} — ${readinessLabel(analysis.readiness)}, chaleur ${analysis.heatScore}`,
    text:
      `${contact.firstName} ${contact.lastName} (${answers.country}${contact.jobTitle ? `, ${contact.jobTitle}` : ""}) vient d'analyser son profil.\n\n` +
      `Verdict : ${readinessLabel(analysis.readiness)}\nChaleur : ${analysis.heatScore}/100\nDélai : ${analysis.timeline.label}\n` +
      (contact.goals ? `\nSes objectifs : « ${contact.goals} »\n` : "") +
      `\nValider le message de relance : ${env.NEXT_PUBLIC_APP_URL}/admin/diagnostics/${response.id}`,
  });

  await Promise.allSettled([prospectEmail, coachEmail]);

  // 3. The sales draft, last: it must never hold the prospect's result.
  const draft = await draftSalesMessage({
    firstName: contact.firstName,
    jobTitle: contact.jobTitle || null,
    goals: contact.goals || null,
    answers,
    analysis,
    cohort: context.cohort,
    priceLabel: priceLabelFor(answers.country, context.tiers),
  });
  await prisma.scannerResponse.update({ where: { id: response.id }, data: { coachMessage: draft.text } });
  await prisma.actionLog.create({
    data: { leadId: lead.id, type: "sales_message_drafted", payload: { source: draft.source } },
  });

  return { ok: true, resultToken };
}

function readinessLabel(readiness: "ready" | "conditional" | "not_yet"): string {
  return readiness === "ready" ? "Prêt" : readiness === "conditional" ? "Prêt sous conditions" : "Pas encore";
}
