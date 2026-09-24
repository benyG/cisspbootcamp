"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AdmissionCountdown } from "@/components/offer/AdmissionCountdown";
import { SeatsGauge, btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import { TrackLink } from "@/components/tracking/TrackLink";
import { track } from "@/lib/tracking/client";
import { type Gauge, admissionClosesAt, formatAdmissionDeadline, formatCohortMonth } from "@/lib/cohorts";
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
  cohort: { name: string; startsAt: string; gauge: Gauge } | null;
};

/**
 * The price, plainly (docs/LANDING.md §13): cohort, amount, local equivalent,
 * what is included, one action, how to pay, the exam not included. The
 * country selector is the only control; the admission deadline is a line.
 */
export function PriceSection({ settings, tiers, rates, cohort }: Props) {
  const [country, setCountry] = useState("SN");
  const seen = useRef(false);
  const section = useRef<HTMLElement>(null);

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
    // pricing_view: once, when the price block is actually on screen.
    const node = section.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seen.current) {
        seen.current = true;
        track("pricing_view");
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const price = useMemo(() => {
    const known = tiers.length ? tiers : DEFAULT_TIERS;
    const code = resolveTierCode(country, known);
    const tier = known.find((t) => t.code === code);
    if (!tier || tier.amountUsd === 0) return null;
    const cur = localCurrencyFor(country);
    const local = cur === "USD" ? null : convertUsdCents(tier.amountUsd, cur, rates);
    return { usd: formatUsdCents(tier.amountUsd), local: local === null ? null : formatLocal(local, cur) };
  }, [country, tiers, rates]);

  const { offer } = settings;
  const startsAt = cohort ? new Date(cohort.startsAt) : null;

  return (
    <section id="inscription" ref={section} className={shell + " pb-14 sm:pb-16"}>
      <div className="grid items-start gap-8 rounded-[28px] border border-line bg-white p-6 shadow-[var(--shadow-panel)] sm:p-9 lg:grid-cols-2">
        <div>
          <div className={eyebrow}>
            <span className="rounded-full border border-accent/10 bg-accent/10 px-2.5 py-1.5 tracking-[.1em] text-accent">Cohorte</span>
            <span>{startsAt ? formatCohortMonth(startsAt) : "prochaine session"}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {price ? (
              <>
                <span className="display text-[3rem] leading-none font-black tracking-[-.04em]">{price.usd}</span>
                {price.local && <span className="text-[1.05rem] font-bold text-muted">≈ {price.local}</span>}
              </>
            ) : (
              <span className="display text-[2rem] leading-none font-black">Sur devis</span>
            )}
          </div>
          <p className="mt-2 text-[.9rem] font-bold text-ink-2">{offer.promoLabel} · 40 h de live · 15 jours · {cohort ? `${cohort.gauge.capacity} places` : "10 places"}</p>
          {offer.referencePriceUsd > 0 && (
            <p className="mt-1 text-[.8rem] text-muted">À titre de repère, {lower(offer.referenceSource)} : environ {formatUsdCents(offer.referencePriceUsd * 100)} ({offer.referenceCheckedOn}).</p>
          )}
          <label htmlFor="price-country" className="mt-5 block text-[.78rem] font-extrabold tracking-[.06em] text-muted uppercase">Votre pays</label>
          <select id="price-country" value={country} onChange={(e) => { setCountry(e.target.value); try { localStorage.setItem("cb_country", e.target.value); } catch { /* ignore */ } track("price_country_change", { label: e.target.value }); }} className="mt-1.5 w-full max-w-sm rounded-xl border border-line bg-white px-3.5 py-3 text-base">
            {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {cohort && <div className="mt-4 max-w-sm"><SeatsGauge gauge={cohort.gauge} /></div>}
        </div>
        <div className="border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <h2 className="display text-[1.4rem] leading-tight font-black">{offer.title}</h2>
          <ul className="mt-3 grid gap-2 text-[.95rem] text-ink-2">
            {offer.included.map((i) => <li key={i} className="relative pl-6.5 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{i}</li>)}
          </ul>
          <TrackLink href="#evaluation" label="prix" className={btnPrimary + " mt-5 w-full"}>Analyser mon profil →</TrackLink>
          <p className="mt-3 text-[.86rem] font-bold text-ink-2">Carte · Orange Money · MTN MoMo</p>
          {startsAt && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[.86rem] text-muted">
              Admissions jusqu’au {formatAdmissionDeadline(startsAt)}<span className="text-[.8rem]"><AdmissionCountdown closesAt={admissionClosesAt(startsAt).toISOString()} compact /></span>
            </p>
          )}
          <p className="mt-2 text-[.86rem] text-muted">Frais d’examen ISC² non inclus.</p>
        </div>
      </div>
    </section>
  );
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
