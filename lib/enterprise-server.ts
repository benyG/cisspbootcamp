import { randomBytes, randomUUID } from "node:crypto";

import { QUOTE_SEQUENCE, formatQuoteNumber } from "@/lib/admin-records";
import { issueReceipt } from "@/lib/admin-records-server";
import { type BookResult, bookingCode, confirmationText, describeBooking, formatWhen, isSlotBookable } from "@/lib/booking";
import { CalendarNotConnectedError, createCallEvent } from "@/lib/calendar/google";
import { addMinutes } from "@/lib/calendar/slots";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { IA_SIGNATURE, IA_TEAM } from "@/lib/ia-brand";
import { iaUrl } from "@/lib/ia-domain";
import { sendEmail } from "@/lib/messaging/email";
import { createCheckoutSession } from "@/lib/payments/stripe";
import { resolveTierCode } from "@/lib/pricing";
import { createToken } from "@/lib/tokens";
import { recordServerEvent } from "@/lib/tracking/server";

import {
  DEPOSIT_PREFIX,
  ENTERPRISE_OFFER_KEY,
  type EnterpriseOffer,
  type EnterpriseRequestInput,
  FUNCTIONS,
  type FunctionKey,
  type Proposal,
  SIZES,
  type SizeKey,
  type Zone,
  formatUsd,
  proposalSchema,
  proposalTotals,
  resolveOffer,
  splitName,
  zoneOfTier,
} from "./enterprise";

/**
 * Bâtisseur IA Entreprises at work: the catalogue, the request (and its
 * lead, with the consent given in the form), the 30-minute scoping call,
 * the numbered proposal and its deposit. Signed by the team, never by Ben.
 */

export const CALL_MINUTES = 30;
const CALL_FAMILY = { kind: "consulting" as const, sessionMinutes: CALL_MINUTES };

export async function loadOffer(): Promise<EnterpriseOffer> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: ENTERPRISE_OFFER_KEY } });
    return resolveOffer(row?.value);
  } catch {
    return resolveOffer(null);
  }
}

export async function saveOffer(offer: EnterpriseOffer): Promise<void> {
  await prisma.siteSetting.upsert({ where: { key: ENTERPRISE_OFFER_KEY }, create: { key: ENTERPRISE_OFFER_KEY, value: offer }, update: { value: offer } });
}

async function tiers() {
  const rows = await prisma.pricingTier.findMany({ select: { code: true, countries: true } }).catch(() => []);
  return rows.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] }));
}

/** The price zone of a country (Afrique francophone or International), from the pricing tiers. */
export async function zoneOf(country: string | null | undefined): Promise<Zone> {
  return zoneOfTier(resolveTierCode(country, await tiers()));
}

const base = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
export const callUrl = (token: string) => iaUrl(`/ia/entreprises/appel/${token}`, env.NEXT_PUBLIC_APP_URL);
export const depositUrl = (token: string) => iaUrl(`/ia/entreprises/acompte/${token}`, env.NEXT_PUBLIC_APP_URL);

/**
 * A company's request from the page. The contact becomes a lead (consent
 * given in the form, timestamped), linked to the request; Ben is told.
 */
export async function createRequest(input: EnterpriseRequestInput, now = new Date()): Promise<{ token: string }> {
  const tierList = await tiers();
  const tier = resolveTierCode(input.country, tierList);
  const existing = await prisma.lead.findUnique({ where: { email: input.email }, select: { id: true, consentAt: true, unsubscribedAt: true } });
  const { firstName, lastName } = splitName(input.contactName);
  const lead = existing
    ? await prisma.lead.update({ where: { id: existing.id }, data: { consentAt: existing.consentAt ?? now, ...(existing.unsubscribedAt ? { unsubscribedAt: null } : {}), jobTitle: input.jobTitle ?? undefined }, select: { id: true } })
    : await prisma.lead.create({
        data: { firstName, lastName, email: input.email, country: input.country, tier, consentAt: now, source: "entreprise_ia", jobTitle: input.jobTitle, goals: input.need, unsubscribeToken: createToken() },
        select: { id: true },
      });
  const token = createToken();
  const request = await prisma.enterpriseRequest.create({
    data: { token, leadId: lead.id, organization: input.organization, country: input.country, contactName: input.contactName, jobTitle: input.jobTitle, email: input.email, size: input.size, functions: input.functions, need: input.need, consentAt: now },
  });
  await prisma.actionLog.create({ data: { leadId: lead.id, type: "enterprise_request", payload: { requestId: request.id, organization: input.organization } } });
  await recordServerEvent({ name: "enterprise_request", leadId: lead.id, label: input.size });
  await sendEmail({
    to: env.ADMIN_EMAIL,
    replyTo: input.email,
    subject: `Bâtisseur IA Entreprises : ${input.organization} (${SIZES[input.size as SizeKey]})`,
    text:
      `${input.contactName}${input.jobTitle ? `, ${input.jobTitle}` : ""} · ${input.organization} · ${input.country}\n` +
      `${input.email}\n\n` +
      `À traiter : ${input.functions.map((f) => FUNCTIONS[f as FunctionKey]).join(", ") || "non précisé"}\n` +
      (input.need ? `Besoin : ${input.need}\n` : "") +
      `\nLa demande : ${base()}/admin/entreprises/${request.id}`,
  }).catch((error) => console.error("[entreprises] e-mail", error));
  return { token };
}

