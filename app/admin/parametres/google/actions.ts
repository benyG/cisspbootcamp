"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { STATE_COOKIE, consentUrl } from "@/lib/calendar/google";
import { prisma } from "@/lib/db";
import { createToken } from "@/lib/tokens";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

/** Starts the consent flow: mints a state, parks it in a cookie, redirects. */
export async function startGoogleConnect(): Promise<never> {
  await requireAdmin();
  const state = createToken();
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  redirect(consentUrl(state));
}

export async function disconnectGoogle(): Promise<void> {
  await requireAdmin();
  await prisma.googleCredential.deleteMany({ where: { id: 1 } });
  revalidatePath("/admin/parametres/google");
}

const timeZoneSchema = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, "Fuseau horaire inconnu");

export async function updateCalendarSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ timeZone: timeZoneSchema, calendarId: z.string().trim().min(1).max(255) })
    .safeParse({ timeZone: formData.get("timeZone"), calendarId: formData.get("calendarId") });
  if (!parsed.success) return;

  await prisma.googleCredential.update({ where: { id: 1 }, data: parsed.data });
  revalidatePath("/admin/parametres/google");
}

const ruleSchema = z.object({
  kind: z.enum(["discovery", "consulting"]).default("discovery"),
  weekday: z.coerce.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((rule) => rule.start < rule.end, "L'heure de fin doit suivre l'heure de début");

export async function addAvailabilityRule(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = ruleSchema.safeParse({
    kind: formData.get("kind") ?? "discovery",
    weekday: formData.get("weekday"),
    start: formData.get("start"),
    end: formData.get("end"),
  });
  if (!parsed.success) return;

  await prisma.availabilityRule.create({ data: parsed.data });
  revalidatePath("/admin/parametres/google");
}

export async function removeAvailabilityRule(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.availabilityRule.delete({ where: { id: id.data } });
  revalidatePath("/admin/parametres/google");
}
