import Link from "next/link";

import { KIND_LABEL, PHASES, type PlanAction, type PlanKind } from "@/lib/campaign";

const KIND_STYLE: Record<PlanKind, string> = {
  auto: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  validate: "bg-[#e6eef8] text-[#2f6fb5]",
  measure: "bg-amber-50 text-amber-800",
  milestone: "bg-slate-100 text-muted",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The campaign plan by phase (lot 5): date, action, who does it, kind. On a
 * saved cohort, actions to validate show "fait" once Ben marks them, and
 * the due ones link to where they are done. Pure markup: the wizard
 * renders it in the browser as a preview, the cohort page on the server.
 */
export function CampaignPlan({ plan, done, now, hideLinks }: { plan: readonly PlanAction[]; done?: ReadonlySet<string>; now?: Date; hideLinks?: boolean }) {
  return (
    <div className="grid gap-4">
      {PHASES.map((phase) => {
        const rows = plan.filter((a) => a.day >= phase.from && a.day <= phase.to);
        if (!rows.length) return null;
        return (
          <section key={phase.title}>
            <h3 className="text-sm font-bold text-ink-2">{phase.title}</h3>
            <ul className="mt-1 divide-y divide-line">
              {rows.map((a) => {
                const isDone = done?.has(a.key) ?? false;
                const due = !!now && a.kind === "validate" && !isDone && a.date.getTime() <= now.getTime();
                return (
                  <li key={a.key} className={"grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_auto] " + (isDone ? "opacity-55" : "")}>
                    <span className="text-xs text-muted tabular-nums">{dateFmt.format(a.date)}</span>
                    <span className="min-w-0">
                      {a.text}
                      <span className="block text-xs text-muted">{a.by}{a.note ? ` · ${a.note}` : ""}{due && a.href && !hideLinks ? <> · <Link href={a.href} className="font-semibold text-ink underline">à faire</Link></> : null}</span>
                    </span>
                    <span className={"col-start-2 self-start justify-self-start rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap sm:col-start-auto " + (isDone ? "bg-slate-100 text-muted" : KIND_STYLE[a.kind])}>{isDone ? "Fait" : KIND_LABEL[a.kind]}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
