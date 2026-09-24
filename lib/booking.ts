import { randomUUID } from "node:crypto";

import { CalendarNotConnectedError, cancelCallEvent, createCallEvent, fetchBusy, getCredential, moveCallEvent } from "@/lib/calendar/google";
import {
  type AvailabilityRule,
  DISCOVERY_SHAPE,
  MIN_NOTICE_HOURS,
  SLOT_MINUTES,
  type SlotShape,
  addMinutes,
  computeSlots,
  consultingShape,
  formatSlotTime,
} from "@/lib/calendar/slots";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { sendEmail } from "@/lib/messaging/email";
import { createToken } from "@/lib/tokens";
import { recordServerEvent } from "@/lib/tracking/server";

/**
 * Discovery-call booking — SPECS A3. Ties the pure slot maths to Google
 * Calendar and the database, and sends the confirmations.
 */

export type SlotListing =
  | { available: true; slots: Date[]; coachTimeZone: string }
  | { available: false; reason: "not_connected" | "no_rules" };

export type BookingKind = "discovery" | "consulting";

/** Which windows and which slot length: the free call, or a paid session of N minutes. */
export type SlotFamily = { kind: "discovery" } | { kind: "consulting"; sessionMinutes: number };

const DISCOVERY: SlotFamily = { kind: "discovery" };

function shapeFor(family: SlotFamily): SlotShape {
  return family.kind === "consulting" ? consultingShape(family.sessionMinutes) : DISCOVERY_SHAPE;
}

/**
 * Live slots: rules of that family from the DB, busy intervals from Google
 * (which include every booking of the other family), right now.
 */
export async function listSlots(now = new Date(), family: SlotFamily = DISCOVERY): Promise<SlotListing> {
  const credential = await getCredential();
  if (!credential) return { available: false, reason: "not_connected" };

  const rules: AvailabilityRule[] = await prisma.availabilityRule.findMany({ where: { kind: family.kind } });
  if (rules.length === 0) return { available: false, reason: "no_rules" };

  const shape = shapeFor(family);
  const busy = await fetchBusy({
    start: now,
    end: addMinutes(now, (shape.maxDaysAhead + 1) * 24 * 60),
  });

  return {
    available: true,
    slots: computeSlots({ rules, coachTimeZone: credential.timeZone, busy, now, shape }),
    coachTimeZone: credential.timeZone,
  };
}

/** True when `start` is one of the slots computed right now — never trust the client. */
export async function isSlotBookable(start: Date, now = new Date(), family: SlotFamily = DISCOVERY): Promise<boolean> {
  const listing = await listSlots(now, family);
  if (!listing.available) return false;
  return listing.slots.some((slot) => slot.getTime() === start.getTime());
}

/** The family a stored booking belongs to, from its kind and its length. */
export function familyOf(booking: { kind: BookingKind; startsAt: Date; endsAt: Date }): SlotFamily {
  if (booking.kind !== "consulting") return DISCOVERY;
  return { kind: "consulting", sessionMinutes: Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000) };
}

/** "notre appel de 15 minutes" or "notre séance de conseil de 60 minutes". */
export function describeBooking(booking: { kind: BookingKind; startsAt: Date; endsAt: Date }): string {
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);
  return booking.kind === "consulting" ? `notre séance de conseil de ${minutes} minutes` : "notre appel de 15 minutes";
}

export function formatWhen(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return `${day} à ${formatSlotTime(date, timeZone)}`;
}

export type BookResult =
  | { ok: true; bookingId: number; rescheduleToken: string }
  | { ok: false; error: string };

