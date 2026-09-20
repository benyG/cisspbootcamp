import type { Gauge } from "@/lib/cohorts";

/**
 * The seat gauge (SPECS A5): solid for paid seats, dotted for prospects who
 * said yes but have not paid. Same component on the landing and in the admin.
 */
export function CohortGauge({ gauge, showLabel = true }: { gauge: Gauge; showLabel?: boolean }) {
  return (
    <div>
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={gauge.capacity}
        aria-valuenow={gauge.confirmed}
        aria-label={gauge.label}
      >
        {gauge.projectedPercent > gauge.confirmedPercent && (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${gauge.projectedPercent}%`,
              backgroundImage: "repeating-linear-gradient(90deg, var(--color-accent) 0 6px, transparent 6px 10px)",
              opacity: 0.45,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
          style={{ width: `${gauge.confirmedPercent}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1.5 text-sm font-semibold">
          {gauge.label}
          {gauge.preEngaged > 0 && gauge.remaining > 0 && (
            <span className="font-normal text-[var(--color-muted)]"> · {gauge.preEngaged} en discussion</span>
          )}
        </p>
      )}
    </div>
  );
}
