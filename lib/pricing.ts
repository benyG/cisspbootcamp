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
