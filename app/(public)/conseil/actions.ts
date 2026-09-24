"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { type BookResult, isSlotBookable } from "@/lib/booking";
import { type BookSessionResult, bookSession, startServiceOrder } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { clearPendingSlot, readPendingSlot, setPendingSlot } from "@/lib/pending-slot";
import { env } from "@/lib/env";
import { StripeNotConfiguredError, createCheckoutSession } from "@/lib/payments/stripe";
import { resolveTierCode } from "@/lib/pricing";
import { COUNTRIES } from "@/lib/scanner/questions";
import { type ServiceCode, isServiceCode } from "@/lib/services";
import { createToken } from "@/lib/tokens";
import { recordServerEvent } from "@/lib/tracking/server";

/**
 * Ordering a consulting service (docs/OFFRES.md §2). The prospect is either
 * known through a scanner result token, or captured here with explicit
 * consent — the same rules as the direct booking link (SPECS A3).
 */

const countryCode = z.string().length(2).refine((value) => COUNTRIES.some((c) => c.value === value), "Pays inconnu");

const contactSchema = z.object({
  code: z.string().refine(isServiceCode, "Service inconnu"),
  t: z.string().max(200).optional().or(z.literal("")),
  pays: countryCode.optional().or(z.literal("")),
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(180).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(32).optional().or(z.literal("")),
  consent: z.string().optional(),
});

export type PayResult = { ok: false; error: string };

/**
 * The lead placing the order: from the result token when there is one, else
 * created (or refreshed) from the form. Returns an error message otherwise.
 */
async function resolveLead(data: z.infer<typeof contactSchema>): Promise<{ leadId: number } | PayResult> {
  if (data.t && data.t.length >= 10) {
    const response = await prisma.scannerResponse.findUnique({ where: { resultToken: data.t }, select: { leadId: true } });
    if (response) return { leadId: response.leadId };
  }

  if (!data.firstName || !data.lastName || !data.email) return { ok: false, error: "Prénom, nom et e-mail sont nécessaires." };
  if (!data.pays) return { ok: false, error: "Choisissez votre pays." };
  if (data.consent !== "on") return { ok: false, error: "Votre accord est nécessaire pour organiser la séance." };

  const tiers = await prisma.pricingTier.findMany({ select: { code: true, countries: true } });
  const tier = resolveTierCode(data.pays, tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })));
  const lead = await prisma.lead.upsert({
    where: { email: data.email },
    create: { firstName: data.firstName, lastName: data.lastName, email: data.email, whatsapp: data.whatsapp || null, country: data.pays, tier, consentAt: new Date(), source: "conseil", unsubscribeToken: createToken() },
    update: { firstName: data.firstName, lastName: data.lastName, whatsapp: data.whatsapp || undefined, country: data.pays, tier, consentAt: new Date(), unsubscribedAt: null },
  });
  return { leadId: lead.id };
}

