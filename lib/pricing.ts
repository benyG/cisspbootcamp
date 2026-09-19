/**
 * Pricing tiers — SPECS A4.
 *
 * The tier is derived from the prospect's country. Amounts are USD cents; USD
 * is the reference currency and the only one we treat as authoritative.
 */

/** Used whenever a country matches no explicit tier (CADRAGE §4, phase 2). */
export const DEFAULT_TIER_CODE = "international";

/** Priced on request, so no amount is displayed. */
export const QUOTE_ONLY_TIER_CODE = "enterprise";

export type TierCountries = {
  code: string;
  countries: readonly string[];
};

/**
 * Resolve a country to a tier code. Unknown or malformed countries fall back to
 * `international`: charging the higher tier by mistake is recoverable, offering
 * the lower one to the wrong market is not.
 */
export function resolveTierCode(
  country: string | null | undefined,
  tiers: readonly TierCountries[],
): string {
  if (!country) return DEFAULT_TIER_CODE;

  const normalized = country.trim().toUpperCase();
  if (normalized.length !== 2) return DEFAULT_TIER_CODE;

  const match = tiers.find((tier) =>
    tier.countries.some((code) => code.toUpperCase() === normalized),
  );

  return match?.code ?? DEFAULT_TIER_CODE;
}

/**
 * Display an amount held in USD cents. Whole dollars are shown without
 * decimals — every tier is a round price, and "625 USD" reads better on a
 * 360 px screen than "625,00 USD".
 */
export function formatUsdCents(amountCents: number): string {
  const amount = amountCents / 100;
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString("fr-FR")
    : amount.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  return `${formatted} USD`;
}

export function isQuoteOnly(tierCode: string): boolean {
  return tierCode === QUOTE_ONLY_TIER_CODE;
}

// --- Équivalent local indicatif (SPECS A4) -------------------------------

/** Currency shown next to the USD price, by country. Anything else: USD. */
export const LOCAL_CURRENCY_BY_COUNTRY: Record<string, string> = {
  // Zone CEMAC — XAF
  CM: "XAF", CF: "XAF", TD: "XAF", CG: "XAF", GA: "XAF", GQ: "XAF",
  // Zone UEMOA — XOF
  BJ: "XOF", BF: "XOF", CI: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF", GW: "XOF",
  // Euro
  FR: "EUR", BE: "EUR", LU: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", AT: "EUR", IE: "EUR", FI: "EUR",
  CA: "CAD",
  CH: "CHF",
  MA: "MAD",
  TN: "TND",
  DZ: "DZD",
  GN: "GNF",
  CD: "CDF",
  RW: "RWF",
  MG: "MGA",
  MU: "MUR",
  HT: "HTG",
};

/**
 * XAF and XOF are pegged to the euro by treaty: 1 EUR = 655.957. Kept as a
 * constant so an exchange-rate feed that goes down never breaks the price
 * shown to the largest part of the market.
 */
export const CFA_PER_EUR = 655.957;

/** Units per 1 USD. Rates are fetched daily; these are the fallbacks. */
export type RateTable = Record<string, number>;

export function localCurrencyFor(country: string | null | undefined): string {
  if (!country) return "USD";
  return LOCAL_CURRENCY_BY_COUNTRY[country.trim().toUpperCase()] ?? "USD";
}

/**
 * Indicative local amount, in the currency's minor unit (cents, or the unit
 * itself for zero-decimal currencies like XAF/XOF). Returns null when no rate
 * is known — the UI then shows USD only rather than a wrong number.
 */
export function convertUsdCents(
  amountUsdCents: number,
  currency: string,
  rates: RateTable,
): number | null {
  if (currency === "USD") return amountUsdCents;

  let perUsd = rates[currency];
  if (perUsd === undefined && (currency === "XAF" || currency === "XOF") && rates.EUR) {
    perUsd = rates.EUR * CFA_PER_EUR;
  }
  if (!perUsd || perUsd <= 0) return null;

  const usd = amountUsdCents / 100;
  const local = usd * perUsd;
  return isZeroDecimal(currency) ? Math.round(local) : Math.round(local * 100);
}

/** Currencies with no minor unit, as Stripe and ISO 4217 treat them. */
export const ZERO_DECIMAL_CURRENCIES = new Set(["XAF", "XOF", "GNF", "RWF", "MGA", "JPY", "KRW"]);

export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency);
}

/** "350 000 FCFA", "1 090 €", "1 620 $CA" — rounded for display, never for charging. */
export function formatLocal(amountMinor: number, currency: string): string {
  const amount = isZeroDecimal(currency) ? amountMinor : amountMinor / 100;
  // Round indicative amounts to something a human quotes: nearest 1 000 FCFA, nearest 10 otherwise.
  const step = currency === "XAF" || currency === "XOF" ? 1000 : 10;
  const rounded = Math.round(amount / step) * step;
  const number = rounded.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  switch (currency) {
    case "XAF":
    case "XOF":
      return `${number} FCFA`;
    case "EUR":
      return `${number} €`;
    case "CAD":
      return `${number} $CA`;
    case "CHF":
      return `${number} CHF`;
    default:
      return `${number} ${currency}`;
  }
}
