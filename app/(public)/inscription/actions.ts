"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { StripeNotConfiguredError, createCheckoutSession } from "@/lib/payments/stripe";
import { startRegistration } from "@/lib/registration";

/** Lead behind a scanner result token — the only way into /inscription in V1. */
export async function leadIdFromToken(token: string | undefined): Promise<number | null> {
  if (!token || token.length < 10) return null;
  const response = await prisma.scannerResponse.findUnique({
    where: { resultToken: token },
    select: { leadId: true, status: true },
  });
  if (!response || response.status === "pending_review" || response.status === "set_aside") return null;
  return response.leadId;
}

export type PayResult = { ok: false; error: string };

/** Card: opens a pending registration and sends the prospect to Stripe Checkout. */
export async function payByCard(formData: FormData): Promise<PayResult> {
  const token = z.string().min(10).safeParse(formData.get("t"));
  if (!token.success) return { ok: false, error: "Lien invalide." };

  const leadId = await leadIdFromToken(token.data);
  if (!leadId) return { ok: false, error: "Repassez par votre analyse pour vous inscrire." };

  const started = await startRegistration({ leadId, method: "stripe" });
  if (!started.registration) {
    return {
      ok: false,
      error:
        started.reason === "no_cohort"
          ? "Aucune cohorte n'est ouverte à l'inscription pour le moment."
          : "Votre tarif se fait sur devis : écrivez à Ben.",
    };
  }

  const { registration, offer } = started;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  let checkout;
  try {
    checkout = await createCheckoutSession({
      reference: registration.reference,
      registrationId: registration.id,
      amountUsdCents: registration.amountUsd,
      productName: `CISSP Bootcamp — ${offer.cohort.name}`,
      description: "40 h de préparation au CISSP en français, sur 15 jours, avec un coach certifié.",
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
