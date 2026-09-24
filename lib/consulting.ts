import { randomUUID } from "node:crypto";

import { CalendarNotConnectedError, createCallEvent } from "@/lib/calendar/google";
import { addMinutes } from "@/lib/calendar/slots";
import { confirmationText, describeBooking, formatWhen, isSlotBookable } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { loadRates, newReference } from "@/lib/registration";
import { type ServiceCode, formatDuration } from "@/lib/services";
import { createToken } from "@/lib/tokens";
import { recordEvent, recordServerEvent } from "@/lib/tracking/server";

/**
 * Consulting orders and sessions — docs/OFFRES.md §2 and §5. Pay first, book
 * after. Payment providers only ever call markServiceOrderPaid with a
 * reference they were given here, exactly like registrations.
 */

/** Service references start with CS-, registrations with CB-: the webhooks route on it. */
export const SERVICE_REFERENCE_PREFIX = "CS-";

export function newServiceReference(): string {
  return SERVICE_REFERENCE_PREFIX + newReference().slice(3);
}

export function isServiceReference(reference: string): boolean {
  return reference.startsWith(SERVICE_REFERENCE_PREFIX);
}

export type PublicService = {
  code: ServiceCode;
  name: string;
  tagline: string;
  description: string[];
  deliverable: string;
  sessionMinutes: number;
  sessions: number;
  creditable: boolean;
  durationLabel: string;
  /** USD cents by tier code. */
  prices: Record<string, number>;
};

/** Active services with their prices, in display order. */
export async function loadServices(options: { includeInactive?: boolean } = {}): Promise<PublicService[]> {
  const rows = await prisma.service.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
    include: { prices: true },
  });
  return rows.map((row) => ({
    code: row.code as ServiceCode,
    name: row.name,
    tagline: row.tagline,
    description: row.description.split("\n").filter(Boolean),
    deliverable: row.deliverable,
    sessionMinutes: row.sessionMinutes,
    sessions: row.sessions,
    creditable: row.creditable,
    durationLabel: formatDuration(row.sessions, row.sessionMinutes),
    prices: Object.fromEntries(row.prices.map((price) => [price.tier, price.amountUsd])),
  }));
}

export type ServiceOffer = {
  service: PublicService;
  tierCode: string;
  country: string;
  amountUsdCents: number;
  usdLabel: string;
  currencyLocal: string;
  amountLocal: number | null;
  localLabel: string | null;
  netticketTicketCode: string | null;
};

/** The price of one service for one country, with the indicative local amount. */
export async function buildServiceOffer(code: ServiceCode, country: string): Promise<ServiceOffer | null> {
  const [service, tiers] = await Promise.all([
    prisma.service.findUnique({ where: { code }, include: { prices: true } }),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }),
  ]);
  if (!service || !service.active) return null;

  const tierCode = resolveTierCode(country, tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })));
  if (isQuoteOnly(tierCode)) return null;
  const price = service.prices.find((p) => p.tier === tierCode);
  if (!price) return null;

  const currencyLocal = localCurrencyFor(country);
  const amountLocal = convertUsdCents(price.amountUsd, currencyLocal, await loadRates());
  return {
    service: {
      code: service.code as ServiceCode,
      name: service.name,
      tagline: service.tagline,
      description: service.description.split("\n").filter(Boolean),
      deliverable: service.deliverable,
      sessionMinutes: service.sessionMinutes,
      sessions: service.sessions,
      creditable: service.creditable,
      durationLabel: formatDuration(service.sessions, service.sessionMinutes),
      prices: Object.fromEntries(service.prices.map((p) => [p.tier, p.amountUsd])),
    },
    tierCode,
    country,
    amountUsdCents: price.amountUsd,
    usdLabel: formatUsdCents(price.amountUsd),
    currencyLocal,
    amountLocal,
    localLabel: amountLocal !== null && currencyLocal !== "USD" ? formatLocal(amountLocal, currencyLocal) : null,
    netticketTicketCode: price.netticketTicketCode,
  };
}

/**
 * Opens a pending order, reusing a pending one for the same service and
 * method so a retried checkout does not multiply rows.
 */
