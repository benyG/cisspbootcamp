import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { isPlacement, leadFromTokens, testFor } from "@/lib/examboot/service";
import { VISITOR_COOKIE } from "@/lib/tracking/server";

export const dynamic = "force-dynamic";

/**
 * The link used in e-mails and in Ben's follow-up messages: it creates the
 * prospect's test (or reuses today's) and sends them straight to it. When
 * the feature is off or ExamBoot is down, it lands on the method section.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const placement = isPlacement(from) ? from : "email-resultat";
  const fallback = `${env.NEXT_PUBLIC_APP_URL}/#methode`;
  if (!examBootEnabled()) return NextResponse.redirect(fallback, 302);

  const leadId = await leadFromTokens({ resultToken: params.get("t"), rescheduleToken: params.get("b") });
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  try {
    const link = await testFor({ placement, leadId, visitorId });
    return NextResponse.redirect(link.url, 302);
  } catch (error) {
    console.error("[examboot] lien e-mail : création impossible", error instanceof Error ? error.message : error);
    return NextResponse.redirect(fallback, 302);
  }
}
