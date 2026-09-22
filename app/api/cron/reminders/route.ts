import { NextResponse, type NextRequest } from "next/server";

import { sendDueReminders } from "@/lib/booking";
import { env } from "@/lib/env";
import { processSeatHolds } from "@/lib/seat-holds";
import { safeEquals } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Vercel Cron, every 15 minutes (vercel.json). Authenticated by CRON_SECRET. */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [reminders, holds] = await Promise.all([sendDueReminders(), processSeatHolds()]);
  return NextResponse.json({ ...reminders, holds });
}