export async function requestByToken(token: string) {
  if (!token || token.length > 64) return null;
  return prisma.enterpriseRequest.findUnique({
    where: { token },
    include: { lead: { select: { id: true, firstName: true, unsubscribeToken: true, bookings: { where: { kind: "enterprise" }, orderBy: { startsAt: "desc" }, take: 1 } } } },
  });
}

export const listCallSlots = (now = new Date()) => import("@/lib/booking").then((b) => b.listSlots(now, CALL_FAMILY));

/** The 30-minute scoping call, booked from the link after the request. */
export async function bookEnterpriseCall(input: { token: string; start: Date; timezone: string }): Promise<BookResult> {
  const request = await requestByToken(input.token);
  if (!request?.leadId || !request.lead) return { ok: false, error: "Demande introuvable." };
  const upcoming = await prisma.booking.findFirst({ where: { leadId: request.leadId, kind: "enterprise", status: "scheduled", startsAt: { gt: new Date() } } });
  if (upcoming) return { ok: false, error: "Un appel est déjà prévu. Utilisez le lien reçu par e-mail pour le déplacer." };
  if (!(await isSlotBookable(input.start, new Date(), CALL_FAMILY))) return { ok: false, error: "Ce créneau vient d’être pris. Choisissez-en un autre." };

  const end = addMinutes(input.start, CALL_MINUTES);
  let event;
  try {
    event = await createCallEvent({
      summary: `Appel de cadrage Bâtisseur IA — ${request.organization}`,
      description: `${request.contactName} (${request.organization}, ${request.country}).\nLa demande : ${base()}/admin/entreprises/${request.id}`,
      start: input.start,
      end,
      attendeeEmail: request.email,
      attendeeName: request.contactName,
      requestId: randomUUID(),
    });
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) return { ok: false, error: "La prise de rendez-vous est momentanément fermée." };
    console.error("[entreprises] événement", error);
    return { ok: false, error: "Impossible de créer le rendez-vous. Réessayez dans un instant." };
  }

  const rescheduleToken = createToken();
  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({ data: { leadId: request.leadId!, kind: "enterprise", googleEventId: event.eventId, meetUrl: event.meetUrl, startsAt: input.start, endsAt: end, timezone: input.timezone, rescheduleToken } });
    if (request.status === "new") await tx.enterpriseRequest.update({ where: { id: request.id }, data: { status: "call" } });
    await tx.actionLog.create({ data: { leadId: request.leadId, type: "enterprise_call_booked", payload: { requestId: request.id, bookingId: created.id, startsAt: input.start } } });
    return created;
  });

  const what = describeBooking({ kind: "enterprise", startsAt: input.start, endsAt: end });
  await Promise.allSettled([
    sendEmail({
      to: request.email,
      fromName: IA_TEAM,
      subject: `C’est confirmé : ${formatWhen(input.start, input.timezone)} · ${bookingCode(booking.id)}`,
      text: confirmationText({ firstName: request.lead.firstName, start: input.start, timezone: input.timezone, meetUrl: event.meetUrl, rescheduleToken, unsubscribeToken: request.lead.unsubscribeToken, code: bookingCode(booking.id), what, signature: IA_SIGNATURE }),
    }),
    sendEmail({
      to: env.ADMIN_EMAIL,
      subject: `Appel de cadrage : ${request.organization}, ${formatWhen(input.start, "Africa/Abidjan")} (Abidjan)`,
      text: `${request.contactName}, ${request.organization}.\n${event.meetUrl ? `Visio : ${event.meetUrl}\n` : ""}La demande : ${base()}/admin/entreprises/${request.id}`,
    }),
  ]);
  return { ok: true, bookingId: booking.id, rescheduleToken };
}

/** Saves the proposal; the first save gives it its DEV number, from the training quotes' sequence. */
export async function saveProposal(id: number, raw: unknown): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Proposition invalide." };
  const number = await prisma.$transaction(async (tx) => {
    const r = await tx.enterpriseRequest.findUnique({ where: { id }, select: { quoteNumber: true, status: true, depositPaidAt: true } });
    if (!r) throw new Error("Demande introuvable.");
    let n = r.quoteNumber;
    if (!n) {
      const seq = await tx.sequence.upsert({ where: { name: QUOTE_SEQUENCE }, create: { name: QUOTE_SEQUENCE, value: 1 }, update: { value: { increment: 1 } } });
      n = formatQuoteNumber(seq.value);
    }
    // A proposal changed after the deposit keeps the deposit asked; before it, the deposit follows the proposal.
    await tx.enterpriseRequest.update({ where: { id }, data: { proposal: parsed.data, quoteNumber: n, ...(r.status === "won" || r.status === "lost" ? {} : { status: "proposal" }) } });
    return n;
  });
  return { ok: true, number };
}

