"use server";

import { z } from "zod";

import { analyseProfile } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/messaging/email";
import { resolveTierCode } from "@/lib/pricing";
import { loadScannerContext } from "@/lib/scanner/context";
import { draftCoachMessage } from "@/lib/scanner/message";
import { answersSchema } from "@/lib/scoring";
import { createToken } from "@/lib/tokens";

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
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

/**
 * Records the questionnaire and queues the diagnosis for Ben's review.
 *
 * Nothing reaches the prospect here beyond an acknowledgement: the analysis
 * is computed and frozen, but its token stays inert until he approves it.
 */
export async function submitScanner(raw: SubmissionInput): Promise<SubmissionResult> {
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, errors };
  }

  const { answers, contact, utm } = parsed.data;
  const context = await loadScannerContext();
  const tier = resolveTierCode(answers.country, context.tiers);
  const analysis = analyseProfile(answers);
  const consentAt = new Date();

  const message = draftCoachMessage({
    firstName: contact.firstName,
    answers,
    analysis,
    cohort: context.cohort,
  });

  await prisma.$transaction(async (tx) => {
    // One lead per e-mail: a returning prospect updates their record rather
    // than creating a duplicate the coach would have to merge by hand.
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
      },
    });

    await tx.scannerResponse.create({
      data: {
        leadId: lead.id,
        answers,
        readiness: analysis.readiness,
        heatScore: analysis.heatScore,
        analysis: JSON.parse(JSON.stringify(analysis)),
        coachMessage: message,
        resultToken: createToken(),
      },
    });

    await tx.actionLog.create({
      data: {
        leadId: lead.id,
        type: "scanner_submitted",
        payload: { readiness: analysis.readiness, heatScore: analysis.heatScore },
      },
    });
  });

  await sendEmail({
    to: contact.email,
    subject: "Bien reçu — votre analyse arrive",
    text:
      `Bonjour ${contact.firstName},\n\n` +
      "Merci pour vos réponses. Je regarde votre profil personnellement et je vous " +
      "envoie mon analyse sous 24 heures.\n\n" +
      "Ben\nCoach CISSP",
  });

  return { ok: true };
}
