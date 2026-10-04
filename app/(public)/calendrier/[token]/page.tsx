import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Planner, type PlannerDay } from "@/components/personal-schedule/Planner";
import { zonedInstant } from "@/lib/cohort-sessions";
import { PERSONAL_ZONE, isWeekendDate, startOptions, windowDates } from "@/lib/personal-schedule";
import { busyOver, loadLimits, personalPlanUrl, scheduleByToken, storedDays } from "@/lib/personal-schedule-send";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre calendrier · CISSP Bootcamp", robots: { index: false } };

/**
 * A participant's own calendar (Ben, 04/10), from the link Ben sends: pick
 * days over one month, choose the hours, propose; Ben confirms. Ben's
 * agenda is read on every display, never cached.
 */
export default async function PersonalCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const schedule = await scheduleByToken(token);
  if (!schedule) notFound();

  const now = new Date();
  const window = windowDates(schedule.sentAt);
  const open = schedule.status === "invited" || schedule.status === "refused";
  const [limits, availability] = await Promise.all([loadLimits(), open ? busyOver(window) : Promise.resolve({ busy: [], calendar: true })]);
  const days: PlannerDay[] = window.map((date) => ({
    date,
    weekend: isWeekendDate(date),
    options: startOptions(date, false, limits, availability.busy, now),
    optionsExtended: isWeekendDate(date) ? startOptions(date, true, limits, availability.busy, now) : [],
    // Minutes to add to a Montréal clock time to get UTC that day (summer or winter time).
    utcShift: Math.round((zonedInstant(date, "12:00", PERSONAL_ZONE).getTime() - Date.parse(`${date}T12:00:00Z`)) / 60_000),
  }));

  return (
    <Planner
      token={token}
      firstName={schedule.lead.firstName}
      cohortName={schedule.cohort.name}
      status={schedule.status as "invited" | "proposed" | "confirmed" | "refused"}
      refusalNote={schedule.refusalNote}
      days={days}
      chosen={storedDays(schedule.days)}
      calendarConnected={availability.calendar}
      planUrl={schedule.status === "proposed" || schedule.status === "confirmed" ? personalPlanUrl(token) : null}
    />
  );
}