export async function bookCall(input: {
  leadId: number;
  start: Date;
  timezone: string;
}): Promise<BookResult> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return { ok: false, error: "Profil introuvable." };
  if (lead.unsubscribedAt) return { ok: false, error: "Ce profil s'est désinscrit." };

  const existing = await prisma.booking.findFirst({
    where: { leadId: lead.id, status: "scheduled", startsAt: { gt: new Date() } },
  });
  if (existing) {
    return { ok: false, error: "Vous avez déjà un appel prévu. Utilisez le lien reçu par e-mail pour le modifier." };
  }

  if (!(await isSlotBookable(input.start))) {
    return { ok: false, error: "Ce créneau vient d'être pris ou n'est plus disponible. Choisissez-en un autre." };
  }

  const end = addMinutes(input.start, SLOT_MINUTES);
  const rescheduleToken = createToken();

  let event;
  try {
    event = await createCallEvent({
      summary: `Appel découverte CISSP — ${lead.firstName} ${lead.lastName}`,
      description:
        `Appel de 15 min avec ${lead.firstName} ${lead.lastName} (${lead.country}).\n` +
        `Fiche : ${env.NEXT_PUBLIC_APP_URL}/admin/leads/${lead.id}`,
      start: input.start,
      end,
      attendeeEmail: lead.email,
      attendeeName: `${lead.firstName} ${lead.lastName}`,
      requestId: randomUUID(),
    });
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) {
      return { ok: false, error: "La réservation est momentanément fermée." };
    }
    console.error("[booking] création d'événement échouée", error);
    return { ok: false, error: "Impossible de créer le rendez-vous. Réessayez dans un instant." };
  }

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        leadId: lead.id,
        googleEventId: event.eventId,
        meetUrl: event.meetUrl,
        startsAt: input.start,
        endsAt: end,
        timezone: input.timezone,
        rescheduleToken,
      },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "booked", nextFollowupAt: null },
    });
    await tx.actionLog.create({
      data: { leadId: lead.id, type: "call_booked", payload: { bookingId: created.id, startsAt: input.start } },
    });
    return created;
  });

  await recordServerEvent({ name: "booking_done", leadId: lead.id, label: lead.source });

  await sendEmail({
    to: lead.email,
    subject: `C'est confirmé : ${formatWhen(input.start, input.timezone)}`,
    text: confirmationText({ firstName: lead.firstName, start: input.start, timezone: input.timezone, meetUrl: event.meetUrl, rescheduleToken, unsubscribeToken: lead.unsubscribeToken }),
  });

  return { ok: true, bookingId: booking.id, rescheduleToken };
}

export async function rescheduleCall(input: { rescheduleToken: string; start: Date; timezone: string }): Promise<BookResult> {
  const booking = await prisma.booking.findUnique({
    where: { rescheduleToken: input.rescheduleToken },
    include: { lead: true },
  });
  if (!booking || booking.status !== "scheduled") return { ok: false, error: "Ce rendez-vous ne peut plus être modifié." };
  const family = familyOf(booking);
  if (!(await isSlotBookable(input.start, new Date(), family))) {
    return { ok: false, error: "Ce créneau n'est plus disponible. Choisissez-en un autre." };
  }

  const end = addMinutes(input.start, family.kind === "consulting" ? family.sessionMinutes : SLOT_MINUTES);
  if (booking.googleEventId) {
    try {
      await moveCallEvent(booking.googleEventId, input.start, end);
    } catch (error) {
      console.error("[booking] déplacement échoué", error);
      return { ok: false, error: "Impossible de déplacer le rendez-vous. Réessayez dans un instant." };
    }
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { startsAt: input.start, endsAt: end, timezone: input.timezone, remindedAt24h: null, remindedAt1h: null },
    }),
    prisma.actionLog.create({
      data: { leadId: booking.leadId, type: "call_rescheduled", payload: { bookingId: booking.id, startsAt: input.start } },
    }),
  ]);

  await sendEmail({
    to: booking.lead.email,
    subject: `Nouveau créneau : ${formatWhen(input.start, input.timezone)}`,
    text: confirmationText({ firstName: booking.lead.firstName, start: input.start, timezone: input.timezone, meetUrl: booking.meetUrl, rescheduleToken: booking.rescheduleToken, unsubscribeToken: booking.lead.unsubscribeToken, what: describeBooking({ ...booking, startsAt: input.start, endsAt: end }) }),
  });

  return { ok: true, bookingId: booking.id, rescheduleToken: booking.rescheduleToken };
}

export async function cancelCall(rescheduleToken: string): Promise<{ ok: boolean; error?: string }> {
  const booking = await prisma.booking.findUnique({ where: { rescheduleToken }, include: { lead: true } });
  if (!booking || booking.status !== "scheduled") return { ok: false, error: "Ce rendez-vous ne peut plus être annulé." };

  if (booking.googleEventId) {
    try {
      await cancelCallEvent(booking.googleEventId);
    } catch (error) {
      console.error("[booking] annulation Google échouée", error);
    }
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled" } }),
    // Back to the follow-up loop: a cancelled call is a lead to re-engage in
    // 2 days. A cancelled consulting session keeps its paid order: the
    // session is simply booked again from the same link.
    ...(booking.kind === "discovery"
      ? [prisma.lead.update({ where: { id: booking.leadId }, data: { status: "contacted", nextFollowupAt: addMinutes(new Date(), 2 * 24 * 60) } })]
      : []),
    prisma.actionLog.create({ data: { leadId: booking.leadId, type: booking.kind === "consulting" ? "session_cancelled" : "call_cancelled", payload: { bookingId: booking.id } } }),
  ]);

  return { ok: true };
}

