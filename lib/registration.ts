import { randomBytes } from "node:crypto";

import { revalidateTag } from "next/cache";

import { type CohortCandidate, formatCohortMonth, isAdmissionOpen, remainingSeats, selectRegistrationCohort } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { nextFollowupAt } from "@/lib/followups";
import { sendEmail } from "@/lib/messaging/email";
import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";
import { consultingCredit } from "@/lib/services";
import { recordEvent } from "@/lib/tracking/server";

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

/**
 * Open cohorts with their taken seats. Seats held for other prospects count
 * as taken; the lead's own hold (if any) does not, so the seat kept for them
 * is theirs to buy.
 */
export async function loadOpenCohorts(now = new Date(), forLeadId?: number, program: ProgramCode = "cissp"): Promise<CohortCandidate[]> {
  const cohorts = await prisma.cohort.findMany({
    where: { status: "open", program },
    include: {
      _count: {
        select: {
          registrations: { where: { status: "paid" } },
          seatHolds: { where: { releasedAt: null, expiresAt: { gt: now }, ...(forLeadId ? { leadId: { not: forLeadId } } : {}) } },
        },
      },
    },
  });
  return cohorts
    .map((cohort) => ({
      id: cohort.id,
      program: cohort.program,
      name: cohort.name,
      startsAt: cohort.startsAt,
      capacity: cohort.capacity,
      status: cohort.status,
      confirmedCount: cohort._count.registrations,
      heldCount: cohort._count.seatHolds,
    }))
    .filter((cohort) => isAdmissionOpen(cohort.startsAt, now));
}

export type Offer = {
  program: ProgramCode;
  cohort: CohortCandidate;
  tierCode: string;
  country: string;
  netticketTicketCode: string | null;
  /** Tier price before any credit. */
  listPriceUsdCents: number;
  /** Consulting hour deducted (docs/OFFRES.md §2), 0 when none applies. */
  creditUsdCents: number;
  creditOrderId: number | null;
  /** Amount due, after credit. */
  amountUsdCents: number;
  usdLabel: string;
  currencyLocal: string;
  amountLocal: number | null;
  localLabel: string | null;
  seatsLeft: number;
};

/**
 * What the registration page shows a lead: cohort, price, local equivalent.
 * The bootcamp is priced by the tier; another programme by ProgramPrice.
 */
