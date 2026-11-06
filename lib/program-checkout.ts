import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { StripeNotConfiguredError, createCheckoutSession } from "@/lib/payments/stripe";
import { resolveTierCode } from "@/lib/pricing";
import { PROGRAMS, type PricedProgram } from "@/lib/programs";
import { firstDueUsd } from "@/lib/installments";
import { startRegistration } from "@/lib/registration";
import { COUNTRIES } from "@/lib/scanner/questions";
import { createToken } from "@/lib/tokens";
import { recordServerEvent } from "@/lib/tracking/server";

/**
 * Card and mobile money checkout for the programmes sold without a call
 * (the CC course on /demarrer, Bâtisseur IA on /ia): the prospect is known
 * through a token, or captured on the form with explicit consent, then pays.
 * The seat is only ever marked paid by the webhook or a server-side check.
 */

export type CheckoutOptions = {
  program: PricedProgram;
  /** Registration page path, without query string: "/demarrer/inscription". */
  page: string;
  /** Lead behind a result token, or null. */
  leadFromToken: (token: string) => Promise<number | null>;
  /** Lead source for a new lead. */
  source: string;
  /** Cohort the person picked (Bâtisseur IA entry); default: the next open one. */
  cohortId?: number;
  noCohort: string;
  /** Site the person pays from, for Stripe's return links: the IA domain for Bâtisseur IA (lib/ia-domain.ts). */
  origin?: string;
};

const countryCode = z.string().length(2).refine((value) => COUNTRIES.some((c) => c.value === value), "Pays inconnu");

const contactSchema = z.object({
  t: z.string().max(200).optional().or(z.literal("")),
  pays: countryCode.optional().or(z.literal("")),
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(180).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(32).optional().or(z.literal("")),
  consent: z.string().optional(),
});

type Fail = { ok: false; error: string };

async function resolveLead(data: z.infer<typeof contactSchema>, opts: CheckoutOptions): Promise<{ leadId: number } | Fail> {
  if (data.t && data.t.length >= 10) {
    const leadId = await opts.leadFromToken(data.t);
    if (leadId) return { leadId };
  }
  if (!data.firstName || !data.lastName || !data.email) return { ok: false, error: "Prénom, nom et e-mail sont nécessaires." };
  if (!data.pays) return { ok: false, error: "Choisissez votre pays." };
  if (data.consent !== "on") return { ok: false, error: "Votre accord est nécessaire pour vous inscrire." };

  const tiers = await prisma.pricingTier.findMany({ select: { code: true, countries: true } });
  const tier = resolveTierCode(data.pays, tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })));
  const lead = await prisma.lead.upsert({
    where: { email: data.email },
    create: { firstName: data.firstName, lastName: data.lastName, email: data.email, whatsapp: data.whatsapp || null, country: data.pays, tier, consentAt: new Date(), source: opts.source, unsubscribeToken: createToken() },
    update: { firstName: data.firstName, lastName: data.lastName, whatsapp: data.whatsapp || undefined, country: data.pays, tier, consentAt: new Date(), unsubscribedAt: null },
  });
  return { leadId: lead.id };
}

function parseContact(formData: FormData) {
  return contactSchema.safeParse({
    t: formData.get("t") ?? "",
    pays: formData.get("pays") ?? "",
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    consent: formData.get("consent") ?? undefined,
  });
}

