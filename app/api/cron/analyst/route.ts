import { NextResponse, type NextRequest } from "next/server";

import { runAnalyst } from "@/lib/analyst/server";
import { env } from "@/lib/env";
import { safeEquals } from "@/lib/tokens";

/** The analyst's AI call takes a while: it runs on its own, after the daily cron. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Called by the daily cron (app/api/cron/reminders). Authenticated by CRON_SECRET; works on Sundays only. */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ analyst: await runAnalyst().catch(() => "failed") });
}
