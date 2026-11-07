import { Prisma } from "@prisma/client";

import { readCampaign } from "@/lib/campaign";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generateRhythmDrafts, RHYTHM_EVERY_DAYS, RHYTHM_POSTS_PER_WEEK } from "@/lib/marketing/rhythm";
import { pilot } from "@/lib/pilotage";
import { cohortTitle } from "@/lib/pilotage-server";
import { type Mode, resolveModes } from "@/lib/playbooks/rules";
import type { Step } from "@/lib/playbooks/server";

/**
 * Content rhythm playbook (lot 7): which cohorts get drafts this week. The
 * plan writes nothing and calls no AI; /api/cron/content generates the
 * drafts of one cohort per run, then e-mails Ben.
 */

const DAY_MS = 86_400_000;

export async function planContent(now: Date): Promise<Step[]> {
  const cohorts = await prisma.cohort.findMany({
    where: { startsAt: { gt: now }, status: { in: ["open", "planned"] }, campaign: { not: Prisma.DbNull } },
    orderBy: { startsAt: "asc" },
    select: { id: true, program: true, name: true, startsAt: true, capacity: true, targetSeats: true, campaign: true, registrations: { where: { status: "paid" }, select: { paidAt: true, createdAt: true } } },
  });
  const steps: Step[] = [];
  for (const c of cohorts) {
    const campaign = readCampaign(c.campaign);
    if (!campaign?.channels.linkedin) continue;
    const state = pilot({ program: c.program, startsAt: c.startsAt, goal: c.targetSeats ?? c.capacity, paidAt: c.registrations.map((r) => r.paidAt ?? r.createdAt) }, now).state;
    if (!["late", "on_track", "ahead"].includes(state)) continue;
    const [week, lastDraft] = await Promise.all([
      prisma.marketingPost.count({ where: { cohortId: c.id, channel: "linkedin", createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
      prisma.marketingPost.findFirst({ where: { cohortId: c.id, autoDraft: true }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    if (week >= RHYTHM_POSTS_PER_WEEK) continue;
    if (lastDraft && now.getTime() - lastDraft.createdAt.getTime() < RHYTHM_EVERY_DAYS * DAY_MS) continue;
    const title = cohortTitle(c);
    const link = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/admin/marketing?cohorte=${c.id}`;
    steps.push({
      playbook: "content",
      summary: `3 publications LinkedIn à proposer pour ${title} (${week} cette semaine)`,
      email: { to: env.ADMIN_EMAIL, subject: `Publications proposées · ${title}`, text: ["Bonjour Ben,", "", `${title} n’avait que ${week} publication${week > 1 ? "s" : ""} LinkedIn cette semaine. Le Studio vous en propose 3, sur le pilier le moins traité ces 30 derniers jours.`, "", "Relisez-les, gardez celle qui vous ressemble, donnez-lui un jour de publication ; supprimez les autres :", link].join("\n") },
      log: { type: "playbook_content", leadId: null, payload: { cohortId: c.id } },
      generate: { cohortId: c.id },
    });
  }
  return steps;
}

/** One cohort per run (the AI call takes time): drafts, then the e-mail, then the log. */
export async function runContent(now = new Date(), mode?: Mode): Promise<"off" | "trial" | "nothing" | "done" | "failed"> {
  const current = mode ?? resolveModes((await prisma.siteSetting.findUnique({ where: { key: "playbooks" } }).catch(() => null))?.value).content;
  if (current !== "on") return current === "off" ? "off" : "trial";
  const [step] = await planContent(now);
  if (!step?.generate) return "nothing";
  const result = await generateRhythmDrafts(step.generate.cohortId, now);
  if (!result.ok) { console.error("[playbook] content", result.error); return "failed"; }
  const { sendEmail } = await import("@/lib/messaging/email");
  await sendEmail(step.email).catch(() => undefined);
  await prisma.actionLog.create({ data: { type: step.log.type, leadId: null, channel: "email", payload: { ...(step.log.payload as object), topic: result.topic, drafts: result.count } } });
  return "done";
}
