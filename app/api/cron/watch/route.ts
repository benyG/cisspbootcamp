import { NextResponse, type NextRequest } from "next/server";

import { runWatch } from "@/lib/watch-server";
import { env } from "@/lib/env";
import { safeEquals } from "@/lib/tokens";
import { automationState } from "@/lib/guardrails";
import { loadGuardrails } from "@/lib/guardrails-server";

/** The market watch searches the web for a minute or two: it runs on its own, after the daily cron. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Called by the daily cron (app/api/cron/reminders). Authenticated by CRON_SECRET; works on Sundays only (lot D). */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = automationState(await loadGuardrails(), "watch");
  if (state !== "on") return NextResponse.json({ watch: state });
  return NextResponse.json({ watch: await runWatch() });
}
