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
import { automationRuns } from "@/lib/guardrails";
import { guarded, loadGuardrails } from "@/lib/guardrails-server";
import { issueMissingReceipts, sendAdminReminders } from "@/lib/admin-records-server";

/** Drive copies of the replays use up to 45 s of each run. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Vercel Cron, every 15 minutes (vercel.json). Authenticated by CRON_SECRET. */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Guardrails (lot A): the general stop and the switch of each automation.
  // Payment confirmations, seat holds, cohort statuses and syncs always run.
  const g = await loadGuardrails();
  const [reminders, holds, tests, resultReminders, sessionReminders, videos, cohorts, personalReminders, replays, evaluations, iaInvites, iaReminders, balanceReminders, mondayReport, playbooks, scheduledPosts, receipts, adminReminders] = await Promise.all([
    guarded(g, "bookingReminders", () => sendDueReminders()),
    processSeatHolds(),
    sweepPendingTests(),
    guarded(g, "resultReminders", () => sendResultReminders()),
    guarded(g, "sessionReminders", () => sendSessionReminders()),
    syncPendingVideos(),
    syncCohortStatuses(new Date(), { revalidate: true }),
    guarded(g, "personalReminders", () => sendPersonalReminders()),
    guarded(g, "replays", () => syncReplays()),
    guarded(g, "evaluations", () => syncEvaluations()),
    guarded(g, "iaParticipants", () => syncIaInvites().catch(() => -1)),
    guarded(g, "iaParticipants", () => sendIaReminders().catch(() => -1)),
    guarded(g, "balanceReminders", () => sendBalanceReminders().catch(() => -1)),
    guarded(g, "mondayReport", () => sendMondayReport().catch(() => "failed" as const)),
    guarded(g, "playbooks", () => runPlaybooks().catch(() => "failed" as const)),
    guarded(g, "scheduledPosts", () => publishDuePosts().catch(() => -1)),
    // Receipts are numbered even when everything is stopped: they are the accounts.
    issueMissingReceipts().catch(() => -1),
    guarded(g, "adminReminders", () => sendAdminReminders().catch(() => -1)),
  ]);
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // The content rhythm (AI) runs in its own function, so it gets its own minute.
  if (automationRuns(g, "content")) after(() => fetch(`${base}/api/cron/content`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }).then(() => undefined, () => undefined));
  // On Sundays, the analyst of the week (AI) for the Monday report, in its own function too.
  if (new Date().getUTCDay() === 0 && automationRuns(g, "analyst")) after(() => fetch(`${base}/api/cron/analyst`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }).then(() => undefined, () => undefined));
  return NextResponse.json({ stopped: g.stopped, bookingReminders: reminders, holds, tests, resultReminders, sessionReminders, videos, cohorts, personalReminders, replays, evaluations, iaInvites, iaReminders, balanceReminders, mondayReport, playbooks, scheduledPosts, receipts, adminReminders });
}
