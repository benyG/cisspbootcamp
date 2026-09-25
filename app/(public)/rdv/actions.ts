"use server";

import { z } from "zod";

import { redirect } from "next/navigation";

import { type BookResult, bookCall, cancelCall, isSlotBookable, rescheduleCall } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { readPendingSlot, setPendingSlot } from "@/lib/pending-slot";
import { formatKey, isServiceCode, parseFormatKey } from "@/lib/services";
import { resolveTierCode } from "@/lib/pricing";
import { createToken } from "@/lib/tokens";

const timeZone = z.string().min(1).max(64);
const instant = z.string().datetime();

/** Booking for a prospect who came through the scanner (result token). */
export async function bookWithResultToken(input: { token: string; start: string; timezone: string }): Promise<BookResult> {
  const parsed = z.object({ token: z.string().min(10), start: instant, timezone: timeZone }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };

  const response = await prisma.scannerResponse.findUnique({
    where: { resultToken: parsed.data.token },
    select: { leadId: true },
  });
  if (!response) return { ok: false, error: "Lien inconnu. Repassez par votre analyse." };

  return bookCall({ leadId: response.leadId, start: new Date(parsed.data.start), timezone: parsed.data.timezone });
}

const directSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(180),
  country: z.string().length(2).default("ZZ"),
  consent: z.literal(true, { errorMap: () => ({ message: "Votre accord est nécessaire." }) }),
  start: instant,
  timezone: timeZone,
});

/**
 * Direct access from a link Ben shares (SPECS A3): creates a minimal lead.
 * The prospect is nudged to the scanner afterwards from the confirmation.
 */
export async function bookDirect(input: z.input<typeof directSchema>): Promise<BookResult> {
  const parsed = directSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };

  const { firstName, lastName, email, country, start, timezone } = parsed.data;
  const tiers = await prisma.pricingTier.findMany({ select: { code: true, countries: true } });
  const tier = resolveTierCode(
    country,
    tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] })),
  );

  const lead = await prisma.lead.upsert({
    where: { email },
    create: { firstName, lastName, email, country, tier, consentAt: new Date(), source: "direct_link", unsubscribeToken: createToken() },
    update: { firstName, lastName, consentAt: new Date(), unsubscribedAt: null },
  });

  return bookCall({ leadId: lead.id, start: new Date(start), timezone });
}

export async function rescheduleWithToken(input: { rescheduleToken: string; start: string; timezone: string }): Promise<BookResult> {
  const parsed = z.object({ rescheduleToken: z.string().min(10), start: instant, timezone: timeZone }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  return rescheduleCall({ ...parsed.data, start: new Date(parsed.data.start) });
}

export async function cancelWithToken(rescheduleToken: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof rescheduleToken !== "string" || rescheduleToken.length < 10) return { ok: false, error: "Demande invalide." };
  return cancelCall(rescheduleToken);
}

/**
 * Book first, profile next (Ben, 24/09/2026): the visitor picks the slot,
 * it is kept in a cookie, and the questionnaire confirms it in their name.
 * The slot is re-validated at that moment, so nothing is promised here.
 */
export async function holdSlotThenProfile(input: { start: string; timezone: string }): Promise<BookResult> {
  const parsed = z.object({ start: instant, timezone: timeZone }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  if (!(await isSlotBookable(new Date(parsed.data.start)))) {
    return { ok: false, error: "Ce créneau vient d'être pris. Choisissez-en un autre." };
  }
  await setPendingSlot({ start: parsed.data.start, timezone: parsed.data.timezone, kind: "discovery" });
  redirect("/scanner?suite=rdv");
}

/**
 * Paid path (Ben, 24/09, evening): the visitor chose a format (duration and
 * number of sessions), then a slot for it. The slot is kept in the cookie
 * and the palette of services of that format opens next, with prices.
 */
export async function holdConsultingFormatSlot(input: { format: string; token?: string; start: string; timezone: string }): Promise<BookResult> {
  const parsed = z.object({ format: z.string().max(16), token: z.string().max(200).optional(), start: instant, timezone: timeZone }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const shape = parseFormatKey(parsed.data.format);
  if (!shape) return { ok: false, error: "Format inconnu." };
  if (!(await isSlotBookable(new Date(parsed.data.start), new Date(), { kind: "consulting", sessionMinutes: shape.sessionMinutes }))) {
    return { ok: false, error: "Ce créneau vient d'être pris. Choisissez-en un autre." };
  }
  await setPendingSlot({ start: parsed.data.start, timezone: parsed.data.timezone, kind: "consulting", format: parsed.data.format });
  const t = parsed.data.token && parsed.data.token.length >= 10 ? `?t=${encodeURIComponent(parsed.data.token)}` : "";
  redirect(`/rdv/conseil${t}`);
}

/**
 * The service picked from the palette: it must belong to the format the
 * slot was chosen for. A known prospect goes to payment, a new one to the
 * questionnaire, which then leads to payment.
 */
export async function chooseConsultingService(input: { code: string; token?: string }): Promise<{ ok: false; error: string } | never> {
  const parsed = z.object({ code: z.string().refine(isServiceCode, "Service inconnu"), token: z.string().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Service inconnu." };
  const pending = await readPendingSlot();
  if (!pending || pending.kind !== "consulting" || !pending.format) return { ok: false, error: "Choisissez d'abord un créneau." };
  const service = await prisma.service.findUnique({ where: { code: parsed.data.code }, select: { sessionMinutes: true, sessions: true, active: true } });
  if (!service || !service.active || formatKey(service.sessionMinutes, service.sessions) !== pending.format) return { ok: false, error: "Cette séance ne correspond pas au créneau choisi." };
  await setPendingSlot({ ...pending, service: parsed.data.code });
  const token = parsed.data.token && parsed.data.token.length >= 10 ? parsed.data.token : undefined;
  const known = token ? await prisma.scannerResponse.findUnique({ where: { resultToken: token }, select: { id: true } }) : null;
  redirect(known ? `/conseil/${parsed.data.code}?t=${encodeURIComponent(token as string)}` : "/scanner?suite=conseil");
}
