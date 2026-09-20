import { randomBytes } from "node:crypto";

import { revalidateTag } from "next/cache";

import { type CohortCandidate, formatCohortMonth, remainingSeats, selectRegistrationCohort } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";

/**
 * Registration to a cohort — SPECS A4/A5.
 *
 * The one place that turns a lead into a participant. Payment providers only
 * ever call markRegistrationPaid, with a reference they were given here.
 */

/** Human-readable, unambiguous, unique: CB-7K3M-9QXZ. */
export function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `CB-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export async function loadRates(): Promise<RateTable> {
  const rows = await prisma.exchangeRate.findMany();
  return Object.fromEntries(rows.map((row) => [row.currency, row.perUsd]));
}

export async function loadOpenCohorts(now = new Date()): Promise<CohortCandidate[]> {
  const cohorts = await prisma.cohort.findMany({
    where: { status: "open" },
    include: { _count: { select: { registrations: { where: { status: "paid" } } } } },
  });
  return cohorts
    .map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      startsAt: cohort.startsAt,
      capacity: cohort.capacity,
      status: cohort.status,
      confirmedCount: cohort._count.registrations,
    }))
    .filter((cohort) => cohort.startsAt > now);
}

export type Offer = {
  cohort: CohortCandidate;
  tierCode: string;
  amountUsdCents: number;
  usdLabel: string;
  currencyLocal: string;
  amountLocal: number | null;
  localLabel: string | null;
  seatsLeft: number;
};

/** What the registration page shows a lead: cohort, price, local equivalent. */
export async function buildOffer(leadId: number, now = new Date()): Promise<{ offer: Offer } | { offer: null; reason: "no_cohort" | "quote_only" | "not_found" }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { offer: null, reason: "not_found" };

  const tiers = await prisma.pricingTier.findMany();
  const tierCode = resolveTierCode(
    lead.country,
    tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })),
  );
  if (isQuoteOnly(tierCode)) return { offer: null, reason: "quote_only" };

  const tier = tiers.find((t) => t.code === tierCode);
  if (!tier) return { offer: null, reason: "quote_only" };

  const cohort = selectRegistrationCohort(await loadOpenCohorts(now), now);
  if (!cohort) return { offer: null, reason: "no_cohort" };

  const currencyLocal = localCurrencyFor(lead.country);
  const amountLocal = convertUsdCents(tier.amountUsd, currencyLocal, await loadRates());

  return {
    offer: {
      cohort,
      tierCode,
      amountUsdCents: tier.amountUsd,
      usdLabel: formatUsdCents(tier.amountUsd),
      currencyLocal,
      amountLocal,
      localLabel: amountLocal !== null && currencyLocal !== "USD" ? formatLocal(amountLocal, currencyLocal) : null,
      seatsLeft: remainingSeats(cohort),
    },
  };
}

/**
 * Opens a pending registration on the sellable cohort. If the lead already
 * has one pending for that cohort, it is reused so a retried checkout does
 * not multiply rows.
 */
export async function startRegistration(input: { leadId: number; method: "stripe" | "netticket" }) {
  const result = await buildOffer(input.leadId);
  if (!result.offer) return { registration: null, reason: result.reason } as const;
  const { offer } = result;

  const existing = await prisma.registration.findFirst({
    where: { leadId: input.leadId, cohortId: offer.cohort.id, status: { in: ["pending", "pending_manual"] }, method: input.method },
  });
  if (existing) return { registration: existing, offer } as const;

  const registration = await prisma.registration.create({
    data: {
      leadId: input.leadId,
      cohortId: offer.cohort.id,
      tier: offer.tierCode,
      amountUsd: offer.amountUsdCents,
      currencyLocal: offer.currencyLocal === "USD" ? null : offer.currencyLocal,
      amountLocal: offer.currencyLocal === "USD" ? null : offer.amountLocal,
      method: input.method,
      reference: newReference(),
    },
  });

  await prisma.actionLog.create({
    data: { leadId: input.leadId, type: "registration_started", payload: { registrationId: registration.id, method: input.method } },
  });

  return { registration, offer } as const;
}

export type PaidResult = { ok: true; alreadyPaid: boolean } | { ok: false; error: string };

/**
 * The only way a registration becomes `paid`. Idempotent: providers retry
 * webhooks, and a second confirmation must not send a second receipt.
 *
 * If the cohort filled up between checkout and confirmation, the seat lands
 * on the next open cohort and the participant is told — the money is taken,
 * the place is real, only the date moves.
 */
export async function markRegistrationPaid(input: {
  reference: string;
  amountPaidUsdCents: number;
  paidAt: Date;
  stripeSessionId?: string;
  netticketTransactionId?: string;
}): Promise<PaidResult> {
  const registration = await prisma.registration.findUnique({
    where: { reference: input.reference },
    include: { lead: true, cohort: true },
  });
  if (!registration) return { ok: false, error: `Référence inconnue : ${input.reference}` };
  if (registration.status === "paid") return { ok: true, alreadyPaid: true };

  if (input.amountPaidUsdCents < registration.amountUsd) {
    await prisma.actionLog.create({
      data: {
        leadId: registration.leadId,
        type: "payment_amount_mismatch",
        payload: { reference: input.reference, expected: registration.amountUsd, received: input.amountPaidUsdCents },
      },
    });
    return { ok: false, error: `Montant reçu ${input.amountPaidUsdCents} < attendu ${registration.amountUsd}` };
  }

  // Seat check at confirmation time, not at checkout time.
  const now = new Date();
  const open = await loadOpenCohorts(now);
  const wanted = open.find((c) => c.id === registration.cohortId);
  const target = wanted && remainingSeats(wanted) > 0 ? wanted : selectRegistrationCohort(open, now);
  const moved = target !== null && target.id !== registration.cohortId;

  await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id: registration.id },
      data: {
        status: "paid",
        paidAt: input.paidAt,
        stripeSessionId: input.stripeSessionId ?? registration.stripeSessionId,
        netticketTransactionId: input.netticketTransactionId ?? registration.netticketTransactionId,
        cohortId: target?.id ?? registration.cohortId,
      },
    });
    await tx.lead.update({ where: { id: registration.leadId }, data: { status: "registered", nextFollowupAt: null } });
    await tx.actionLog.create({
      data: {
        leadId: registration.leadId,
        type: "payment_confirmed",
        payload: { reference: input.reference, method: registration.method, movedToCohortId: moved ? target?.id : null },
      },
    });

    // Close the cohort once the last seat is paid.
    const cohortId = target?.id ?? registration.cohortId;
    const paid = await tx.registration.count({ where: { cohortId, status: "paid" } });
    const cohort = await tx.cohort.findUnique({ where: { id: cohortId } });
    if (cohort && paid >= cohort.capacity && cohort.status === "open") {
      await tx.cohort.update({ where: { id: cohortId }, data: { status: "full" } });
    }
  });

  // The public gauge must reflect this seat now, not in 60 s.
  revalidateTag(COHORTS_CACHE_TAG);

  const cohortName = target?.name ?? registration.cohort.name;
  const cohortMonth = formatCohortMonth(target?.startsAt ?? registration.cohort.startsAt);

  await sendEmail({
    to: registration.lead.email,
    subject: `Votre place est réservée — ${cohortName}`,
    text:
      `Bonjour ${registration.lead.firstName},\n\n` +
      `Votre paiement de ${formatUsdCents(registration.amountUsd)} est confirmé. Votre place dans la ${cohortName} est réservée.\n\n` +
      (moved
        ? `La cohorte que vous visiez s'est remplie entre-temps : votre place est sur la suivante, en ${cohortMonth}. Si cette date ne vous convient pas, répondez à ce message.\n\n`
        : "") +
      `Référence : ${registration.reference}\n` +
      `Votre reçu : ${env.NEXT_PUBLIC_APP_URL}/inscription/recu/${registration.reference}\n\n` +
      `Je vous écris avant le démarrage avec le programme détaillé et les accès.\n\n` +
      `Ben\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${registration.lead.unsubscribeToken}`,
  });

  return { ok: true, alreadyPaid: false };
}
