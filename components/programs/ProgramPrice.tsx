"use client";

import { useEffect, useMemo, useState } from "react";

import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { COUNTRIES } from "@/lib/scanner/questions";
import { track } from "@/lib/tracking/client";

type Props = {
  tiers: Array<{ code: string; countries: string[] }>;
  /** USD cents by tier code. */
  prices: Record<string, number>;
  rates: RateTable;
};

const COUNTRY_KEY = "cb_country";

/** Price of a programme by country, with the indicative local amount (same selector as everywhere). */
export function ProgramPrice({ tiers, prices, rates }: Props) {
  const [country, setCountry] = useState("SN");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COUNTRY_KEY);
      if (stored && COUNTRIES.some((c) => c.value === stored)) return setCountry(stored);
      const m = (navigator.language || "").match(/-([A-Z]{2})$/);
      if (m && COUNTRIES.some((c) => c.value === m[1])) setCountry(m[1]);
    } catch {
      /* keep default */
    }
  }, []);

  const price = useMemo(() => {
    const code = resolveTierCode(country, tiers.length ? tiers : [{ code: "africa", countries: [] }]);
    const cents = prices[code] ?? prices.international ?? null;
    if (cents === null) return null;
    const currency = localCurrencyFor(country);
    const local = currency === "USD" ? null : convertUsdCents(cents, currency, rates);
    return { usd: formatUsdCents(cents), local: local === null ? null : formatLocal(local, currency) };
  }, [country, tiers, prices, rates]);

  return (
    <div className="mt-4">
      <label htmlFor="program-country" className="text-[.78rem] font-extrabold tracking-[.06em] text-muted uppercase">Votre pays</label>
      <select
        id="program-country"
        value={country}
        onChange={(e) => {
          setCountry(e.target.value);
          try { localStorage.setItem(COUNTRY_KEY, e.target.value); } catch { /* ignore */ }
          track("price_country_change", { label: `cc:${e.target.value}` });
        }}
        className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base"
      >
        {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {price ? (
          <>
            <span className="display text-[2.4rem] leading-none font-black tracking-[-.04em]">{price.usd}</span>
            {price.local && <span className="text-muted">soit environ {price.local}</span>}
          </>
        ) : (
          <span className="text-muted">Sur devis</span>
        )}
      </div>
      <p className="mt-1.5 text-[.8rem] text-muted">Formation et préparation. L’examen se réserve auprès d’ISC².</p>
    </div>
  );
}
