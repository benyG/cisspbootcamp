import { admissionClosesAt, formatAdmissionDeadline } from "@/lib/cohorts";
import { formatUsdCents } from "@/lib/pricing";
import type { SiteSettings } from "@/lib/site-settings";

import { AdmissionCountdown } from "./AdmissionCountdown";

type Props = {
  /** The promotional price the prospect pays, in USD cents. */
  amountUsdCents: number;
  localLabel?: string | null;
  offer: SiteSettings["offer"];
  cohort: { startsAt: Date } | null;
  dark?: boolean;
};

/**
 * The price block used wherever the offer is shown (landing, result,
 * registration): promotional price, market reference struck through with its
 * source, and the real deadline of the admission window with a countdown.
 */
export function PromoPrice({ amountUsdCents, localLabel, offer, cohort, dark = false }: Props) {
  const reference = offer.referencePriceUsd > 0 ? offer.referencePriceUsd * 100 : 0;
  const saving = reference > amountUsdCents ? Math.round((1 - amountUsdCents / reference) * 100) : 0;
  const muted = dark ? "text-[#cbd5df]" : "text-muted";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={"rounded-full px-2.5 py-1 text-[.72rem] font-extrabold tracking-[.08em] uppercase " + (dark ? "bg-[#7be0c8]/15 text-[#7be0c8]" : "bg-accent-soft text-accent-ink")}>{offer.promoLabel}</span>
        {saving > 0 && <span className={"text-[.82rem] font-bold " + muted}>−{saving} % sur le prix de référence</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={"display text-[2.4rem] leading-none font-black tracking-[-.04em] " + (dark ? "text-white" : "text-ink")}>{formatUsdCents(amountUsdCents)}</span>
        {reference > 0 && (
          <span className={"text-[1.05rem] line-through decoration-2 " + muted} title={`${offer.referenceSource} — vérifié en ${offer.referenceCheckedOn}`}>
            {formatUsdCents(reference)}
          </span>
        )}
      </div>
      {localLabel && <div className={"mt-1 " + muted}>soit environ {localLabel}, à titre indicatif</div>}
      {reference > 0 && <p className={"mt-1.5 text-[.8rem] " + muted}>Prix de référence : {offer.referenceSource}, vérifié en {offer.referenceCheckedOn}.</p>}
      {cohort && (
        <div className={"mt-3 rounded-xl px-3.5 py-2.5 " + (dark ? "bg-white/[.07]" : "border border-line bg-[#fbfffd]")}>
          <div className={"text-[.72rem] font-extrabold tracking-[.08em] uppercase " + muted}>Garanti jusqu’au {formatAdmissionDeadline(cohort.startsAt)}, fin des admissions</div>
          <div className="mt-1"><AdmissionCountdown closesAt={admissionClosesAt(cohort.startsAt).toISOString()} dark={dark} /></div>
        </div>
      )}
    </div>
  );
}
