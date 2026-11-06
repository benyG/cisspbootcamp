"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { StripeNotConfiguredError, createCheckoutSession } from "@/lib/payments/stripe";
import { firstDueUsd } from "@/lib/installments";
import { PROGRAMS } from "@/lib/programs";
import { startRegistration } from "@/lib/registration";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";
import { recordServerEvent } from "@/lib/tracking/server";

/**
 * Lead behind a scanner result token — the only way into /inscription in V1.
 * The page opens once Ben has validated the follow-up, or right away for a
 * "ready" profile (site settings, on by default since 24/09), or as soon as
 * the discovery call has taken place: the payment link Ben's e-mail carries
 * after the call must never be a dead end.
 */
export async function leadIdFromToken(token: string | undefined): Promise<number | null> {
  if (!token || token.length < 10) return null;
  const response = await prisma.scannerResponse.findUnique({
    where: { resultToken: token },
    select: { leadId: true, status: true, readiness: true, lead: { select: { bookings: { where: { status: "done" }, select: { id: true }, take: 1 } } } },
  });
  if (!response || response.status === "set_aside") return null;
  if (response.status === "pending_review") {
    if (response.lead.bookings.length > 0) return response.leadId;
    const settings = await loadSiteSettings().catch(() => SITE_DEFAULTS);
    if (!(response.readiness === "ready" && settings.offer.directRegistrationForReady)) return null;
  }
  return response.leadId;
}

export type PayResult = { ok: false; error: string };

/** Card: opens a pending registration and sends the prospect to Stripe Checkout. */
export async function payByCard(formData: FormData): Promise<PayResult> {
  const token = z.string().min(10).safeParse(formData.get("t"));
  if (!token.success) return { ok: false, error: "Lien invalide." };

  const leadId = await leadIdFromToken(token.data);
  if (!leadId) return { ok: false, error: "Repassez par votre analyse pour vous inscrire." };

  await recordServerEvent({ name: "pay_click", leadId, label: "stripe" });
  const started = await startRegistration({ leadId, method: "stripe", twoPayments: formData.get("plan") === "two", promoCode: (formData.get("code") as string | null) || null });
  if (!started.registration) return { ok: false, error: startError(started.reason) };

  const { registration, offer } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  let checkout;
  try {
    checkout = await createCheckoutSession({
      reference: registration.reference,
      registrationId: registration.id,
      amountUsdCents: firstDueUsd(registration),
      productName: `${PROGRAMS[offer.program].productName} — ${offer.cohort.name}${registration.balanceUsd > 0 ? " · premier versement" : ""}`,
      description: PROGRAMS[offer.program].productLine,
      customerEmail: lead.email,
      successUrl: `${env.NEXT_PUBLIC_APP_URL}/inscription/merci?ref=${registration.reference}`,
      cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/inscription?t=${token.data}&annule=1`,
    });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return { ok: false, error: "Le paiement par carte n'est pas encore activé." };
    }
    console.error("[inscription] Stripe", error);
    return { ok: false, error: "Impossible d'ouvrir le paiement. Réessayez dans un instant." };
  }

  await prisma.registration.update({ where: { id: registration.id }, data: { stripeSessionId: checkout.id } });
  redirect(checkout.url);
}

function startError(reason: string): string {
  if (reason === "no_cohort") return "Aucune cohorte n'est ouverte à l'inscription pour le moment.";
  if (reason === "no_two_payments") return "Le paiement en deux fois n'est plus proposé pour ce tarif : choisissez le paiement en une fois.";
  return "Votre tarif se fait sur devis : écrivez à Ben.";
}

const mobileSchema = z.object({
  t: z.string().min(10),
  operator: z.enum(["mtn", "orange"]),
  /** Local number as dialled in Cameroon and neighbours: 9 digits starting with 6 or 2. */
  phone: z.string().trim().regex(/^[26]\d{8}$/, "Numéro mobile money à 9 chiffres, ex. 677123456"),
});

/**
 * Mobile money through Netticket (SPECS A4). API mode: create the transaction,
 * then trust only a server-side check. Fallback mode (no API key, a purchase
 * page configured): open a pending_manual seat and send the prospect to
 * Netticket's page with our reference; Ben confirms from the queue.
 */
export async function payByMobileMoney(formData: FormData): Promise<PayResult> {
  const parsed = mobileSchema.safeParse({ t: formData.get("t"), operator: formData.get("operator"), phone: formData.get("phone") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };

  const leadId = await leadIdFromToken(parsed.data.t);
  if (!leadId) return { ok: false, error: "Repassez par votre analyse pour vous inscrire." };

  const { createMobilePayment, checkTransaction, fallbackUrl, NetticketNotConfiguredError } = await import("@/lib/payments/netticket");
  const { markRegistrationPaid } = await import("@/lib/registration");

  await recordServerEvent({ name: "pay_click", leadId, label: "netticket" });
  const started = await startRegistration({ leadId, method: "netticket", twoPayments: formData.get("plan") === "two" });
  if (!started.registration) return { ok: false, error: startError(started.reason) };
  const { registration, checkout } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  // Fallback mode.
  if (!process.env.NETTICKET_API_KEY) {
    const url = fallbackUrl(registration.reference);
    if (!url) return { ok: false, error: "Le paiement mobile n'est pas encore activé." };
    await prisma.registration.update({ where: { id: registration.id }, data: { status: "pending_manual" } });
    redirect(url);
  }

  if (!checkout.netticketTicketCode) return { ok: false, error: "Le paiement mobile n'est pas disponible pour votre pays." };

  let result;
  try {
    result = await createMobilePayment({
      email: lead.email,
      phone: parsed.data.phone,
      ticketCode: checkout.netticketTicketCode,
      operator: parsed.data.operator,
      name: `${lead.firstName} ${lead.lastName}`,
    });
  } catch (error) {
    if (error instanceof NetticketNotConfiguredError) return { ok: false, error: "Le paiement mobile n'est pas encore activé." };
    console.error("[inscription] Netticket", error);
    return { ok: false, error: "Impossible de lancer le paiement mobile. Réessayez dans un instant." };
  }

  if (result.status === "failed") return { ok: false, error: `Paiement refusé : ${result.message}` };

  if (result.transactionId) {
    await prisma.registration.update({ where: { id: registration.id }, data: { netticketTransactionId: result.transactionId } });
  }

  if (result.status === "success" && result.transactionId) {
    // Netticket said paid; we still ask it again before believing it.
    if ((await checkTransaction(result.transactionId)) === "successful") {
      await markRegistrationPaid({ reference: registration.reference, amountPaidUsdCents: firstDueUsd(registration), paidAt: new Date(), netticketTransactionId: result.transactionId });
    }
  }

  redirect(`/inscription/merci?ref=${registration.reference}&mobile=1`);
}
