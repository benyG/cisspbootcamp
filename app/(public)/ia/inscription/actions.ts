"use server";

import { prisma } from "@/lib/db";
import { type CheckoutOptions, programCardCheckout, programMobileCheckout } from "@/lib/program-checkout";

/**
 * Bâtisseur IA registration: the person picks an entry (J1 date), is known
 * through their diagnostic token or captured with explicit consent, then
 * pays. The J1 seat is taken when the payment is confirmed (lib/registration.ts).
 */
function options(formData: FormData): CheckoutOptions {
  const entry = Number(formData.get("entree"));
  return {
    program: "ia",
    page: "/ia/inscription",
    source: "ia_inscription",
    cohortId: Number.isInteger(entry) && entry > 0 ? entry : undefined,
    noCohort: "Cette date d'entrée n'est plus disponible. Choisissez-en une autre.",
    leadFromToken: async (token) => (await prisma.iaDiagnostic.findUnique({ where: { token }, select: { leadId: true } }))?.leadId ?? null,
  };
}

export async function payIaByCard(formData: FormData): Promise<void> {
  await programCardCheckout(formData, options(formData));
}

export async function payIaByMobileMoney(formData: FormData): Promise<void> {
  await programMobileCheckout(formData, options(formData));
}
