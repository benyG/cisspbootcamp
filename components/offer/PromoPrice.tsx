import { admissionClosesAt, formatAdmissionDeadline } from "@/lib/cohorts";
import { formatUsdCents } from "@/lib/pricing";
import type { SiteSettings } from "@/lib/site-settings";

import { AdmissionCountdown } from "./AdmissionCountdown";

type Props = {
  /** The price the prospect pays, in USD cents. */
  amountUsdCents: number;
  localLabel?: string | null;
  offer: SiteSettings["offer"];
  cohort: { startsAt: Date } | null;
  dark?: boolean;
};

/**
 * The price block on the result and registration pages: launch price, local
 * equivalent, admission deadline. The market reference is context in one
 * small line, never a struck-through "equivalent" (docs/LANDING.md §14).
 */
export function PromoPrice({ amountUsdCents, localLabel, offer, cohort, dark = false }: Props) {
  const muted = dark ? "text-[#cbd5df]" : "text-muted";
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={"display text-[2.4rem] leading-none font-black tracking-[-.04em] " + (dark ? "text-white" : "text-ink")}>{formatUsdCents(amountUsdCents)}</span>
        <span className={"text-[.82rem] font-extrabold tracking-[.06em] uppercase " + (dark ? "text-[#7be0c8]" : "text-accent-ink")}>{offer.promoLabel}</span>
      </div>
      {localLabel && <div className={"mt-1 " + muted}>soit environ {localLabel}, à titre indicatif</div>}
      {offer.referencePriceUsd > 0 && <p className={"mt-1.5 text-[.8rem] " + muted}>À titre de repère, {offer.referenceSource.charAt(0).toLowerCase() + offer.referenceSource.slice(1)} : environ {formatUsdCents(offer.referencePriceUsd * 100)} ({offer.referenceCheckedOn}).</p>}
      {cohort && (
        <p className={"mt-2 flex flex-wrap items-center gap-x-2 text-[.86rem] " + muted}>
          Admissions jusqu’au {formatAdmissionDeadline(cohort.startsAt)}<span className="text-[.8rem]"><AdmissionCountdown closesAt={admissionClosesAt(cohort.startsAt).toISOString()} dark={dark} compact /></span>
        </p>
      )}
    </div>
  );
}
