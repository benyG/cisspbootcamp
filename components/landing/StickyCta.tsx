"use client";

import { useEffect, useState } from "react";

import { TrackLink } from "@/components/tracking/TrackLink";
import { formatCohortMonth } from "@/lib/cohorts";
import { formatUsdCents, resolveTierCode } from "@/lib/pricing";
import { COUNTRIES } from "@/lib/scanner/questions";

type Props = {
  tiers: Array<{ code: string; amountUsd: number; countries: string[] }>;
  cohortStartsAt: string | null;
};

/**
 * Mobile-only bar (docs/LANDING.md §22): cohort and price on the left, the
 * one action on the right. Hidden while the questionnaire is on screen, so
 * it never covers an answer.
 */
export function StickyCta({ tiers, cohortStartsAt }: Props) {
  const [hidden, setHidden] = useState(true);
  const [country, setCountry] = useState("SN");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cb_country");
      if (stored && COUNTRIES.some((c) => c.value === stored)) setCountry(stored);
      else {
        const m = (navigator.language || "").match(/-([A-Z]{2})$/);
        if (m && COUNTRIES.some((c) => c.value === m[1])) setCountry(m[1]);
      }
    } catch {
      /* keep default */
    }
    const wizard = document.getElementById("evaluation");
    if (!wizard || typeof IntersectionObserver === "undefined") {
      setHidden(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(wizard);
    return () => observer.disconnect();
  }, []);

  const tier = tiers.find((t) => t.code === resolveTierCode(country, tiers));
  if (hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-2.5 shadow-[0_-10px_30px_rgba(7,26,51,.12)] backdrop-blur sm:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-[.8rem] leading-tight">
          <b className="block truncate">{cohortStartsAt ? `Cohorte CISSP · ${formatCohortMonth(new Date(cohortStartsAt))}` : "Prochaine cohorte CISSP"}</b>
          {tier && tier.amountUsd > 0 && <span className="text-muted">{formatUsdCents(tier.amountUsd)}</span>}
        </div>
        <TrackLink href="#evaluation" label="sticky" className="shrink-0 rounded-[12px] bg-ink px-4 py-3 text-[.92rem] font-extrabold text-white">Analyser mon profil →</TrackLink>
      </div>
    </div>
  );
}
