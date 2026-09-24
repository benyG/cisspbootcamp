"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { StripeNotConfiguredError, createCheckoutSession } from "@/lib/payments/stripe";
import { resolveTierCode } from "@/lib/pricing";
import { PROGRAMS } from "@/lib/programs";
import { startRegistration } from "@/lib/registration";
import { COUNTRIES } from "@/lib/scanner/questions";
import { createToken } from "@/lib/tokens";
import { recordServerEvent } from "@/lib/tracking/server";

/**
 * Registration to the CC course (docs/OFFRES.md §3). Unlike the bootcamp,
 * no call and no validated diagnosis stand in the way: the prospect is known
 * through a scanner token, or captured here with explicit consent, then pays.
 */

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

async function resolveLead(data: z.infer<typeof contactSchema>): Promise<{ leadId: number } | Fail> {
  if (data.t && data.t.length >= 10) {
    const response = await prisma.scannerResponse.findUnique({ where: { resultToken: data.t }, select: { leadId: true } });
    if (response) return { leadId: response.leadId };
  }
  if (!data.firstName || !data.lastName || !data.email) return { ok: false, error: "Prénom, nom et e-mail sont nécessaires." };
  if (!data.pays) return { ok: false, error: "Choisissez votre pays." };
  if (data.consent !== "on") return { ok: false, error: "Votre accord est nécessaire pour vous inscrire." };

  const tiers = await prisma.pricingTier.findMany({ select: { code: true, countries: true } });
  const tier = resolveTierCode(data.pays, tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })));
  const lead = await prisma.lead.upsert({
    where: { email: data.email },
    create: { firstName: data.firstName, lastName: data.lastName, email: data.email, whatsapp: data.whatsapp || null, country: data.pays, tier, consentAt: new Date(), source: "demarrer", unsubscribeToken: createToken() },
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

function backUrl(formData: FormData, extra: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const key of ["pays", "t"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/demarrer/inscription?${params.toString()}`;
}

const NO_COHORT = "Aucune session CC n'est ouverte à l'inscription pour le moment.";

export async function payProgramByCard(formData: FormData): Promise<void> {
  const parsed = parseContact(formData);
  const fail = (error: string): never => redirect(backUrl(formData, { erreur: error }));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");

  const resolved = await resolveLead(parsed.data);
  if ("ok" in resolved) return fail(resolved.error);

  await recordServerEvent({ name: "pay_click", leadId: resolved.leadId, label: "cc:stripe" });
  const started = await startRegistration({ leadId: resolved.leadId, method: "stripe", program: "cc" });
  if (!started.registration) return fail(started.reason === "no_cohort" ? NO_COHORT : "Ce programme n'est pas disponible pour votre pays.");
  const { registration, offer } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: resolved.leadId } });

  let checkout;
  try {
    checkout = await createCheckoutSession({
      reference: registration.reference,
      registrationId: registration.id,
      amountUsdCents: registration.amountUsd,
      productName: `${PROGRAMS.cc.productName} — ${offer.cohort.name}`,
      description: PROGRAMS.cc.productLine,
      customerEmail: lead.email,
      successUrl: `${env.NEXT_PUBLIC_APP_URL}/inscription/merci?ref=${registration.reference}`,
      cancelUrl: `${env.NEXT_PUBLIC_APP_URL}${backUrl(formData, { annule: "1" })}`,
    });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return fail("Le paiement par carte n'est pas encore activé.");
    console.error("[demarrer] Stripe", error);
    return fail("Impossible d'ouvrir le paiement. Réessayez dans un instant.");
  }
  await prisma.registration.update({ where: { id: registration.id }, data: { stripeSessionId: checkout.id } });
  redirect(checkout.url);
}

const mobileSchema = z.object({
  operator: z.enum(["mtn", "orange"]),
  phone: z.string().trim().regex(/^[26]\d{8}$/, "Numéro mobile money à 9 chiffres, ex. 677123456"),
});

export async function payProgramByMobileMoney(formData: FormData): Promise<void> {
  const parsed = parseContact(formData);
  const fail = (error: string): never => redirect(backUrl(formData, { erreur: error }));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const mobile = mobileSchema.safeParse({ operator: formData.get("operator"), phone: formData.get("phone") });
  if (!mobile.success) return fail(mobile.error.issues[0]?.message ?? "Données invalides.");

  const resolved = await resolveLead(parsed.data);
  if ("ok" in resolved) return fail(resolved.error);

  const { createMobilePayment, checkTransaction, fallbackUrl, NetticketNotConfiguredError } = await import("@/lib/payments/netticket");
  const { markRegistrationPaid } = await import("@/lib/registration");

  await recordServerEvent({ name: "pay_click", leadId: resolved.leadId, label: "cc:netticket" });
  const started = await startRegistration({ leadId: resolved.leadId, method: "netticket", program: "cc" });
  if (!started.registration) return fail(started.reason === "no_cohort" ? NO_COHORT : "Ce programme n'est pas disponible pour votre pays.");
  const { registration, offer } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: resolved.leadId } });

  if (!process.env.NETTICKET_API_KEY) {
    const url = fallbackUrl(registration.reference);
    if (!url) return fail("Le paiement mobile n'est pas encore activé.");
    await prisma.registration.update({ where: { id: registration.id }, data: { status: "pending_manual" } });
    redirect(url);
  }
  if (!offer.netticketTicketCode) return fail("Le paiement mobile n'est pas disponible pour ce programme dans votre pays. Utilisez la carte bancaire.");

  let result;
  try {
    result = await createMobilePayment({ email: lead.email, phone: mobile.data.phone, ticketCode: offer.netticketTicketCode, operator: mobile.data.operator, name: `${lead.firstName} ${lead.lastName}` });
  } catch (error) {
    if (error instanceof NetticketNotConfiguredError) return fail("Le paiement mobile n'est pas encore activé.");
    console.error("[demarrer] Netticket", error);
    return fail("Impossible de lancer le paiement mobile. Réessayez dans un instant.");
  }
  if (result.status === "failed") return fail(`Paiement refusé : ${result.message}`);
  if (result.transactionId) await prisma.registration.update({ where: { id: registration.id }, data: { netticketTransactionId: result.transactionId } });
  if (result.status === "success" && result.transactionId && (await checkTransaction(result.transactionId)) === "successful") {
    await markRegistrationPaid({ reference: registration.reference, amountPaidUsdCents: registration.amountUsd, paidAt: new Date(), netticketTransactionId: result.transactionId });
  }
  redirect(`/inscription/merci?ref=${registration.reference}&mobile=1`);
}
