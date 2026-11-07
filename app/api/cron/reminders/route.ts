import { NextResponse, after, type NextRequest } from "next/server";

import { sendBalanceReminders } from "@/lib/balance-reminders";
import { sendDueReminders } from "@/lib/booking";
import { sendSessionReminders } from "@/lib/cohort-sessions-send";
import { syncCohortStatuses } from "@/lib/cohorts-admin";
import { syncPendingVideos } from "@/lib/minimax";
import { sendPersonalReminders } from "@/lib/personal-schedule-send";
import { syncReplays } from "@/lib/replays-server";
import { env } from "@/lib/env";
import { syncEvaluations } from "@/lib/evaluations-server";
import { sendIaReminders, syncIaInvites } from "@/lib/ia-plan-server";
import { sweepPendingTests } from "@/lib/examboot/service";
import { sendResultReminders } from "@/lib/followups-auto";
import { processSeatHolds } from "@/lib/seat-holds";
import { sendMondayReport } from "@/lib/pilotage-server";
import { runPlaybooks } from "@/lib/playbooks/server";
import { publishDuePosts } from "@/lib/marketing/schedule";
import { safeEquals } from "@/lib/tokens";

/** Drive copies of the replays use up to 45 s of each run. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Vercel Cron, every 15 minutes (vercel.json). Authenticated by CRON_SECRET. */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [reminders, holds, tests, resultReminders, sessionReminders, videos, cohorts, personalReminders, replays, evaluations, iaInvites, iaReminders, balanceReminders, mondayReport, playbooks, scheduledPosts] = await Promise.all([sendDueReminders(), processSeatHolds(), sweepPendingTests(), sendResultReminders(), sendSessionReminders(), syncPendingVideos(), syncCohortStatuses(new Date(), { revalidate: true }), sendPersonalReminders(), syncReplays(), syncEvaluations(), syncIaInvites().catch(() => -1), sendIaReminders().catch(() => -1), sendBalanceReminders().catch(() => -1), sendMondayReport().catch(() => "failed" as const), runPlaybooks().catch(() => "failed" as const), publishDuePosts().catch(() => -1)]);
  // The content rhythm (AI) runs in its own function, so it gets its own minute.
  after(() => fetch(`${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/cron/content`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }).then(() => undefined, () => undefined));
  return NextResponse.json({ ...reminders, holds, tests, resultReminders, sessionReminders, videos, cohorts, personalReminders, replays, evaluations, iaInvites, iaReminders, balanceReminders, mondayReport, playbooks, scheduledPosts });
}
