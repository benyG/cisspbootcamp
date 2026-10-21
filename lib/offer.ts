import { z } from "zod";

import { CC_DOMAINS, PROGRAMS } from "@/lib/programs";
import { CERTIFICATIONS, FORMATS, HEADCOUNTS } from "@/lib/quotes-options";
import { DOMAINS, courseModules } from "@/lib/reading-plan/data";
import { ACCESS_MONTHS } from "@/lib/replays";

/**
 * The service offer ExamBoot sends a company (Ben, 21/10): built from a
 * quote request or from scratch, edited in the admin, printed to PDF by the
 * browser. Pure: no I/O, so the editor previews it live.
 */

export const offerSchema = z.object({
  reference: z.string().trim().min(1).max(40),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validDays: z.coerce.number().int().min(1).max(365),
  organization: z.string().trim().min(1, "Nom de l'entreprise requis").max(160),
  contactName: z.string().trim().max(120),
  jobTitle: z.string().trim().max(120),
  country: z.string().trim().max(80),
  email: z.string().trim().max(180),
  program: z.enum(["cissp", "cc", "both"]),
  format: z.enum(["onsite", "online", "mixed"]),
  location: z.string().trim().max(200),
  participants: z.coerce.number().int().min(1).max(500),
  priceUsd: z.coerce.number().int().min(0).max(100_000),
  ccPriceUsd: z.coerce.number().int().min(0).max(100_000),
  schedule: z.string().trim().max(600),
  objectives: z.string().trim().max(2000),
  includeReplays: z.boolean(),
  includeEvaluations: z.boolean(),
  paymentTerms: z.string().trim().max(400),
  extraTerms: z.string().trim().max(1000),
});
export type Offer = z.infer<typeof offerSchema>;

const LOWER_BOUND: Record<string, number> = { "3-5": 3, "6-10": 6, "11-20": 11, "20+": 20 };

export const offerReference = (quoteId: number | null, today: Date) =>
  quoteId ? `EB-${today.getUTCFullYear()}-${String(quoteId).padStart(4, "0")}` : `EB-${today.toISOString().slice(0, 10).replaceAll("-", "")}`;

export const defaultSchedule = (program: Offer["program"]) =>
  program === "cc"
    ? `Calendrier à convenir ensemble : ${PROGRAMS.cc.hours}\u00a0h de sessions live.`
    : `Calendrier à convenir ensemble. Rythme de référence : ${PROGRAMS.cissp.hours}\u00a0h sur ${PROGRAMS.cissp.days} jours, 2\u00a0h en soirée en semaine et 5\u00a0h\u00a030 les samedis et dimanches.`;

/** A first draft: from the company's request when there is one. */
export function draftOffer(input: {
  quote: { id: number; organization: string; contactName: string; jobTitle: string | null; country: string; email: string; certification: string; format: string; headcount: string; need: string | null } | null;
  countryLabel: (code: string) => string;
  paymentTerms: string;
  today: Date;
}): Offer {
  const q = input.quote;
  const program = (q?.certification === "cc" || q?.certification === "both" ? q.certification : "cissp") as Offer["program"];
  return {
    reference: offerReference(q?.id ?? null, input.today),
    issuedOn: input.today.toISOString().slice(0, 10),
    validDays: 30,
    organization: q?.organization ?? "",
    contactName: q?.contactName ?? "",
    jobTitle: q?.jobTitle ?? "",
    country: q ? input.countryLabel(q.country) : "",
    email: q?.email ?? "",
    program,
    format: (q && q.format in FORMATS ? q.format : "online") as Offer["format"],
    location: "",
    participants: q ? LOWER_BOUND[q.headcount] ?? 3 : 6,
    priceUsd: 0,
    ccPriceUsd: 0,
    schedule: defaultSchedule(program),
    objectives: q?.need ?? "",
    includeReplays: true,
    includeEvaluations: true,
    paymentTerms: input.paymentTerms,
    extraTerms: "",
  };
}

export type OfferLine = { label: string; participants: number; unitUsd: number; totalUsd: number };

/** The price table: one line per programme, in whole USD. */
export function offerLines(o: Pick<Offer, "program" | "participants" | "priceUsd" | "ccPriceUsd">): { lines: OfferLine[]; totalUsd: number } {
  const lines: OfferLine[] = [];
  if (o.program !== "cc") lines.push({ label: `${PROGRAMS.cissp.name} : ${PROGRAMS.cissp.hours} h de préparation au CISSP`, participants: o.participants, unitUsd: o.priceUsd, totalUsd: o.participants * o.priceUsd });
  if (o.program !== "cissp") lines.push({ label: `Formation CC d’ISC² : ${PROGRAMS.cc.hours} h de préparation`, participants: o.participants, unitUsd: o.ccPriceUsd, totalUsd: o.participants * o.ccPriceUsd });
  return { lines, totalUsd: lines.reduce((a, l) => a + l.totalUsd, 0) };
}

export function validUntil(o: Pick<Offer, "issuedOn" | "validDays">): Date {
  return new Date(new Date(`${o.issuedOn}T12:00:00Z`).getTime() + o.validDays * 86_400_000);
}

export const usd = (n: number) => `${n.toLocaleString("fr-FR").replace(/[\u202f\u00a0 ]/g, "\u00a0")}\u00a0USD`;
export const longDate = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** The CISSP programme by domain: modules and hours, from the reading plan. */
export function cisspProgramme(): Array<{ domain: number; name: string; weight: number; hours: number; modules: string[] }> {
  const modules = courseModules();
  return Object.entries(DOMAINS).map(([n, d]) => {
    const own = modules.filter((m) => m.domain === Number(n));
    return { domain: Number(n), name: d.name, weight: d.weight, hours: own.reduce((a, m) => a + m.hours, 0), modules: own.map((m) => m.title) };
  });
}

export const ccProgramme = () => CC_DOMAINS;

/** What the offer includes and excludes, as lines. */
export function inclusions(o: Pick<Offer, "program" | "includeReplays" | "includeEvaluations">, included: string[]): { yes: string[]; no: string[] } {
  const yes = [...included];
  if (o.includeReplays) yes.push(`Accès personnel aux enregistrements des sessions, en lecture seule, jusqu’à ${ACCESS_MONTHS} mois après la formation`);
  if (o.includeEvaluations) yes.push("Tests et examens blancs par domaine sur ExamBoot, avec un bilan des résultats par domaine");
  const no = [o.program === "cc" ? PROGRAMS.cc.receiptExamNote : PROGRAMS.cissp.receiptExamNote];
  if (o.program === "both") no.push(PROGRAMS.cc.receiptExamNote);
  return { yes, no };
}

export const PROGRAM_TITLES: Record<Offer["program"], string> = { cissp: "Formation CISSP", cc: "Formation CC d’ISC²", both: "Formations CISSP et CC d’ISC²" };
export { CERTIFICATIONS, FORMATS, HEADCOUNTS };
