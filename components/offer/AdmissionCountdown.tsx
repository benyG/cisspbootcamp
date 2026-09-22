"use client";

import { useEffect, useState } from "react";

/**
 * Time left before the admission window closes — the real deadline computed
 * by lib/cohorts.ts, never a timer that resets. Renders days on the server,
 * then hours and minutes once mounted, refreshed every minute.
 */
export function AdmissionCountdown({ closesAt, dark = false, compact = false }: { closesAt: string; dark?: boolean; compact?: boolean }) {
  const deadline = new Date(closesAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const left = Math.max(0, deadline - (now ?? Date.now()));
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const closed = now !== null && left === 0;

  const digit = dark ? "text-white" : "text-ink";
  const unit = dark ? "text-[#cbd5df]" : "text-muted";

  if (closed) return <span className={"text-sm font-semibold " + unit}>Fenêtre d’admission fermée</span>;

  const parts: Array<[number, string]> = days > 0 ? [[days, "j"], [hours, "h"], [minutes, "min"]] : [[hours, "h"], [minutes, "min"]];
  return (
    <span className={"inline-flex items-baseline gap-1.5 tabular-nums " + (compact ? "text-[.95rem]" : "text-[1.15rem]")} aria-live="polite" suppressHydrationWarning>
      {parts.map(([value, label]) => (
        <span key={label}>
          <b className={"display font-black " + digit}>{now === null && label !== "j" ? "–" : String(value).padStart(2, "0")}</b>
          <span className={"ml-0.5 text-[.72em] font-semibold " + unit}>{label}</span>
        </span>
      ))}
    </span>
  );
}
