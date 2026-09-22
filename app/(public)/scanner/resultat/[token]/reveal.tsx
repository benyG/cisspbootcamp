"use client";

import { useEffect, useState } from "react";

type Axis = { key: string; label: string; score: number; detail: string };

/** Bars fill on arrival — the one moment of motion on the result page. */
export function RevealBars({ axes }: { axes: Axis[] }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <dl className="mt-8 grid gap-5">
      {axes.map((axis, i) => (
        <div key={axis.key}>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-bold">{axis.label}</dt>
            <dd className="text-sm text-muted">{axis.detail}</dd>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-accent-bright transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: shown ? `${Math.max(6, axis.score)}%` : "0%", transitionDelay: `${i * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
