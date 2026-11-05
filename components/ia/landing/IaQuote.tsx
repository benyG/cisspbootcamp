"use client";

import { useEffect, useMemo, useState } from "react";

import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { COUNTRIES } from "@/lib/scanner/questions";
import { track } from "@/lib/tracking/client";

/**
 * The price of the training as a quote (Ben, 05/11): the fee for the
 * visitor's country, what is included, what is paid to the providers, the
 * two-instalment option. Same country memory as the other price blocks.
 */
type Props = {
  tiers: Array<{ code: string; countries: string[] }>;
  /** USD cents by tier code; installmentUsd null when two instalments are not offered. */
  prices: Record<string, { amountUsd: number; installmentUsd: number | null }>;
  rates: RateTable;
  hours: number;
  days: number;
  capacity: number;
};

const COUNTRY_KEY = "cb_country";

export function IaQuote({ tiers, prices, rates, hours, days, capacity }: Props) {
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

  const quote = useMemo(() => {
    const code = resolveTierCode(country, tiers.length ? tiers : [{ code: "africa", countries: [] }]);
    const row = prices[code] ?? prices.international ?? null;
    if (!row) return null;
    const currency = localCurrencyFor(country);
    const local = currency === "USD" ? null : convertUsdCents(row.amountUsd, currency, rates);
    return {
      price: formatUsdCents(row.amountUsd),
      local: local === null ? null : formatLocal(local, currency),
      twice: row.installmentUsd ? `Ou en deux fois : 2 × ${formatUsdCents(row.installmentUsd)}, le second avant votre J1.` : null,
    };
  }, [country, tiers, prices, rates]);

  return (
    <div className="devis">
      <span className="stamp">prix fixe</span>
      <div className="devis-head">
        <strong>Bootcamp Bâtisseur IA</strong>
        <label className="country" htmlFor="ia-quote-country">
          <span className="label">Votre pays</span>
          <select
            id="ia-quote-country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              try { localStorage.setItem(COUNTRY_KEY, e.target.value); } catch { /* ignore */ }
              track("price_country_change", { label: `ia:${e.target.value}` });
            }}
          >
            {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
      </div>
      {quote ? (
        <>
          <table className="lines">
            <tbody>
              <tr><td>Formation : {days} journées en direct, {hours} h, en groupe de {capacity}</td><td>{quote.price}</td></tr>
              <tr><td>Supports, calendrier personnel, fiche projet</td><td>inclus</td></tr>
              <tr><td>30 jours de suivi après la J{days}</td><td>inclus</td></tr>
              <tr className="sub"><td>À régler chez les fournisseurs : abonnement Claude pendant le mois</td><td>20 à 100 USD</td></tr>
              <tr className="sub"><td>Nom de domaine de votre application</td><td>10 à 20 USD / an</td></tr>
            </tbody>
          </table>
          <div className="total"><div><small>Total formation</small><b>{quote.price}</b></div>{quote.local && <small>≈ {quote.local}, montant indicatif</small>}</div>
          {quote.twice && <p className="twice">{quote.twice}</p>}
        </>
      ) : (
        <p className="empty" style={{ marginTop: 14 }}>Pour votre pays, le tarif se fait sur devis : écrivez à Ben.</p>
      )}
    </div>
  );
}
