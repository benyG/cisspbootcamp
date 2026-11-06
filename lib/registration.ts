import { randomBytes } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";

import { type CohortCandidate, adminRegistrationProblem, formatCohortMonth, isAdmissionOpen, remainingSeats, selectRegistrationCohort } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { nextFollowupAt } from "@/lib/followups";
import { type TwoPaymentPlan, balanceReference, firstDueUsd, twoPaymentPlan } from "@/lib/installments";
import { sendEmail } from "@/lib/messaging/email";
import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";
import { consultingCredit } from "@/lib/services";
import { createToken } from "@/lib/tokens";
import { recordEvent } from "@/lib/tracking/server";
import { iaUrl } from "@/lib/ia-domain";
import { senderFor, signatureFor } from "@/lib/ia-brand";
import { bestPromo, codeProblem, launchPercent, normalizeCode, type Promo } from "@/lib/promo";
import { readCampaign } from "@/lib/campaign";

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
  /** Launch price or promo code (lib/promo.ts): card, one payment only. */
  promo: (Promo & { usdLabel: string }) | null;
  /** Why the code typed does not apply, in the visitor's words. */
  promoError: string | null;
  /** Payment in two instalments, when the price row offers it (lib/installments.ts). */
  twoPayments: (TwoPaymentPlan & { firstLabel: string; balanceLabel: string; totalLabel: string; firstLocalLabel: string | null; netticketTicketCode: string | null }) | null;
};

/** The "avant le …" of the balance: the first day's date, never a clock time (Ben). */
export function balanceDeadline(startsAt: Date): string {
  return startsAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export const balanceUrl = (reference: string) => `${env.NEXT_PUBLIC_APP_URL}/inscription/solde/${reference}`;

/**
 * What the registration page shows a lead: cohort, price, local equivalent.
 * The bootcamp is priced by the tier; another programme by ProgramPrice.
 */
export async function buildOffer(leadId: number, now = new Date(), program: ProgramCode = "cissp", cohortId?: number, opts: { promoCode?: string | null } = {}): Promise<{ offer: Offer } | { offer: null; reason: "no_cohort" | "quote_only" | "not_found" }> {
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
  const tier = {
    amountUsd: programPrice?.amountUsd ?? tierRow.amountUsd,
    netticketTicketCode: programPrice ? programPrice.netticketTicketCode : tierRow.netticketTicketCode,
    installmentUsd: programPrice ? programPrice.installmentUsd : tierRow.installmentUsd,
    netticketInstallmentCode: programPrice ? programPrice.netticketInstallmentCode : tierRow.netticketInstallmentCode,
  };

  // Bâtisseur IA: the person picks their entry (J1 date); otherwise the next open cohort.
  const open = await loadOpenCohorts(now, leadId, program);
  const cohort = cohortId ? open.find((c) => c.id === cohortId && remainingSeats(c) > 0) ?? null : selectRegistrationCohort(open, now, program);
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
  const rates = await loadRates();
  const amountLocal = convertUsdCents(amountUsd, currencyLocal, rates);
  const plan = twoPaymentPlan(tier.installmentUsd, credit?.creditUsd ?? 0);
  const firstLocal = plan ? convertUsdCents(plan.firstUsd, currencyLocal, rates) : null;

  // Promo (lot 6): the cohort's launch price, or a code; the best one, by card in one payment.
  let campaignRow: { campaign: unknown } | null = null;
  try { campaignRow = await prisma.cohort.findUnique({ where: { id: cohort.id }, select: { campaign: true } }); } catch { campaignRow = null; }
  const launch = launchPercent(readCampaign(campaignRow?.campaign)?.promo.early, now);
  const typed = opts.promoCode ? normalizeCode(opts.promoCode) : null;
  let codeRow: { code: string; percent: number; kind: string } | null = null;
  let promoError: string | null = opts.promoCode && !typed ? "Ce code n’existe pas ou n’est plus actif." : null;
  if (typed) {
    const row = await prisma.promoCode.findUnique({ where: { code: typed } });
    const usedCount = row ? await prisma.registration.count({ where: { promoCode: row.code, status: "paid" } }) : 0;
    promoError = codeProblem(row, { program, leadId, usedCount }, now);
    if (!promoError && row) codeRow = { code: row.code, percent: row.percent, kind: row.kind };
  }
  const promo = bestPromo({ listUsdCents: tier.amountUsd, creditUsdCents: credit?.creditUsd ?? 0, launch, code: codeRow });

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
      promo: promo ? { ...promo, usdLabel: formatUsdCents(promo.amountUsdCents) } : null,
      promoError,
      twoPayments: plan
        ? {
            ...plan,
            firstLabel: formatUsdCents(plan.firstUsd),
            balanceLabel: formatUsdCents(plan.balanceUsd),
            totalLabel: formatUsdCents(plan.totalUsd),
            firstLocalLabel: firstLocal !== null && currencyLocal !== "USD" ? formatLocal(firstLocal, currencyLocal) : null,
            netticketTicketCode: tier.netticketInstallmentCode,
          }
        : null,
    },
  };
}

