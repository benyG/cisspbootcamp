import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { runContent } from "@/lib/playbooks/content";
import { safeEquals } from "@/lib/tokens";
import { automationState } from "@/lib/guardrails";
import { loadGuardrails } from "@/lib/guardrails-server";

/** The AI call of the content rhythm takes most of a minute: it runs on its own. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Called by the daily cron (app/api/cron/reminders) after its own work. Authenticated by CRON_SECRET. */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = automationState(await loadGuardrails(), "content");
  if (state !== "on") return NextResponse.json({ content: state });
  return NextResponse.json({ content: await runContent().catch(() => "failed") });
}