export async function startServiceOrder(input: { leadId: number; code: ServiceCode; method: "stripe" | "netticket" }) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return { order: null, reason: "not_found" } as const;
  const offer = await buildServiceOffer(input.code, lead.country);
  if (!offer) return { order: null, reason: "unavailable" } as const;

  const existing = await prisma.serviceOrder.findFirst({
    where: { leadId: lead.id, serviceCode: input.code, method: input.method, status: { in: ["pending", "pending_manual"] } },
  });
  if (existing) return { order: existing, offer, lead } as const;

  const order = await prisma.serviceOrder.create({
    data: {
      leadId: lead.id,
      serviceCode: input.code,
      tier: offer.tierCode,
      amountUsd: offer.amountUsdCents,
      currencyLocal: offer.currencyLocal === "USD" ? null : offer.currencyLocal,
      amountLocal: offer.currencyLocal === "USD" ? null : offer.amountLocal,
      method: input.method,
      reference: newServiceReference(),
      sessionsTotal: offer.service.sessions,
      bookingToken: createToken(),
    },
  });
  await prisma.actionLog.create({ data: { leadId: lead.id, type: "service_order_started", payload: { orderId: order.id, service: input.code, method: input.method } } });
  return { order, offer, lead } as const;
}

export type PaidResult = { ok: true; alreadyPaid: boolean } | { ok: false; error: string };

/**
 * The only way an order becomes `paid`. Idempotent. Sends the e-mail that
 * carries the link to book the session(s).
 */
export async function markServiceOrderPaid(input: {
  reference: string;
  amountPaidUsdCents: number;
  paidAt: Date;
  stripeSessionId?: string;
  netticketTransactionId?: string;
}): Promise<PaidResult> {
  const order = await prisma.serviceOrder.findUnique({ where: { reference: input.reference }, include: { lead: true, service: true } });
  if (!order) return { ok: false, error: `Référence inconnue : ${input.reference}` };
  if (order.status === "paid") return { ok: true, alreadyPaid: true };

  if (input.amountPaidUsdCents < order.amountUsd) {
    await prisma.actionLog.create({
      data: { leadId: order.leadId, type: "payment_amount_mismatch", payload: { reference: input.reference, expected: order.amountUsd, received: input.amountPaidUsdCents } },
    });
    return { ok: false, error: `Montant reçu ${input.amountPaidUsdCents} < attendu ${order.amountUsd}` };
  }

  await prisma.$transaction([
    prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paidAt: input.paidAt,
        stripeSessionId: input.stripeSessionId ?? order.stripeSessionId,
        netticketTransactionId: input.netticketTransactionId ?? order.netticketTransactionId,
      },
    }),
    // A paying client is no longer a lead to chase; the session is the follow-up.
    prisma.lead.update({ where: { id: order.leadId }, data: { nextFollowupAt: null, status: order.lead.status === "registered" ? "registered" : "contacted" } }),
    prisma.actionLog.create({ data: { leadId: order.leadId, type: "service_paid", payload: { reference: input.reference, service: order.serviceCode, method: order.method } } }),
  ]);
  await recordEvent({ name: "service_paid", leadId: order.leadId, label: order.serviceCode, country: order.lead.country });

  const base = env.NEXT_PUBLIC_APP_URL;
  await sendEmail({
    to: order.lead.email,
    subject: `C'est réglé : ${order.service.name}`,
    text:
      `Bonjour ${order.lead.firstName},\n\n` +
      `Votre paiement de ${formatUsdCents(order.amountUsd)} pour « ${order.service.name} » est confirmé. Merci.\n\n` +
      `Choisissez maintenant ${order.sessionsTotal > 1 ? `le créneau de votre première séance (${order.sessionsTotal} séances de ${order.service.sessionMinutes} min au total)` : `le créneau de votre séance de ${order.service.sessionMinutes} minutes`} :\n` +
      `${base}/conseil/rdv/${order.bookingToken}\n\n` +
      `Ce lien est personnel ; gardez-le, il sert aussi à réserver les séances suivantes et à déplacer un rendez-vous (gratuit jusqu'à 24 h avant).\n` +
      `Référence : ${order.reference}\n\n` +
      (order.service.creditable ? `Si vous rejoignez le bootcamp CISSP dans les 90 jours, cette heure de conseil est déduite de son prix.\n\n` : "") +
      `À bientôt,\nBen\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${base}/desinscription/${order.lead.unsubscribeToken}`,
  });

  return { ok: true, alreadyPaid: false };
}

/** The order behind a booking link, with its service and sessions. */
export async function orderByBookingToken(token: string) {
  if (!token || token.length < 10) return null;
  return prisma.serviceOrder.findUnique({
    where: { bookingToken: token },
    include: { service: true, lead: { select: { id: true, firstName: true, lastName: true, email: true, country: true, unsubscribeToken: true } }, bookings: { where: { status: { in: ["scheduled", "done"] } }, orderBy: { startsAt: "asc" } } },
  });
}

