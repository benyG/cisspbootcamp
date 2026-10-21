import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { ANSWER_DELAY, CERTIFICATIONS, FORMATS, HEADCOUNTS, type QuoteStatus, TIMINGS } from "@/lib/quotes-options";
import { COUNTRIES } from "@/lib/scanner/questions";

/**
 * Company quote requests (Ben, 21/10): a company asks to train a team, on
 * site or online; Ben answers himself, there is no public price.
 */

export { ANSWER_DELAY, CERTIFICATIONS, FORMATS, HEADCOUNTS, MIN_TEAM, STATUSES, TIMINGS, type QuoteStatus } from "@/lib/quotes-options";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...Array<keyof T & string>];
const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null);

export const quoteSchema = z.object({
  organization: z.string().trim().min(2, "Nom de l'entreprise requis").max(160),
  country: z.string().refine((c) => COUNTRIES.some((x) => x.value === c), "Choisissez un pays"),
  contactName: z.string().trim().min(2, "Votre nom est requis").max(120),
  jobTitle: optional(120),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(180),
  phone: z.string().trim().max(40).regex(/^[+\d][\d\s().-]{5,39}$/, "Numéro invalide").optional().or(z.literal("")).transform((v) => v || null),
  certification: z.enum(keys(CERTIFICATIONS)),
  format: z.enum(keys(FORMATS)),
  headcount: z.enum(keys(HEADCOUNTS)),
  timing: z.enum(keys(TIMINGS)),
  need: optional(2000),
  /** Must be literally true: an unchecked box never reaches the server as consent. */
  consent: z.literal(true, { errorMap: () => ({ message: "Votre accord est nécessaire pour que Ben vous réponde." }) }),
  /** Honeypot: hidden from people, filled by bots. */
  website: z.string().max(0).optional().or(z.literal("")),
});
export type QuoteInput = z.input<typeof quoteSchema>;

export const countryLabel = (code: string) => COUNTRIES.find((c) => c.value === code)?.label ?? code;

type Quote = z.output<typeof quoteSchema>;

/** Pure: the one-line summary used in both e-mails and the admin list. */
export function quoteSummary(q: Pick<Quote, "certification" | "format" | "headcount" | "timing">): string {
  return `${CERTIFICATIONS[q.certification]} · ${FORMATS[q.format].toLowerCase()} · ${HEADCOUNTS[q.headcount]} personnes · ${TIMINGS[q.timing].toLowerCase()}`;
}

export type SubmitResult = { ok: true } | { ok: false; error: string; field?: string };

export async function submitQuote(raw: unknown, now = new Date()): Promise<SubmitResult> {
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // A filled honeypot looks like success to the bot and stores nothing.
    if (issue?.path[0] === "website") return { ok: true };
    return { ok: false, error: issue?.message ?? "Données invalides.", field: String(issue?.path[0] ?? "") };
  }
  const d = parsed.data;
  const q = { organization: d.organization, country: d.country, contactName: d.contactName, jobTitle: d.jobTitle, email: d.email, phone: d.phone, certification: d.certification, format: d.format, headcount: d.headcount, timing: d.timing, need: d.need };
  const saved = await prisma.quoteRequest.create({ data: { ...q, consentAt: now } });
  const summary = quoteSummary(q);
  await Promise.all([
    sendEmail({
      to: env.ADMIN_EMAIL,
      subject: `Nouvelle demande de devis : ${q.organization}, ${HEADCOUNTS[q.headcount]} personnes, ${CERTIFICATIONS[q.certification]}`,
      text: [
        `${q.contactName}${q.jobTitle ? ` (${q.jobTitle})` : ""}, ${q.organization}, ${countryLabel(q.country)}`,
        `${q.email}${q.phone ? ` · ${q.phone}` : ""}`,
        "",
        summary,
        ...(q.need ? ["", q.need] : []),
        "",
        `Voir la demande : ${env.NEXT_PUBLIC_APP_URL}/admin/devis?id=${saved.id}`,
      ].join("\n"),
    }),
    sendEmail({
      to: q.email,
      subject: "Votre demande de devis · CISSP Bootcamp",
      text: [
        `Bonjour ${q.contactName},`,
        "",
        `Merci pour votre demande pour ${q.organization}. Je vous réponds sous ${ANSWER_DELAY}, à cette adresse.`,
        "",
        `Votre demande : ${summary}.`,
        ...(q.need ? ["", `« ${q.need} »`] : []),
        "",
        "Ben",
        "Coach CISSP",
      ].join("\n"),
    }),
  ]);
  return { ok: true };
}

export async function setQuoteStatus(id: number, status: QuoteStatus, note: string | null): Promise<void> {
  await prisma.quoteRequest.update({ where: { id }, data: { status, note } });
}

export async function deleteQuote(id: number): Promise<void> {
  await prisma.quoteRequest.delete({ where: { id } });
}
