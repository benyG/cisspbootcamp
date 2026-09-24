"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { PublicService } from "@/lib/consulting";
import { type RateTable, convertUsdCents, formatLocal, formatUsdCents, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { COUNTRIES } from "@/lib/scanner/questions";
import { track } from "@/lib/tracking/client";

type Props = {
  services: PublicService[];
  tiers: Array<{ code: string; countries: string[] }>;
  rates: RateTable;
  /** Scanner result token, so the order form knows the prospect. */
  token?: string;
  /** Where "choose" goes: this path gets ?code=&pays=&t=; defaults to the service's order page. */
  chooseBase?: string;
  chooseLabel?: string;
};

const COUNTRY_KEY = "cb_country";

/**
 * The consulting catalogue priced for the visitor's country (docs/OFFRES.md
 * §2). Same country selector as the bootcamp price; the choice is remembered
 * so the order page opens with it.
 */
export function ServiceCards({ services, tiers, rates, token, chooseBase, chooseLabel }: Props) {
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

  const tierCode = useMemo(() => resolveTierCode(country, tiers.length ? tiers : [{ code: "africa", countries: [] }]), [country, tiers]);
  const currency = localCurrencyFor(country);

  const priceOf = (service: PublicService) => {
    const cents = service.prices[tierCode] ?? service.prices.international ?? null;
    if (cents === null) return null;
    const local = currency === "USD" ? null : convertUsdCents(cents, currency, rates);
    return { usd: formatUsdCents(cents), local: local === null ? null : formatLocal(local, currency) };
  };

  return (
    <div>
      <label htmlFor="service-country" className="text-[.78rem] font-extrabold tracking-[.06em] text-muted uppercase">Votre pays</label>
      <select
        id="service-country"
        value={country}
        onChange={(e) => {
          setCountry(e.target.value);
          try { localStorage.setItem(COUNTRY_KEY, e.target.value); } catch { /* ignore */ }
          track("price_country_change", { label: `conseil:${e.target.value}` });
        }}
        className="mt-1.5 w-full max-w-sm rounded-xl border border-line bg-white px-3.5 py-3 text-base"
      >
        {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {services.map((service) => {
          const price = priceOf(service);
          return (
            <article key={service.code} className="flex flex-col rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <p className="text-[.78rem] font-extrabold tracking-[.06em] text-accent uppercase">{service.durationLabel}{service.code === "mentorat" ? " par mois" : ""}</p>
              <h3 className="display mt-2 text-[1.5rem] leading-tight font-black tracking-[-.03em]">{service.name}</h3>
              <p className="mt-2 text-ink-2">{service.tagline}</p>
              <ul className="mt-4 grid gap-1.5 text-[.95rem] text-ink-2">
                {service.description.map((line) => (
                  <li key={line} className="relative pl-6 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{line}</li>
                ))}
              </ul>
              <p className="mt-3 text-[.9rem] text-muted"><b className="text-ink">Vous repartez avec :</b> {service.deliverable}.</p>
              <div className="mt-auto pt-5">
                {price ? (
                  <p className="display text-[2rem] leading-none font-black tracking-[-.04em]">{price.usd}{price.local && <span className="ml-2 text-[1rem] font-bold text-muted">≈ {price.local}</span>}</p>
                ) : (
                  <p className="text-muted">Sur devis</p>
                )}
                {service.creditable && <p className="mt-1.5 text-[.78rem] text-muted">Déduite du bootcamp CISSP si vous le rejoignez dans les 90 jours.</p>}
                <Link
                  href={chooseBase ? `${chooseBase}?code=${service.code}&pays=${country}${token ? `&t=${token}` : ""}` : `/conseil/${service.code}?pays=${country}${token ? `&t=${token}` : ""}`}
                  onClick={() => track("cta_click", { label: `conseil-${service.code}` })}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white"
                >
                  {chooseLabel ?? "Choisir mon créneau →"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