/**
 * Opens a pending registration on the sellable cohort. If the lead already
 * has one pending for that cohort, it is reused so a retried checkout does
 * not multiply rows.
 */
export async function startRegistration(input: { leadId: number; method: "stripe" | "netticket"; program?: ProgramCode; cohortId?: number; twoPayments?: boolean; promoCode?: string | null }) {
  const result = await buildOffer(input.leadId, new Date(), input.program ?? "cissp", input.cohortId, { promoCode: input.promoCode });
  if (!result.offer) return { registration: null, reason: result.reason } as const;
  const { offer } = result;
  // Two instalments asked but no longer offered (price changed): say so rather than charge in full.
  const plan = input.twoPayments ? offer.twoPayments : null;
  if (input.twoPayments && !plan) return { registration: null, reason: "no_two_payments" } as const;
  // The promo is for a card payment in one go (Ben, 06/11): Netticket tickets have a fixed price.
  const promo = input.method === "stripe" && !plan ? offer.promo : null;
  const amountUsd = plan ? plan.totalUsd : promo ? promo.amountUsdCents : offer.amountUsdCents;
  const balanceUsd = plan ? plan.balanceUsd : 0;
  /** What this checkout charges now, and with which Netticket ticket. */
  const checkout = { amountUsd: amountUsd - balanceUsd, netticketTicketCode: plan ? plan.netticketTicketCode : offer.netticketTicketCode };

  const existing = await prisma.registration.findFirst({
    where: { leadId: input.leadId, cohortId: offer.cohort.id, status: { in: ["pending", "pending_manual"] }, method: input.method, amountUsd, balanceUsd },
  });
  if (existing) return { registration: existing, offer, checkout } as const;

  const registration = await prisma.registration.create({
    data: {
      leadId: input.leadId,
      cohortId: offer.cohort.id,
      tier: offer.tierCode,
      amountUsd,
      balanceUsd,
      creditUsd: offer.creditUsdCents,
      currencyLocal: offer.currencyLocal === "USD" ? null : offer.currencyLocal,
      amountLocal: offer.currencyLocal === "USD" || plan || promo ? null : offer.amountLocal,
      method: input.method,
      reference: newReference(),
      promoCode: promo ? promo.code ?? "LANCEMENT" : null,
      discountUsd: promo ? promo.discountUsdCents : 0,
    },
  });

  await prisma.$transaction([
    prisma.actionLog.create({
      data: { leadId: input.leadId, type: "registration_started", payload: { registrationId: registration.id, method: input.method, twoPayments: Boolean(plan) } },
    }),
    // Seat reserved, not paid → J+1 then J+3 (SPECS A6).
    prisma.lead.update({
      where: { id: input.leadId },
      data: { nextFollowupAt: nextFollowupAt("unpaid", 0, new Date()), followupCount: 0 },
    }),
  ]);

  return { registration, offer, checkout } as const;
}

/**
 * Bâtisseur IA (lib/ia-days.ts): paying for an entry takes the J1 seat on
 * that entry's date. Idempotent, so a retried webhook adds nothing.
 */
