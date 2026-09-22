import { NextResponse, type NextRequest } from "next/server";

import { examBootEnabled } from "@/lib/examboot/client";
import { latestTestFor, leadFromTokens } from "@/lib/examboot/service";
import { VISITOR_COOKIE } from "@/lib/tracking/server";

export const dynamic = "force-dynamic";

/**
 * The visitor's latest test and its score, pulled from ExamBoot if needed.
 * Called when a page with a test box loads, so a prospect who played the
 * test and comes back sees the score without clicking anything.
 */
export async function GET(request: NextRequest) {
  if (!examBootEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const params = request.nextUrl.searchParams;
  const leadId = await leadFromTokens({ resultToken: params.get("t"), rescheduleToken: params.get("b") });
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const latest = await latestTestFor({ leadId, visitorId });
  return NextResponse.json(latest ?? { status: "none" }, { headers: { "cache-control": "no-store" } });
}
