import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { type IaAnswers, type IaDiagnosis, diagnose, diagnosisSummary } from "@/lib/ia-diagnostic";
import { iaAnswersSchema } from "@/lib/ia-diagnostic-schema";
import { sendEmail } from "@/lib/messaging/email";
import { resolveTierCode } from "@/lib/pricing";
import { PROGRAMS } from "@/lib/programs";
import { COUNTRIES } from "@/lib/scanner/questions";
import { createToken } from "@/lib/tokens";

/**
 * Records a Bâtisseur IA diagnostic: the person sees the result right away
 * and receives it by e-mail; Ben is told. Consent is explicit and dated
 * (CLAUDE.md, données personnelles); an existing lead keeps their name.
 */

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Votre prénom est nécessaire.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide.").max(180),
  country: z.string().length(2).refine((value) => COUNTRIES.some((c) => c.value === value), "Choisissez votre pays."),
  whatsapp: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Numéro WhatsApp au format international, ex. +221771234567").optional().or(z.literal("")),
  /** Must be literally true: an unchecked box never reaches the server as consent. */
  consent: z.literal(true, { errorMap: () => ({ message: "Votre accord est nécessaire pour recevoir votre résultat." }) }),
  /** Honeypot: people never see it, robots fill it. */
  website: z.string().max(0).optional().or(z.literal("")),
});

const utmField = z.string().trim().max(120).optional();
/** First-touch campaign of the visitor, so the studio's tracked links count diagnostics (Ben, 04/11). */
const utmSchema = z.object({ source: utmField, medium: utmField, campaign: utmField, content: utmField }).partial().optional().catch(undefined);

export const submissionSchema = z.object({ answers: iaAnswersSchema, contact: contactSchema, utm: utmSchema });
export type IaSubmission = z.input<typeof submissionSchema>;
export type IaSubmitResult = { ok: true; token: string } | { ok: false; error: string };

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
export const resultUrl = (token: string) => `${appUrl()}/ia/diagnostic/resultat/${token}`;

export function resultEmail(firstName: string, d: IaDiagnosis, token: string, unsubscribeToken: string): { subject: string; text: string } {
  return {
    subject: `Votre diagnostic d’automatisation · ${PROGRAMS.ia.name}`,
    text: [
      `Bonjour ${firstName},`,
      "",
      `Vous déclarez ${d.hoursPhrase} par semaine sur des tâches répétitives. Voici ce que votre application peut faire à votre place, dans cet ordre :`,
      "",
      ...d.priorities.map((p, i) => `${i + 1}. ${p.title} (${p.how})`),
      "",
      d.toolsNote,
      "",
      d.ready
        ? "Votre aisance avec l’ordinateur suffit pour démarrer directement à la J1."
        : "Avant la J1, une séance d’accueil d’une heure avec moi installe les outils avec vous : vous démarrez à égalité avec le groupe.",
      "",
      `Votre résultat, les journées et le prix : ${resultUrl(token)}`,
      "",
      "Ben",
      "",
      "—",
      `Pour ne plus recevoir de messages : ${appUrl()}/desinscription/${unsubscribeToken}`,
    ].join("\n"),
  };
}

export async function submitIaDiagnostic(raw: unknown, now = new Date()): Promise<IaSubmitResult> {
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Réponses incomplètes." };
  const { answers, contact, utm } = parsed.data;
  if (contact.website) return { ok: false, error: "Envoi refusé." };

  const tiers = await prisma.pricingTier.findMany({ select: { code: true, countries: true } });
  const tier = resolveTierCode(contact.country, tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })));
  const result = diagnose(answers);
  const token = createToken();

  const lead = await prisma.lead.upsert({
    where: { email: contact.email },
    create: { firstName: contact.firstName, lastName: "", email: contact.email, whatsapp: contact.whatsapp || null, country: contact.country, tier, consentAt: now, source: "ia_diagnostic", utmSource: utm?.source || null, utmMedium: utm?.medium || null, utmCampaign: utm?.campaign || null, utmContent: utm?.content || null, unsubscribeToken: createToken() },
    update: { whatsapp: contact.whatsapp || undefined, country: contact.country, tier, consentAt: now, unsubscribedAt: null },
  });
  await prisma.iaDiagnostic.create({ data: { leadId: lead.id, answers, result: JSON.parse(JSON.stringify(result)), token } });

  const mail = resultEmail(lead.firstName || contact.firstName, result, token, lead.unsubscribeToken);
  await Promise.all([
    sendEmail({ to: contact.email, ...mail }).catch(() => undefined),
    sendEmail({
      to: env.ADMIN_EMAIL,
      subject: `Diagnostic IA : ${contact.firstName}, ${result.ready ? "démarrage direct" : "séance d’accueil"}`,
      text: [`${contact.firstName} · ${contact.email}${contact.whatsapp ? ` · ${contact.whatsapp}` : ""} · ${contact.country}`, "", diagnosisSummary(answers as IaAnswers), "", `Fiche : ${appUrl()}/admin/leads/${lead.id}`].join("\n"),
    }).catch(() => undefined),
  ]);
  return { ok: true, token };
}

/** The stored diagnostic behind a result link, or null. */
export async function diagnosticByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await prisma.iaDiagnostic.findUnique({ where: { token }, include: { lead: { select: { firstName: true, country: true, tier: true } } } });
  if (!row) return null;
  const answers = iaAnswersSchema.safeParse(row.answers);
  if (!answers.success) return null;
  return { id: row.id, createdAt: row.createdAt, lead: row.lead, answers: answers.data, result: diagnose(answers.data) };
}