async function takeEntrySeat(tx: Prisma.TransactionClient, leadId: number, cohortId: number): Promise<void> {
  const day = await tx.iaDay.findUnique({ where: { cohortId }, select: { id: true } });
  if (!day) return;
  await tx.iaSeat.upsert({
    where: { leadId_cohortId_journee: { leadId, cohortId, journee: 1 } },
    create: { leadId, cohortId, journee: 1, dayId: day.id },
    update: {},
  });
  // Their calendar link, to pick J2 to J6 (lib/ia-plan-server.ts).
  await tx.iaPlan.upsert({ where: { leadId_cohortId: { leadId, cohortId } }, create: { leadId, cohortId, token: createToken() }, update: {} });
}

/** After the J1 seat: the agenda invitation (best effort, the cron retries) and the calendar link for the e-mail. */
async function afterEntryPaid(leadId: number, cohortId: number): Promise<string | undefined> {
  try {
    const { inviteEntry, iaPlanUrl } = await import("@/lib/ia-plan-server");
    await inviteEntry(leadId, cohortId);
    const plan = await prisma.iaPlan.findUnique({ where: { leadId_cohortId: { leadId, cohortId } }, select: { token: true } });
    return plan ? iaPlanUrl(plan.token) : undefined;
  } catch (error) {
    console.error("[ia] après paiement", error);
    return undefined;
  }
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

  // With two instalments, the first payment is what takes the seat.
  const expected = firstDueUsd(registration);
  if (input.amountPaidUsdCents < expected) {
    await prisma.actionLog.create({
      data: {
        leadId: registration.leadId,
        type: "payment_amount_mismatch",
        payload: { reference: input.reference, expected, received: input.amountPaidUsdCents },
      },
    });
    return { ok: false, error: `Montant reçu ${input.amountPaidUsdCents} < attendu ${expected}` };
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
    if (program === "ia") await takeEntrySeat(tx, registration.leadId, target?.id ?? registration.cohortId);
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

  const planUrl = program === "ia" ? await afterEntryPaid(registration.leadId, target?.id ?? registration.cohortId) : undefined;
  await sendSeatConfirmation({
    lead: registration.lead,
    amountUsd: registration.amountUsd,
    balanceUsd: registration.balanceUsd,
    creditUsd: registration.creditUsd,
    reference: registration.reference,
    program,
    cohort: target ?? registration.cohort,
    moved,
    planUrl,
  });

  return { ok: true, alreadyPaid: false };
}

/**
 * The only way a balance (second instalment) becomes paid: a verified
 * Stripe webhook, a Netticket server-side check, or Ben's manual
 * confirmation. Idempotent, like markRegistrationPaid.
 */
export async function markBalancePaid(input: {
  /** The seat's reference (without the balance suffix). */
  reference: string;
  amountPaidUsdCents: number;
  paidAt: Date;
  method: "stripe" | "netticket" | "manual";
  stripeSessionId?: string;
  netticketTransactionId?: string;
  note?: string;
}): Promise<PaidResult> {
  const registration = await prisma.registration.findUnique({ where: { reference: input.reference }, include: { lead: true, cohort: true } });
  if (!registration) return { ok: false, error: `Référence inconnue : ${input.reference}` };
  if (registration.balancePaidAt) return { ok: true, alreadyPaid: true };
  if (registration.status !== "paid" || registration.balanceUsd <= 0) return { ok: false, error: `Aucun solde attendu pour ${input.reference}` };
  if (input.amountPaidUsdCents < registration.balanceUsd) {
    await prisma.actionLog.create({
      data: { leadId: registration.leadId, type: "payment_amount_mismatch", payload: { reference: balanceReference(input.reference), expected: registration.balanceUsd, received: input.amountPaidUsdCents } },
    });
    return { ok: false, error: `Montant reçu ${input.amountPaidUsdCents} < solde attendu ${registration.balanceUsd}` };
  }

  // Conditional update: two confirmations racing (webhook and cron) record and e-mail once.
  const updated = await prisma.registration.updateMany({
    where: { id: registration.id, balancePaidAt: null },
    data: {
      balancePaidAt: input.paidAt,
      balanceMethod: input.method,
      balanceNote: input.note || null,
      balanceStripeSessionId: input.stripeSessionId ?? registration.balanceStripeSessionId,
      balanceNetticketTransactionId: input.netticketTransactionId ?? registration.balanceNetticketTransactionId,
    },
  });
  if (updated.count === 0) return { ok: true, alreadyPaid: true };
  await prisma.actionLog.create({ data: { leadId: registration.leadId, type: "balance_paid", payload: { reference: input.reference, method: input.method, amountUsd: registration.balanceUsd } } });
  await recordEvent({ name: "paid", leadId: registration.leadId, label: `${input.method}:solde` });

  const cohortName = `${PROGRAMS[registration.cohort.program].name} — ${registration.cohort.name}`;
  await sendEmail({
    to: registration.lead.email,
    fromName: senderFor(registration.cohort.program),
    subject: `Solde reçu — ${cohortName}`,
    text:
      `Bonjour ${registration.lead.firstName},\n\n` +
      `Votre second versement de ${formatUsdCents(registration.balanceUsd)} est confirmé : votre inscription à la ${cohortName} est entièrement réglée (${formatUsdCents(registration.amountUsd)}).\n\n` +
      `Référence : ${registration.reference}\n` +
      `Votre reçu, mis à jour : ${env.NEXT_PUBLIC_APP_URL}/inscription/recu/${registration.reference}\n\n` +
      `Merci, et à très bientôt.\n\n${signatureFor(registration.cohort.program, "Ben")}\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${registration.lead.unsubscribeToken}`,
  }).catch((error) => console.error("[solde] e-mail", error));
  return { ok: true, alreadyPaid: false };
}

/** The "votre place est réservée" e-mail, with the receipt link. */
async function sendSeatConfirmation(input: {
  lead: { email: string; firstName: string; unsubscribeToken: string };
  amountUsd: number;
  /** Second instalment still due, 0 when paid at once. */
  balanceUsd?: number;
  creditUsd: number;
  reference: string;
  program: ProgramCode;
  cohort: { name: string; startsAt: Date };
  moved?: boolean;
  /** Bâtisseur IA: the participant's calendar page. */
  planUrl?: string;
}) {
  const cohortName = `${PROGRAMS[input.program].name} — ${input.cohort.name}`;
  const cohortMonth = formatCohortMonth(input.cohort.startsAt);
  return sendEmail({
    to: input.lead.email,
    fromName: senderFor(input.program),
    subject: `Votre place est réservée — ${cohortName}`,
    text:
      `Bonjour ${input.lead.firstName},\n\n` +
      (input.balanceUsd
        ? `Votre premier versement de ${formatUsdCents(input.amountUsd - input.balanceUsd)} est confirmé${input.creditUsd > 0 ? ` (votre heure de conseil, ${formatUsdCents(input.creditUsd)}, a été déduite)` : ""}. Votre place dans la ${cohortName} est réservée.\n\n` +
          `Le second versement, ${formatUsdCents(input.balanceUsd)}, est à régler avant le premier jour, le ${balanceDeadline(input.cohort.startsAt)}, par carte ou mobile money : ${balanceUrl(input.reference)}\n${input.program === "ia" ? "Nous vous le rappelons" : "Je vous le rappelle"} par e-mail une semaine avant.\n\n`
        : `Votre paiement de ${formatUsdCents(input.amountUsd)} est confirmé${input.creditUsd > 0 ? ` (votre heure de conseil, ${formatUsdCents(input.creditUsd)}, a été déduite)` : ""}. Votre place dans la ${cohortName} est réservée.\n\n`) +
      (input.moved
        ? `La cohorte que vous visiez s'est remplie entre-temps : votre place est sur la suivante, en ${cohortMonth}. Si cette date ne vous convient pas, répondez à ce message.\n\n`
        : "") +
      `Référence : ${input.reference}\n` +
      `Votre reçu : ${env.NEXT_PUBLIC_APP_URL}/inscription/recu/${input.reference}\n\n` +
      (input.program === "ia"
        ? `Votre J1 est réservée à cette date ; l'invitation arrive dans votre agenda, avec le lien de la visio.\n\n${input.planUrl ? `Choisissez maintenant vos J2 à J6, dans l'ordre, parmi les week-ends suivants, et remplissez votre fiche projet : ${input.planUrl}\n\n` : ""}Préparez votre J1 deux ou trois jours avant (30 minutes : vos comptes et Claude Code) : ${iaUrl("/ia/guide", env.NEXT_PUBLIC_APP_URL)}\n\n`
        : `Je vous écris avant le démarrage avec le programme détaillé et les accès${input.program === "cc" ? ", et la marche à suivre pour réserver votre examen CC auprès d'ISC²" : ""}.\n\n`) +
      `${signatureFor(input.program, "Ben\nCoach CISSP")}\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${input.lead.unsubscribeToken}`,
  });
}

export type AdminRegistrationResult = { ok: true; reference: string; emailSent: boolean } | { ok: false; error: string };

/**
 * Ben registers a participant who paid outside the app (26/09): transfer,
 * cash, another channel. A manual admin confirmation (CLAUDE.md, Paiement):
 * the seat is paid at once, in the cohort he picks, any open pending
 * registration of the lead is dropped, held seats are released.
 */
export async function registerByAdmin(input: { leadId: number; cohortId: number; amountUsdCents: number; paymentNote: string; notify: boolean }): Promise<AdminRegistrationResult> {
  const [lead, cohort] = await Promise.all([
    prisma.lead.findUnique({ where: { id: input.leadId }, include: { pricingTier: true } }),
    prisma.cohort.findUnique({ where: { id: input.cohortId } }),
  ]);
  if (!lead) return { ok: false, error: "Lead introuvable." };
  if (!cohort) return { ok: false, error: "Cohorte introuvable." };
  const alreadyPaidInCohort = (await prisma.registration.count({ where: { leadId: lead.id, cohortId: cohort.id, status: "paid" } })) > 0;
  const problem = adminRegistrationProblem({ cohortStatus: cohort.status, alreadyPaidInCohort, amountUsdCents: input.amountUsdCents });
  if (problem) return { ok: false, error: problem };

  const reference = newReference();
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // A checkout left open for the same programme would double the seat.
    await tx.registration.deleteMany({ where: { leadId: lead.id, status: { in: ["pending", "pending_manual"] }, cohort: { program: cohort.program } } });
    const registration = await tx.registration.create({
      data: {
        leadId: lead.id,
        cohortId: cohort.id,
        tier: lead.pricingTier?.code ?? "manuel",
        amountUsd: input.amountUsdCents,
        method: "manual",
        status: "paid",
        paidAt: now,
        paymentNote: input.paymentNote || null,
        reference,
      },
    });
    await tx.lead.update({ where: { id: lead.id }, data: { status: "registered", nextFollowupAt: null } });
    await tx.seatHold.updateMany({ where: { leadId: lead.id, releasedAt: null }, data: { releasedAt: now, releaseReason: "paid" } });
    if (cohort.program === "ia") await takeEntrySeat(tx, lead.id, cohort.id);
    await tx.actionLog.create({
      data: { leadId: lead.id, type: "registered_by_admin", payload: { registrationId: registration.id, reference, cohortId: cohort.id, amountUsd: input.amountUsdCents, note: input.paymentNote } },
    });
    const paid = await tx.registration.count({ where: { cohortId: cohort.id, status: "paid" } });
    if (paid >= cohort.capacity && cohort.status === "open") await tx.cohort.update({ where: { id: cohort.id }, data: { status: "full" } });
  });

  revalidateTag(COHORTS_CACHE_TAG);
  await recordEvent({ name: "paid", leadId: lead.id, label: "manual" });
  const planUrl = cohort.program === "ia" ? await afterEntryPaid(lead.id, cohort.id) : undefined;
  const email = input.notify
    ? await sendSeatConfirmation({ lead, amountUsd: input.amountUsdCents, creditUsd: 0, reference, program: cohort.program, cohort, planUrl })
    : null;
  return { ok: true, reference, emailSent: Boolean(email?.sent) };
}
