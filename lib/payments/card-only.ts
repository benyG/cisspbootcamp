/**
 * Card only (Ben, 16/11/2026): Netticket does not work, so everyone pays by
 * Visa or Mastercard through Stripe. People who keep their money on Orange
 * Money can get a virtual Visa card from Orange's Max it app, top it up from
 * Orange Money and pay here like with any card.
 */

/** Countries where Orange Money is used (ISO codes): they see the Max it tip. */
export const ORANGE_MONEY_COUNTRIES = new Set(["CM", "CI", "SN", "ML", "BF", "GN", "NE", "CF", "CD", "MG", "GW", "LR", "SL"]);

export const CARD_ONLY_LINE = "Paiement par carte bancaire Visa ou Mastercard, sécurisé par Stripe.";

export const MAX_IT_TIP =
  "Votre argent est sur Orange Money ? Dans l’application Max it d’Orange, créez une carte Visa virtuelle, rechargez-la depuis votre compte Orange Money, puis payez ici avec cette carte (si l’option est proposée dans votre pays).";

export function showMaxItTip(country: string | null | undefined): boolean {
  return ORANGE_MONEY_COUNTRIES.has((country ?? "").toUpperCase());
}