export function backUrl(formData: FormData, page: string, extra: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const key of ["pays", "t", "entree", "code"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `${page}?${params.toString()}`;
}

const unavailable = "Ce programme n'est pas disponible pour votre pays.";
const noTwoPayments = "Le paiement en deux fois n'est plus proposé pour ce tarif : choisissez le paiement en une fois.";

/** "two" on the form: payment in two instalments (lib/installments.ts). */
export const wantsTwoPayments = (formData: FormData) => formData.get("plan") === "two";

function startFailure(reason: string, noCohort: string): string {
  return reason === "no_cohort" ? noCohort : reason === "no_two_payments" ? noTwoPayments : unavailable;
}

export async function programCardCheckout(formData: FormData, opts: CheckoutOptions): Promise<never> {
  const parsed = parseContact(formData);
  const fail = (error: string): never => redirect(backUrl(formData, opts.page, { erreur: error }));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");

  const resolved = await resolveLead(parsed.data, opts);
  if ("ok" in resolved) return fail(resolved.error);

  const program = PROGRAMS[opts.program];
  await recordServerEvent({ name: "pay_click", leadId: resolved.leadId, label: `${opts.program}:stripe` });
  const started = await startRegistration({ leadId: resolved.leadId, method: "stripe", program: opts.program, cohortId: opts.cohortId, twoPayments: wantsTwoPayments(formData), promoCode: (formData.get("code") as string | null) || null });
  if (!started.registration) return fail(startFailure(started.reason, opts.noCohort));
  const { registration, offer } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: resolved.leadId } });

  let checkout;
  try {
    checkout = await createCheckoutSession({
      reference: registration.reference,
      registrationId: registration.id,
      amountUsdCents: firstDueUsd(registration),
      productName: `${program.productName} — ${offer.cohort.name}${registration.balanceUsd > 0 ? " · premier versement" : ""}`,
      description: program.productLine,
      customerEmail: lead.email,
      successUrl: `${opts.origin ?? env.NEXT_PUBLIC_APP_URL}/inscription/merci?ref=${registration.reference}`,
      cancelUrl: `${opts.origin ?? env.NEXT_PUBLIC_APP_URL}${backUrl(formData, opts.page, { annule: "1" })}`,
    });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return fail("Le paiement par carte n'est pas encore activé.");
    console.error(`[${opts.program}] Stripe`, error);
    return fail("Impossible d'ouvrir le paiement. Réessayez dans un instant.");
  }
  await prisma.registration.update({ where: { id: registration.id }, data: { stripeSessionId: checkout.id } });
  redirect(checkout.url);
}

const mobileSchema = z.object({
  operator: z.enum(["mtn", "orange"]),
  phone: z.string().trim().regex(/^[26]\d{8}$/, "Numéro mobile money à 9 chiffres, ex. 677123456"),
});

export async function programMobileCheckout(formData: FormData, opts: CheckoutOptions): Promise<never> {
  const parsed = parseContact(formData);
  const fail = (error: string): never => redirect(backUrl(formData, opts.page, { erreur: error }));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const mobile = mobileSchema.safeParse({ operator: formData.get("operator"), phone: formData.get("phone") });
  if (!mobile.success) return fail(mobile.error.issues[0]?.message ?? "Données invalides.");

  const resolved = await resolveLead(parsed.data, opts);
  if ("ok" in resolved) return fail(resolved.error);

  const { createMobilePayment, checkTransaction, fallbackUrl, NetticketNotConfiguredError } = await import("@/lib/payments/netticket");
  const { markRegistrationPaid } = await import("@/lib/registration");

  await recordServerEvent({ name: "pay_click", leadId: resolved.leadId, label: `${opts.program}:netticket` });
  const started = await startRegistration({ leadId: resolved.leadId, method: "netticket", program: opts.program, cohortId: opts.cohortId, twoPayments: wantsTwoPayments(formData) });
  if (!started.registration) return fail(startFailure(started.reason, opts.noCohort));
  const { registration, checkout } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: resolved.leadId } });

  if (!process.env.NETTICKET_API_KEY) {
    const url = fallbackUrl(registration.reference);
    if (!url) return fail("Le paiement mobile n'est pas encore activé.");
    await prisma.registration.update({ where: { id: registration.id }, data: { status: "pending_manual" } });
    redirect(url);
  }
  if (!checkout.netticketTicketCode) return fail("Le paiement mobile n'est pas disponible pour ce programme dans votre pays. Utilisez la carte bancaire.");

  let result;
  try {
    result = await createMobilePayment({ email: lead.email, phone: mobile.data.phone, ticketCode: checkout.netticketTicketCode, operator: mobile.data.operator, name: `${lead.firstName} ${lead.lastName}`.trim() });
  } catch (error) {
    if (error instanceof NetticketNotConfiguredError) return fail("Le paiement mobile n'est pas encore activé.");
    console.error(`[${opts.program}] Netticket`, error);
    return fail("Impossible de lancer le paiement mobile. Réessayez dans un instant.");
  }
  if (result.status === "failed") return fail(`Paiement refusé : ${result.message}`);
  if (result.transactionId) await prisma.registration.update({ where: { id: registration.id }, data: { netticketTransactionId: result.transactionId } });
  if (result.status === "success" && result.transactionId && (await checkTransaction(result.transactionId)) === "successful") {
    await markRegistrationPaid({ reference: registration.reference, amountPaidUsdCents: firstDueUsd(registration), paidAt: new Date(), netticketTransactionId: result.transactionId });
  }
  redirect(`/inscription/merci?ref=${registration.reference}&mobile=1`);
}
