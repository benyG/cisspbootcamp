import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { balanceOpen, balanceReference } from "@/lib/installments";
import { StripeNotConfiguredError, createCheckoutSession } from "@/lib/payments/stripe";
import { PROGRAMS } from "@/lib/programs";
import { markBalancePaid } from "@/lib/registration";

/**
 * Paying the second instalment (Ben, 04/11) from /inscription/solde/[reference]:
 * card through Stripe, or mobile money through Netticket. As for the seat,
 * the balance is only marked paid by the webhook or a server-side check.
 */

const referenceSchema = z.string().regex(/^CB-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
const page = (reference: string, extra = "") => `/inscription/solde/${reference}${extra}`;

async function openBalance(formData: FormData) {
  const reference = referenceSchema.safeParse(formData.get("reference"));
  if (!reference.success) redirect("/");
  const registration = await prisma.registration.findUnique({ where: { reference: reference.data }, include: { lead: true, cohort: true } });
  if (!registration) redirect("/");
  if (!balanceOpen(registration)) redirect(page(registration.reference));
  return registration;
}

/** The Netticket ticket priced at one instalment, for this seat's programme and tier. */
async function installmentTicket(program: string, tier: string): Promise<string | null> {
  if (program === "cissp") return (await prisma.pricingTier.findUnique({ where: { code: tier }, select: { netticketInstallmentCode: true } }))?.netticketInstallmentCode ?? null;
  const row = await prisma.programPrice.findFirst({ where: { program: program as never, tier }, select: { netticketInstallmentCode: true } });
  return row?.netticketInstallmentCode ?? null;
}

export async function balanceCardCheckout(formData: FormData): Promise<never> {
  const registration = await openBalance(formData);
  const fail = (error: string): never => redirect(page(registration.reference, `?erreur=${encodeURIComponent(error)}`));
  const program = PROGRAMS[registration.cohort.program];
  let checkout;
  try {
    checkout = await createCheckoutSession({
      reference: balanceReference(registration.reference),
      registrationId: registration.id,
      amountUsdCents: registration.balanceUsd,
      productName: `${program.productName} — ${registration.cohort.name} · second versement`,
      description: program.productLine,
      customerEmail: registration.lead.email,
      successUrl: `${env.NEXT_PUBLIC_APP_URL}${page(registration.reference, "?attente=1")}`,
      cancelUrl: `${env.NEXT_PUBLIC_APP_URL}${page(registration.reference, "?annule=1")}`,
    });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return fail("Le paiement par carte n'est pas encore activé.");
    console.error("[solde] Stripe", error);
    return fail("Impossible d'ouvrir le paiement. Réessayez dans un instant.");
  }
  await prisma.registration.update({ where: { id: registration.id }, data: { balanceStripeSessionId: checkout.id } });
  redirect(checkout.url);
}

const mobileSchema = z.object({
  operator: z.enum(["mtn", "orange"]),
  phone: z.string().trim().regex(/^[26]\d{8}$/, "Numéro mobile money à 9 chiffres, ex. 677123456"),
});

export async function balanceMobileCheckout(formData: FormData): Promise<never> {
  const registration = await openBalance(formData);
  const fail = (error: string): never => redirect(page(registration.reference, `?erreur=${encodeURIComponent(error)}`));
  const mobile = mobileSchema.safeParse({ operator: formData.get("operator"), phone: formData.get("phone") });
  if (!mobile.success) return fail(mobile.error.issues[0]?.message ?? "Données invalides.");

  const { createMobilePayment, checkTransaction, fallbackUrl, NetticketNotConfiguredError } = await import("@/lib/payments/netticket");
  // Fallback mode: Netticket's own page, with the balance reference; Ben confirms from the lead sheet.
  if (!process.env.NETTICKET_API_KEY) {
    const url = fallbackUrl(balanceReference(registration.reference));
    if (!url) return fail("Le paiement mobile n'est pas encore activé.");
    redirect(url);
  }
  const ticketCode = await installmentTicket(registration.cohort.program, registration.tier);
  if (!ticketCode) return fail("Le paiement mobile n'est pas disponible pour ce solde. Utilisez la carte bancaire.");

  let result;
  try {
    result = await createMobilePayment({ email: registration.lead.email, phone: mobile.data.phone, ticketCode, operator: mobile.data.operator, name: `${registration.lead.firstName} ${registration.lead.lastName}`.trim() });
  } catch (error) {
    if (error instanceof NetticketNotConfiguredError) return fail("Le paiement mobile n'est pas encore activé.");
    console.error("[solde] Netticket", error);
    return fail("Impossible de lancer le paiement mobile. Réessayez dans un instant.");
  }
  if (result.status === "failed") return fail(`Paiement refusé : ${result.message}`);
  if (result.transactionId) await prisma.registration.update({ where: { id: registration.id }, data: { balanceNetticketTransactionId: result.transactionId } });
  if (result.status === "success" && result.transactionId && (await checkTransaction(result.transactionId)) === "successful") {
    await markBalancePaid({ reference: registration.reference, amountPaidUsdCents: registration.balanceUsd, paidAt: new Date(), method: "netticket", netticketTransactionId: result.transactionId });
  }
  redirect(page(registration.reference, "?attente=1&mobile=1"));
}