function backUrl(code: ServiceCode, formData: FormData, extra: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const key of ["pays", "t"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/conseil/${code}?${params.toString()}`;
}

function parseContact(formData: FormData) {
  return contactSchema.safeParse({
    code: formData.get("code"),
    t: formData.get("t") ?? "",
    pays: formData.get("pays") ?? "",
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    consent: formData.get("consent") ?? undefined,
  });
}

/** Card: opens a pending order and sends the client to Stripe Checkout. */
export async function payServiceByCard(formData: FormData): Promise<void> {
  const parsed = parseContact(formData);
  if (!parsed.success) redirect(`/conseil?erreur=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Données invalides.")}`);
  const code = parsed.data.code as ServiceCode;
  const fail = (error: string): never => redirect(backUrl(code, formData, { erreur: error }));

  const resolved = await resolveLead(parsed.data);
  if ("ok" in resolved) return fail(resolved.error);

  await recordServerEvent({ name: "service_pay_click", leadId: resolved.leadId, label: `${code}:stripe` });
  const started = await startServiceOrder({ leadId: resolved.leadId, code, method: "stripe", requested: await requestedSlotFor(code) });
  if (!started.order) return fail("Ce service n'est pas disponible pour votre pays.");
  const { order, offer, lead } = started;

  let checkout;
  try {
    checkout = await createCheckoutSession({
      reference: order.reference,
      registrationId: order.id,
      amountUsdCents: order.amountUsd,
      productName: `Conseil carrière — ${offer.service.name}`,
      description: `${offer.service.durationLabel} en visio avec Ben, coach CISSP certifié. ${offer.service.deliverable}.`,
      customerEmail: lead.email,
      successUrl: `${env.NEXT_PUBLIC_APP_URL}/conseil/merci?ref=${order.reference}`,
      cancelUrl: `${env.NEXT_PUBLIC_APP_URL}${backUrl(code, formData, { annule: "1" })}`,
    });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return fail("Le paiement par carte n'est pas encore activé.");
    console.error("[conseil] Stripe", error);
    return fail("Impossible d'ouvrir le paiement. Réessayez dans un instant.");
  }

  await prisma.serviceOrder.update({ where: { id: order.id }, data: { stripeSessionId: checkout.id } });
  redirect(checkout.url);
}

const mobileSchema = z.object({
  operator: z.enum(["mtn", "orange"]),
  phone: z.string().trim().regex(/^[26]\d{8}$/, "Numéro mobile money à 9 chiffres, ex. 677123456"),
});

/** Mobile money through Netticket, same contract as the bootcamp (SPECS A4). */
export async function payServiceByMobileMoney(formData: FormData): Promise<void> {
  const parsed = parseContact(formData);
  if (!parsed.success) redirect(`/conseil?erreur=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Données invalides.")}`);
  const code = parsed.data.code as ServiceCode;
  const fail = (error: string): never => redirect(backUrl(code, formData, { erreur: error }));

  const mobile = mobileSchema.safeParse({ operator: formData.get("operator"), phone: formData.get("phone") });
  if (!mobile.success) return fail(mobile.error.issues[0]?.message ?? "Données invalides.");

  const resolved = await resolveLead(parsed.data);
  if ("ok" in resolved) return fail(resolved.error);

  const { createMobilePayment, checkTransaction, fallbackUrl, NetticketNotConfiguredError } = await import("@/lib/payments/netticket");
  const { markServiceOrderPaid } = await import("@/lib/consulting");

  await recordServerEvent({ name: "service_pay_click", leadId: resolved.leadId, label: `${code}:netticket` });
  const started = await startServiceOrder({ leadId: resolved.leadId, code, method: "netticket", requested: await requestedSlotFor(code) });
  if (!started.order) return fail("Ce service n'est pas disponible pour votre pays.");
  const { order, offer, lead } = started;

  if (!process.env.NETTICKET_API_KEY) {
    const url = fallbackUrl(order.reference);
    if (!url) return fail("Le paiement mobile n'est pas encore activé.");
    await prisma.serviceOrder.update({ where: { id: order.id }, data: { status: "pending_manual" } });
    redirect(url);
  }
  if (!offer.netticketTicketCode) return fail("Le paiement mobile n'est pas disponible pour ce service dans votre pays. Utilisez la carte bancaire.");

  let result;
  try {
    result = await createMobilePayment({ email: lead.email, phone: mobile.data.phone, ticketCode: offer.netticketTicketCode, operator: mobile.data.operator, name: `${lead.firstName} ${lead.lastName}` });
  } catch (error) {
    if (error instanceof NetticketNotConfiguredError) return fail("Le paiement mobile n'est pas encore activé.");
    console.error("[conseil] Netticket", error);
    return fail("Impossible de lancer le paiement mobile. Réessayez dans un instant.");
  }
  if (result.status === "failed") return fail(`Paiement refusé : ${result.message}`);

  if (result.transactionId) await prisma.serviceOrder.update({ where: { id: order.id }, data: { netticketTransactionId: result.transactionId } });
  if (result.status === "success" && result.transactionId && (await checkTransaction(result.transactionId)) === "successful") {
    await markServiceOrderPaid({ reference: order.reference, amountPaidUsdCents: order.amountUsd, paidAt: new Date(), netticketTransactionId: result.transactionId });
  }
  redirect(`/conseil/merci?ref=${order.reference}&mobile=1`);
}

const instant = z.string().datetime();

/** Books the next session of a paid order (the link in the payment e-mail). */
export async function bookSessionWithToken(input: { token: string; start: string; timezone: string }): Promise<BookSessionResult> {
  const parsed = z.object({ token: z.string().min(10), start: instant, timezone: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  return bookSession({ bookingToken: parsed.data.token, start: new Date(parsed.data.start), timezone: parsed.data.timezone });
}

/** The consulting slot kept in the cookie for this service, if any. */
async function requestedSlotFor(code: ServiceCode): Promise<{ start: Date; timezone: string } | undefined> {
  const pending = await readPendingSlot();
  if (!pending || pending.kind !== "consulting" || pending.service !== code) return undefined;
  return { start: new Date(pending.start), timezone: pending.timezone };
}

/**
 * Slot first, then the profile, then the payment (Ben, 24/09/2026). The
 * slot is kept in a cookie; a known prospect goes straight to the order
 * page, a new one to the questionnaire, which brings them back here.
 */
export async function holdConsultingSlot(input: { code: string; token?: string; start: string; timezone: string; sessionMinutes: number }): Promise<BookResult> {
  const parsed = z.object({ code: z.string().refine(isServiceCode), token: z.string().max(200).optional(), start: instant, timezone: z.string().min(1).max(64), sessionMinutes: z.number().int().min(15).max(180) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const { code, token, start, timezone, sessionMinutes } = parsed.data;
  if (!(await isSlotBookable(new Date(start), new Date(), { kind: "consulting", sessionMinutes }))) {
    return { ok: false, error: "Ce créneau vient d'être pris. Choisissez-en un autre." };
  }
  await setPendingSlot({ start, timezone, kind: "consulting", service: code });
  const known = token && token.length >= 10 ? await prisma.scannerResponse.findUnique({ where: { resultToken: token }, select: { id: true } }) : null;
  redirect(known ? `/conseil/${code}?t=${token}` : "/scanner?suite=conseil");
}

/** "Changer de créneau": forget the slot and pick again. */
export async function forgetConsultingSlot(formData: FormData): Promise<void> {
  await clearPendingSlot();
  const code = formData.get("code");
  const token = formData.get("t");
  redirect(`/conseil/${typeof code === "string" ? code : ""}${typeof token === "string" && token ? `?t=${token}` : ""}`);
}
