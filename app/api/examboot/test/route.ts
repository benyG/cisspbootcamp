import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ExamBootError, examBootEnabled } from "@/lib/examboot/client";
import { PLACEMENTS, leadFromTokens, testFor } from "@/lib/examboot/service";
import { VISITOR_COOKIE } from "@/lib/tracking/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  placement: z.enum(PLACEMENTS),
  t: z.string().min(10).max(120).optional(),
  b: z.string().min(10).max(120).optional(),
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
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  try {
    const link = await testFor({ placement: parsed.data.placement, leadId, visitorId });
    return NextResponse.json({ code: link.code, url: link.url, shared: link.shared });
  } catch (error) {
    const status = error instanceof ExamBootError && error.status === 429 ? 429 : 502;
    console.error("[examboot] création impossible", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "creation_failed" }, { status });
  }
}
