import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { CLIENT_EVENTS, EVENT_NAMES } from "@/lib/tracking/events";
import { VISITOR_COOKIE, VISITOR_COOKIE_DAYS, newVisitorId, recordEvent } from "@/lib/tracking/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.enum(EVENT_NAMES),
  step: z.number().int().min(1).max(50).optional(),
  label: z.string().max(160).optional(),
  path: z.string().max(200).optional(),
  utm: z
    .object({ source: z.string().max(120).optional(), medium: z.string().max(120).optional(), campaign: z.string().max(120).optional() })
    .optional(),
});

/**
 * Browser events land here. The visitor cookie is set on first contact.
 * Server-only events (paid, booking_done…) are refused: they are recorded
 * by the code that knows they happened, never on the browser's word.
 */
export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success || !CLIENT_EVENTS.includes(parsed.data.name)) return NextResponse.json({ ok: false }, { status: 400 });

  const existing = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const visitorId = existing ?? newVisitorId();
  let { name } = parsed.data;
  const { step, label, utm } = parsed.data;

  // A second look at a result is a stronger signal than the first (§4).
  if (name === "result_view" && label && existing) {
    const seen = await prisma.funnelEvent.count({ where: { visitorId, name: { in: ["result_view", "result_return"] }, label } }).catch(() => 0);
    if (seen > 0) name = "result_return";
  }

  await recordEvent({ name, visitorId, step: step ?? null, label: label ?? null, utm: utm ?? null });

  const response = NextResponse.json({ ok: true });
  if (!existing) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_DAYS * 24 * 60 * 60,
    });
  }
  return response;
}
