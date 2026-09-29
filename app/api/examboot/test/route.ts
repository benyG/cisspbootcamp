import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ExamBootError, examBootEnabled } from "@/lib/examboot/client";
import { PLACEMENTS, leadFromTokens, testFor } from "@/lib/examboot/service";
import { POST_CODE_PATTERN } from "@/lib/marketing/plan";
import { VISITOR_COOKIE, VISITOR_COOKIE_DAYS, newVisitorId } from "@/lib/tracking/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  placement: z.enum(PLACEMENTS),
  t: z.string().min(10).max(120).optional(),
  b: z.string().min(10).max(120).optional(),
  /** The marketing post the visitor came from (utm_content). */
  c: z.string().regex(POST_CODE_PATTERN).optional(),
});

/**
 * Creates (or reuses) a practice test for the visitor and returns its code
 * and URL; the page opens the URL in a new tab and polls the code. The
 * ExamBoot key never leaves this server.
 */
export async function POST(request: NextRequest) {
  if (!examBootEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const leadId = await leadFromTokens({ resultToken: parsed.data.t, rescheduleToken: parsed.data.b });
  // A visitor straight from a post may not have the cookie yet: give it now,
  // so their score comes back to them and follows them to the analysis.
  const existing = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const visitorId = existing ?? newVisitorId();
  try {
    const link = await testFor({ placement: parsed.data.placement, leadId, visitorId, campaignCode: parsed.data.c ?? null });
    const response = NextResponse.json({ code: link.code, url: link.url, shared: link.shared });
    if (!existing) response.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: VISITOR_COOKIE_DAYS * 24 * 60 * 60 });
    return response;
  } catch (error) {
    const status = error instanceof ExamBootError && error.status === 429 ? 429 : 502;
    console.error("[examboot] création impossible", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "creation_failed" }, { status });
  }
}
