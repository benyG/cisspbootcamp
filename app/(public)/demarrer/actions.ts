"use server";

import { prisma } from "@/lib/db";
import { type CheckoutOptions, programCardCheckout, programMobileCheckout } from "@/lib/program-checkout";

/**
 * Registration to the CC course (docs/OFFRES.md §3). Unlike the bootcamp,
 * no call and no validated diagnosis stand in the way: the prospect is known
 * through a scanner token, or captured here with explicit consent, then pays.
 */

const CC: CheckoutOptions = {
  program: "cc",
  page: "/demarrer/inscription",
  source: "demarrer",
  noCohort: "Aucune session CC n'est ouverte à l'inscription pour le moment.",
  leadFromToken: async (token) => (await prisma.scannerResponse.findUnique({ where: { resultToken: token }, select: { leadId: true } }))?.leadId ?? null,
};

export async function payProgramByCard(formData: FormData): Promise<void> {
  await programCardCheckout(formData, CC);
}

export async function payProgramByMobileMoney(formData: FormData): Promise<void> {
  await programMobileCheckout(formData, CC);
}
