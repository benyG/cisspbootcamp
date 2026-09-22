"use client";

import { useEffect, useMemo, useState } from "react";

import { btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import { PromoPrice } from "@/components/offer/PromoPrice";
import { TrackLink } from "@/components/tracking/TrackLink";
import { track } from "@/lib/tracking/client";
import { formatCohortMonth } from "@/lib/cohorts";
import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { COUNTRIES } from "@/lib/scanner/questions";
import type { SiteSettings } from "@/lib/site-settings";

const DEFAULT_TIERS = [
  { code: "africa", amountUsd: 62_500, countries: ["BJ", "BF", "BI", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "GA", "GN", "GQ", "MG", "ML", "MA", "MR", "MU", "NE", "RW", "SN", "SC", "TG", "TN", "DZ", "HT"] },
  { code: "international", amountUsd: 120_000, countries: [] },
];

type Props = {
  settings: SiteSettings;
  tiers: Array<{ code: string; amountUsd: number; countries: string[] }>;
  rates: RateTable;
  cohort: { name: string; startsAt: string } | null;
};

/**
 * Price by country (SPECS A4): USD from the tier, local equivalent from the
 * daily rates. The browser's locale suggests a country; the prospect can
 * change it, and the choice carries into the questionnaire's last screen.
 */
export function PriceSection({ settings, tiers, rates, cohort }: Props) {
  const [country, setCountry] = useState("SN");

  useEffect(() => {
    try {
      const m = (navigator.language || "").match(/-([A-Z]{2})$/);
      if (m && COUNTRIES.some((c) => c.value === m[1])) setCountry(m[1]);
    } catch {
      /* keep default */
    }
  }, []);

  const price = useMemo(() => {
    // The seeded tiers (SPECS A4), so the price shows even before the first
    // deploy has written them — never "sur devis" by accident.
    const known = tiers.length ? tiers : DEFAULT_TIERS;
    const code = resolveTierCode(country, known);
    const tier = known.find((t) => t.code === code);
    if (!tier) return { usd: "sur devis", cents: null as number | null, local: null as string | null };
    const cur = localCurrencyFor(country);
    const local = cur === "USD" ? null : convertUsdCents(tier.amountUsd, cur, rates);
    return { usd: formatUsdCents(tier.amountUsd), cents: tier.amountUsd, local: local === null ? null : formatLocal(local, cur) };
  }, [country, tiers, rates]);

  const { offer } = settings;

  return (
    <section id="inscription" className={shell + " pb-16 sm:pb-20"}>
      <div className="grid items-center gap-8 rounded-[28px] border border-line bg-white p-6 shadow-[var(--shadow-panel)] sm:p-9 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className={eyebrow}>
            <span className="rounded-full border border-accent/10 bg-accent/10 px-2.5 py-1.5 tracking-[.1em] text-accent">Cohorte</span>
            <span>{cohort ? formatCohortMonth(new Date(cohort.startsAt)) : "prochaine session"}</span>
          </div>
          <h2 className="display mt-3 mb-3 text-[clamp(2rem,3.5vw,3.7rem)] leading-none font-black tracking-[-.05em]">{offer.title}</h2>
          <p className="max-w-[650px] text-muted">{offer.text}</p>
          <ul className="mt-4 grid gap-2 text-[.95rem] text-ink-2">
            {offer.included.map((i) => <li key={i} className="relative pl-6.5 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{i}</li>)}
            {offer.soonEnabled && offer.soonText && <li className="relative pl-6.5 text-muted before:absolute before:left-0 before:text-muted before:content-['◌']">{offer.soonText}</li>}
          </ul>
        </div>
        <div className="border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <label htmlFor="price-country" className="text-[.78rem] font-extrabold tracking-[.06em] text-muted uppercase">Votre pays</label>
          <select id="price-country" value={country} onChange={(e) => { setCountry(e.target.value); track("price_country_change", { label: e.target.value }); }} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base">
            {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className="mt-4 mb-4">
            {price.cents !== null ? (
              <PromoPrice amountUsdCents={price.cents} localLabel={price.local} offer={offer} cohort={cohort ? { startsAt: new Date(cohort.startsAt) } : null} />
            ) : (
              <div className="display text-[2.4rem] leading-none font-black tracking-[-.04em]">{price.usd}</div>
            )}
          </div>
          <TrackLink href="#evaluation" label="prix" className={btnPrimary + " w-full"}>Analyser mon profil, puis réserver →</TrackLink>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Carte bancaire", "Orange Money", "MTN MoMo"].map((m) => <span key={m} className="rounded-full border border-line px-2.5 py-1 text-[.78rem] font-bold text-ink-2">{m}</span>)}
          </div>
          <p className="mt-3 text-[.88rem] text-muted">Formation et préparation. Les frais d’examen ISC² (~750 USD) se règlent séparément auprès d’ISC².</p>
        </div>
      </div>
    </section>
  );
}