export async function buildOffer(leadId: number, now = new Date(), program: ProgramCode = "cissp"): Promise<{ offer: Offer } | { offer: null; reason: "no_cohort" | "quote_only" | "not_found" }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { offer: null, reason: "not_found" };

  const tiers = await prisma.pricingTier.findMany();
  const tierCode = resolveTierCode(
    lead.country,
    tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })),
  );
  if (isQuoteOnly(tierCode)) return { offer: null, reason: "quote_only" };

  const tierRow = tiers.find((t) => t.code === tierCode);
  if (!tierRow) return { offer: null, reason: "quote_only" };
  const programPrice = program === "cissp" ? null : await prisma.programPrice.findUnique({ where: { program_tier: { program, tier: tierCode } } });
  if (program !== "cissp" && !programPrice) return { offer: null, reason: "quote_only" };
  const tier = { amountUsd: programPrice?.amountUsd ?? tierRow.amountUsd, netticketTicketCode: programPrice ? programPrice.netticketTicketCode : tierRow.netticketTicketCode };

  const cohort = selectRegistrationCohort(await loadOpenCohorts(now, leadId, program), now, program);
  if (!cohort) return { offer: null, reason: "no_cohort" };

  // A consulting hour paid in the last 90 days comes off the bootcamp price.
  const paidOrders = program !== "cissp" ? [] : await prisma.serviceOrder.findMany({
    where: { leadId, status: "paid", service: { creditable: true } },
    include: { service: { select: { sessions: true, sessionMinutes: true } } },
  });
  const credit = consultingCredit(
    paidOrders.filter((o) => o.paidAt).map((o) => ({ id: o.id, amountUsd: o.amountUsd, sessions: o.service.sessions, sessionMinutes: o.service.sessionMinutes, paidAt: o.paidAt as Date, creditedRegistrationId: o.creditedRegistrationId })),
    now,
  );
  const amountUsd = Math.max(0, tier.amountUsd - (credit?.creditUsd ?? 0));

  const currencyLocal = localCurrencyFor(lead.country);
  const amountLocal = convertUsdCents(amountUsd, currencyLocal, await loadRates());

  return {
    offer: {
      program,
      cohort,
      tierCode,
      country: lead.country,
      netticketTicketCode: tier.netticketTicketCode,
      listPriceUsdCents: tier.amountUsd,
      creditUsdCents: credit?.creditUsd ?? 0,
      creditOrderId: credit?.orderId ?? null,
      amountUsdCents: amountUsd,
      usdLabel: formatUsdCents(amountUsd),
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
export async function startRegistration(input: { leadId: number; method: "stripe" | "netticket"; program?: ProgramCode }) {
  const result = await buildOffer(input.leadId, new Date(), input.program ?? "cissp");
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
      creditUsd: offer.creditUsdCents,
      currencyLocal: offer.currencyLocal === "USD" ? null : offer.currencyLocal,
      amountLocal: offer.currencyLocal === "USD" ? null : offer.amountLocal,
      method: input.method,
      reference: newReference(),
    },
  });

  await prisma.$transaction([
    prisma.actionLog.create({
      data: { leadId: input.leadId, type: "registration_started", payload: { registrationId: registration.id, method: input.method } },
    }),
    // Seat reserved, not paid → J+1 then J+3 (SPECS A6).
    prisma.lead.update({
      where: { id: input.leadId },
      data: { nextFollowupAt: nextFollowupAt("unpaid", 0, new Date()), followupCount: 0 },
    }),
  ]);

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

  // Seat check at confirmation time, not at checkout time, within the same programme.
  const now = new Date();
  const program = registration.cohort.program;
  const open = await loadOpenCohorts(now, undefined, program);
  const wanted = open.find((c) => c.id === registration.cohortId);
  const target = wanted && remainingSeats(wanted) > 0 ? wanted : selectRegistrationCohort(open, now, program);
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
    // The consulting hour that was deducted is now spent (docs/OFFRES.md §2).
    if (registration.creditUsd > 0) {
      const credited = await tx.serviceOrder.findFirst({ where: { leadId: registration.leadId, status: "paid", creditedRegistrationId: null, service: { creditable: true } }, orderBy: { paidAt: "desc" } });
      if (credited) await tx.serviceOrder.update({ where: { id: credited.id }, data: { creditedRegistrationId: registration.id } });
    }
    // The seat that was held for them is now theirs for good.
    await tx.seatHold.updateMany({
      where: { leadId: registration.leadId, releasedAt: null },
      data: { releasedAt: new Date(), releaseReason: "paid" },
    });
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
  await recordEvent({ name: "paid", leadId: registration.leadId, label: registration.method });

  const cohortName = `${PROGRAMS[program].name} — ${(target?.name ?? registration.cohort.name)}`;
  const cohortMonth = formatCohortMonth(target?.startsAt ?? registration.cohort.startsAt);

  await sendEmail({
    to: registration.lead.email,
    subject: `Votre place est réservée — ${cohortName}`,
    text:
      `Bonjour ${registration.lead.firstName},\n\n` +
      `Votre paiement de ${formatUsdCents(registration.amountUsd)} est confirmé${registration.creditUsd > 0 ? ` (votre heure de conseil, ${formatUsdCents(registration.creditUsd)}, a été déduite)` : ""}. Votre place dans la ${cohortName} est réservée.\n\n` +
      (moved
        ? `La cohorte que vous visiez s'est remplie entre-temps : votre place est sur la suivante, en ${cohortMonth}. Si cette date ne vous convient pas, répondez à ce message.\n\n`
        : "") +
      `Référence : ${registration.reference}\n` +
      `Votre reçu : ${env.NEXT_PUBLIC_APP_URL}/inscription/recu/${registration.reference}\n\n` +
      `Je vous écris avant le démarrage avec le programme détaillé et les accès${program === "cc" ? ", et la marche à suivre pour réserver votre examen CC auprès d'ISC²" : ""}.\n\n` +
      `Ben\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${registration.lead.unsubscribeToken}`,
  });

  return { ok: true, alreadyPaid: false };
}
