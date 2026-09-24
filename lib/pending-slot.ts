import { cookies } from "next/headers";
import { z } from "zod";

/**
 * "Book first, then your profile" (Ben, 24/09/2026): the slot a visitor
 * picked before the questionnaire, kept in a short-lived cookie until the
 * profile is in and the booking can be made in their name. Never trusted
 * as a booking: the slot is re-validated when it is actually booked.
 */
export const PENDING_SLOT_COOKIE = "cb_slot";
export const PENDING_SLOT_MINUTES = 60;

const schema = z.object({
  start: z.string().datetime(),
  timezone: z.string().min(1).max(64),
  kind: z.enum(["discovery", "consulting"]),
  /** Service code for a consulting session. */
  service: z.string().max(32).optional(),
});

export type PendingSlot = z.infer<typeof schema>;

export async function setPendingSlot(slot: PendingSlot): Promise<void> {
  const jar = await cookies();
  jar.set(PENDING_SLOT_COOKIE, JSON.stringify(slot), { httpOnly: true, sameSite: "lax", path: "/", maxAge: PENDING_SLOT_MINUTES * 60 });
}

export async function readPendingSlot(): Promise<PendingSlot | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_SLOT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    // A slot in the past is no slot.
    if (new Date(parsed.data.start).getTime() < Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function clearPendingSlot(): Promise<void> {
  const jar = await cookies();
  jar.delete(PENDING_SLOT_COOKIE);
}