export function confirmationText(input: {
  firstName: string;
  start: Date;
  timezone: string;
  meetUrl: string | null;
  rescheduleToken: string;
  unsubscribeToken: string;
  /** "notre appel de 15 minutes" by default. */
  what?: string;
}): string {
  const base = env.NEXT_PUBLIC_APP_URL;
  const what = input.what ?? "notre appel de 15 minutes";
  return (
    `Bonjour ${input.firstName},\n\n` +
    `${what.charAt(0).toUpperCase()}${what.slice(1)} est fixé${what.includes("séance") ? "e" : ""} au ${formatWhen(input.start, input.timezone)} (heure de ${input.timezone}).\n\n` +
    (input.meetUrl ? `Lien de visio : ${input.meetUrl}\n\n` : "Le lien de visio est dans l'invitation d'agenda.\n\n") +
    `Un empêchement ? Déplacer ou annuler : ${base}/rdv/${input.rescheduleToken}\n\n` +
    `À très vite,\nBen\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${base}/desinscription/${input.unsubscribeToken}`
  );
}

export const REMINDER_24H_MINUTES = 24 * 60;
export const REMINDER_1H_MINUTES = 60;

/**
 * Called by the cron every 15 minutes. Sends the 24 h and 1 h reminders due
 * since the last run, once each, and only for calls still scheduled.
 */
export async function sendDueReminders(now = new Date()): Promise<{ sent24h: number; sent1h: number }> {
  const inRange = (minutes: number) => ({
    gte: now,
    lte: addMinutes(now, minutes),
  });

  const [due24h, due1h] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "scheduled", remindedAt24h: null, startsAt: inRange(REMINDER_24H_MINUTES) },
      include: { lead: true },
    }),
    prisma.booking.findMany({
      where: { status: "scheduled", remindedAt1h: null, startsAt: inRange(REMINDER_1H_MINUTES) },
      include: { lead: true },
    }),
  ]);

  let sent24h = 0;
  for (const booking of due24h) {
    if (booking.lead.unsubscribedAt) continue;
    const result = await sendEmail({
      to: booking.lead.email,
      subject: booking.kind === "consulting" ? "Demain : notre séance de conseil" : "Demain : notre appel de 15 minutes",
      text: reminderText(booking, "demain"),
    });
    if (result.sent) {
      await prisma.booking.update({ where: { id: booking.id }, data: { remindedAt24h: now } });
      sent24h++;
    }
  }

  let sent1h = 0;
  for (const booking of due1h) {
    if (booking.lead.unsubscribedAt) continue;
    const result = await sendEmail({
      to: booking.lead.email,
      subject: booking.kind === "consulting" ? "Dans une heure : notre séance" : "Dans une heure : notre appel",
      text: reminderText(booking, "dans une heure"),
    });
    if (result.sent) {
      await prisma.booking.update({ where: { id: booking.id }, data: { remindedAt1h: now } });
      sent1h++;
    }
  }

  return { sent24h, sent1h };
}

function reminderText(
  booking: { kind: BookingKind; startsAt: Date; endsAt: Date; timezone: string; meetUrl: string | null; rescheduleToken: string; lead: { firstName: string; unsubscribeToken: string } },
  when: string,
): string {
  const base = env.NEXT_PUBLIC_APP_URL;
  return (
    `Bonjour ${booking.lead.firstName},\n\n` +
    `Petit rappel : ${describeBooking(booking)} a lieu ${when}, ${formatWhen(booking.startsAt, booking.timezone)} (heure de ${booking.timezone}).\n\n` +
    (booking.meetUrl ? `Lien de visio : ${booking.meetUrl}\n\n` : "") +
    (when === "demain" && booking.kind === "discovery" && examBootEnabled()
      ? `Avant l'appel, si vous avez dix minutes : cinq vraies questions d'examen, pour que je cale mes conseils sur votre niveau. ${base}/test-cissp?b=${booking.rescheduleToken}&from=rappel-24h\n\n`
      : "") +
    `Un empêchement ? ${base}/rdv/${booking.rescheduleToken}\n\n` +
    `Ben\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${base}/desinscription/${booking.lead.unsubscribeToken}`
  );
}

export { MIN_NOTICE_HOURS };
