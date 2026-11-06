import { CAMPAIGN_DAYS, type Pilot, type PilotInput, chartSeries } from "@/lib/pilotage";

/**
 * The cohort's curve (lot 2): the target in blue, the paid seats in green
 * steps up to today, and the forecast dotted to the admissions close.
 * Server-rendered SVG, no script.
 */
export function PilotChart({ input, pilot, now }: { input: PilotInput; pilot: Pilot; now: Date }) {
  const W = 640, H = 230, L = 34, R = 16, T = 14, B = 30;
  const { target, paid, today } = chartSeries(input, now);
  const close = pilot.closeDay;
  const top = Math.max(pilot.goal, pilot.paid, pilot.forecast ?? 0);
  const x = (j: number) => L + ((j + CAMPAIGN_DAYS) / (close + CAMPAIGN_DAYS)) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = [-60, -45, -30, -21, -14, close].filter((t, i, a) => t <= close && a.indexOf(t) === i);
  const yTicks = [...new Set([0, Math.round(top / 2), top])];
  const shown = today >= -CAMPAIGN_DAYS;
  const end = Math.min(today, close);
  const last = paid.at(-1)!;
  const pts = (list: Array<[number, number]>) => list.map(([a, v]) => `${x(a).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Courbe cible et places payées : ${pilot.paid} sur ${pilot.goal}`} className="block h-auto w-full min-w-[320px]">
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{v}</text>
        </g>
      ))}
      {ticks.map((t) => <text key={`x${t}`} x={x(t)} y={H - 8} textAnchor={t === close ? "end" : t === -CAMPAIGN_DAYS ? "start" : "middle"} fontSize="11" fill="var(--color-muted)">{t === close ? "Clôture" : `J${t}`}</text>)}
      <polyline fill="none" stroke="#2f6fb5" strokeWidth="2" points={pts(target)} />
      {shown && (
        <>
          <polygon fill="var(--color-accent-soft)" points={`${x(-CAMPAIGN_DAYS)},${y(0)} ${pts(paid)} ${x(end)},${y(0)}`} />
          <polyline fill="none" stroke="var(--color-accent)" strokeWidth="2.5" points={pts(paid)} />
          {pilot.forecast !== null && today < close && (
            <>
              <line x1={x(last[0])} y1={y(last[1])} x2={x(close)} y2={y(pilot.forecast)} stroke="var(--color-accent)" strokeOpacity=".5" strokeWidth="2.5" strokeDasharray="6 5" />
              <circle cx={x(close)} cy={y(pilot.forecast)} r="4.5" fill="#fff" stroke="var(--color-accent)" strokeWidth="2" />
              <text x={x(close) - 8} y={y(pilot.forecast) - 9} textAnchor="end" fontSize="11.5" fontWeight="600" fill="var(--color-accent-ink)">{pilot.forecast}/{pilot.goal}</text>
            </>
          )}
          {today <= close && (
            <>
              <line x1={x(end)} x2={x(end)} y1={T} y2={H - B} stroke="var(--color-ink)" strokeOpacity=".25" strokeDasharray="3 3" />
              <circle cx={x(last[0])} cy={y(last[1])} r="4.5" fill="var(--color-accent)" />
              <text x={Math.min(x(end) + 6, W - R - 60)} y={T + 10} fontSize="11" fill="var(--color-ink-2)">aujourd’hui</text>
            </>
          )}
        </>
      )}
    </svg>
  );
}