export function sessionsBooked(order: { bookings: Array<{ status: string }> }): number {
  return order.bookings.length;
}

export type BookSessionResult = { ok: true; bookingId: number; rescheduleToken: string } | { ok: false; error: string };

/** Books the next session of a paid order on a consulting slot. */
export async function bookSession(input: { bookingToken: string; start: Date; timezone: string }): Promise<BookSessionResult> {
  const order = await orderByBookingToken(input.bookingToken);
  if (!order) return { ok: false, error: "Lien inconnu." };
  if (order.status !== "paid") return { ok: false, error: "Le paiement de cette séance n'est pas encore confirmé." };
  if (sessionsBooked(order) >= order.sessionsTotal) return { ok: false, error: "Toutes les séances de cette commande sont déjà réservées." };
  const upcoming = order.bookings.find((b) => b.status === "scheduled" && b.startsAt.getTime() > Date.now());
  if (upcoming) return { ok: false, error: "Vous avez déjà une séance à venir. Réservez la suivante une fois celle-ci passée, ou déplacez-la depuis votre e-mail." };

  const family = { kind: "consulting" as const, sessionMinutes: order.service.sessionMinutes };
  if (!(await isSlotBookable(input.start, new Date(), family))) {
    return { ok: false, error: "Ce créneau vient d'être pris ou n'est plus disponible. Choisissez-en un autre." };
  }

  const end = addMinutes(input.start, order.service.sessionMinutes);
  const number = sessionsBooked(order) + 1;
  const rescheduleToken = createToken();
  const lead = order.lead;

  let event;
  try {
    event = await createCallEvent({
      summary: `Conseil : ${order.service.name} — ${lead.firstName} ${lead.lastName}${order.sessionsTotal > 1 ? ` (${number}/${order.sessionsTotal})` : ""}`,
      description:
        `Séance de ${order.service.sessionMinutes} min, réglée (${order.reference}).\n` +
        `Fiche : ${env.NEXT_PUBLIC_APP_URL}/admin/leads/${lead.id}`,
      start: input.start,
      end,
      attendeeEmail: lead.email,
      attendeeName: `${lead.firstName} ${lead.lastName}`,
      requestId: randomUUID(),
    });
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) return { ok: false, error: "La réservation est momentanément fermée." };
    console.error("[consulting] création d'événement échouée", error);
    return { ok: false, error: "Impossible de créer le rendez-vous. Réessayez dans un instant." };
  }

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: { leadId: lead.id, kind: "consulting", serviceOrderId: order.id, googleEventId: event.eventId, meetUrl: event.meetUrl, startsAt: input.start, endsAt: end, timezone: input.timezone, rescheduleToken },
    });
    await tx.actionLog.create({ data: { leadId: lead.id, type: "session_booked", payload: { bookingId: created.id, orderId: order.id, number, startsAt: input.start } } });
    return created;
  });
  await recordServerEvent({ name: "service_booked", leadId: lead.id, label: order.serviceCode });

  const what = describeBooking({ kind: "consulting", startsAt: input.start, endsAt: end });
  await sendEmail({
    to: lead.email,
    subject: `C'est confirmé : ${formatWhen(input.start, input.timezone)}`,
    text:
      confirmationText({ firstName: lead.firstName, start: input.start, timezone: input.timezone, meetUrl: event.meetUrl, rescheduleToken, unsubscribeToken: lead.unsubscribeToken, what: `${what} (${order.service.name}${order.sessionsTotal > 1 ? `, séance ${number} sur ${order.sessionsTotal}` : ""})` }),
  });

  return { ok: true, bookingId: booking.id, rescheduleToken };
}

/** Paid orders with sessions still to book, for the coach's queue and the reminder. */
export async function ordersAwaitingBooking(now = new Date()) {
  const orders = await prisma.serviceOrder.findMany({
    where: { status: "paid" },
    include: { service: true, lead: { select: { id: true, firstName: true, lastName: true, email: true, whatsapp: true, unsubscribedAt: true } }, bookings: { where: { status: { in: ["scheduled", "done"] } }, orderBy: { startsAt: "asc" } } },
    orderBy: { paidAt: "asc" },
  });
  return orders
    .filter((order) => order.bookings.length < order.sessionsTotal && !order.bookings.some((b) => b.status === "scheduled" && b.startsAt.getTime() > now.getTime()))
    .map((order) => ({ ...order, sessionsBooked: order.bookings.length, daysSincePaid: order.paidAt ? Math.floor((now.getTime() - order.paidAt.getTime()) / 86_400_000) : 0 }));
}

export { formatDuration };