export function readProposal(raw: unknown): Proposal | null {
  const parsed = proposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** CE-7K3M-9QXZ: the deposit's reference, carried through Stripe. */
export function newDepositReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]);
  return `${DEPOSIT_PREFIX}${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** The deposit asked with the saved proposal: its amount fixed now, and the payment page's link. */
export async function prepareDeposit(id: number, offer: EnterpriseOffer): Promise<{ ok: true; url: string; amount: string } | { ok: false; error: string }> {
  const r = await prisma.enterpriseRequest.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  if (r.depositPaidAt) return { ok: false, error: "L’acompte est déjà réglé." };
  const proposal = readProposal(r.proposal);
  if (!proposal || !r.quoteNumber) return { ok: false, error: "Enregistrez d’abord la proposition." };
  const { depositUsd } = proposalTotals(proposal, offer);
  if (depositUsd <= 0) return { ok: false, error: "Rien à payer dans cette proposition." };
  await prisma.enterpriseRequest.update({ where: { id }, data: { depositUsd, depositReference: r.depositReference ?? newDepositReference() } });
  return { ok: true, url: depositUrl(r.token), amount: formatUsd(depositUsd) };
}

/** The client clicks « Payer » on the deposit page: a Stripe card checkout for the deposit. */
export async function startDepositCheckout(token: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await requestByToken(token);
  if (!r?.depositUsd || !r.depositReference || !r.quoteNumber) return { ok: false, error: "Aucun acompte à régler pour cette proposition." };
  if (r.depositPaidAt) return { ok: false, error: "L’acompte est déjà réglé. Merci." };
  const checkout = await createCheckoutSession({
    reference: r.depositReference,
    registrationId: r.id,
    amountUsdCents: r.depositUsd,
    productName: `Bâtisseur IA Entreprises — acompte`,
    description: `Acompte de la proposition ${r.quoteNumber} pour ${r.organization}.`,
    customerEmail: r.email,
    successUrl: `${depositUrl(r.token)}?merci=1`,
    cancelUrl: `${depositUrl(r.token)}?annule=1`,
  });
  await prisma.enterpriseRequest.update({ where: { id: r.id }, data: { depositStripeSessionId: checkout.id } });
  return { ok: true, url: checkout.url };
}

type Paid = { ok: true; alreadyPaid: boolean } | { ok: false; error: string };

/**
 * The only ways a deposit becomes paid: the verified Stripe webhook, or Ben
 * confirming a transfer by hand. Idempotent; the receipt is numbered at once.
 */
export async function markDepositPaid(input: { reference: string; amountPaidUsdCents: number; paidAt: Date; stripeSessionId?: string; manualNote?: string }): Promise<Paid> {
  const r = await prisma.enterpriseRequest.findUnique({ where: { depositReference: input.reference } });
  if (!r || !r.depositUsd) return { ok: false, error: `Référence d’acompte inconnue : ${input.reference}` };
  if (r.depositPaidAt) return { ok: true, alreadyPaid: true };
  if (!input.manualNote && input.amountPaidUsdCents < r.depositUsd) {
    await prisma.actionLog.create({ data: { leadId: r.leadId, type: "payment_amount_mismatch", payload: { reference: input.reference, expected: r.depositUsd, received: input.amountPaidUsdCents } } });
    return { ok: false, error: `Montant reçu ${input.amountPaidUsdCents} < attendu ${r.depositUsd}` };
  }
  await prisma.$transaction([
    prisma.enterpriseRequest.update({
      where: { id: r.id },
      data: { depositPaidAt: input.paidAt, depositMethod: input.manualNote ? "manual" : "stripe", depositNote: input.manualNote ?? null, status: "won", ...(input.stripeSessionId ? { depositStripeSessionId: input.stripeSessionId } : {}) },
    }),
    prisma.actionLog.create({ data: { leadId: r.leadId, type: "enterprise_deposit_paid", payload: { requestId: r.id, reference: input.reference, amountUsd: r.depositUsd, method: input.manualNote ? "manual" : "stripe" } } }),
  ]);
  await issueReceipt("enterprise", r.id);
  await recordServerEvent({ name: "enterprise_won", leadId: r.leadId ?? undefined, label: r.quoteNumber ?? undefined });
  await Promise.allSettled([
    sendEmail({
      to: r.email,
      fromName: IA_TEAM,
      subject: `Acompte reçu · ${r.quoteNumber ?? "Bâtisseur IA"}`,
      text: `Bonjour ${splitName(r.contactName).firstName},\n\nNous avons bien reçu votre acompte de ${formatUsd(r.depositUsd)} pour la proposition ${r.quoteNumber}. Merci de votre confiance.\n\nNous revenons vers vous sous 48 heures pour fixer l’atelier de démarrage avec votre référent.\n\n${IA_SIGNATURE}`,
    }),
    sendEmail({ to: env.ADMIN_EMAIL, subject: `Acompte reçu : ${r.organization} (${formatUsd(r.depositUsd)})`, text: `La demande : ${base()}/admin/entreprises/${r.id}` }),
  ]);
  return { ok: true, alreadyPaid: false };
}
