/**
 * Promo (lot 6 of docs/PILOTAGE.md, Ben's choices of 06/11): a percentage
 * off the country's price, by card and in one payment only (Netticket sells
 * fixed-price tickets: mobile money stays at the full price). The launch
 * price of a cohort's campaign, a partner code or an alumnus' referral
 * code; never two at once, the best one wins. Pure: tested, shared by the
 * offer, the checkout and the admin.
 */

export const PROMO_KINDS = { partner: "Partenaire", referral: "Parrainage" } as const;
export type PromoKind = keyof typeof PROMO_KINDS;

export const MAX_PERCENT = 50;

/** "  abidjan-tech " → "ABIDJAN-TECH"; anything else → null. */
export function normalizeCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code) ? code : null;
}

/** The launch price applies until the end of its last day (UTC). */
export function launchPercent(early: { percent: number; until: string } | null | undefined, now: Date): number {
  if (!early) return 0;
  const end = new Date(`${early.until}T23:59:59.999Z`);
  return now.getTime() <= end.getTime() ? clampPercent(early.percent) : 0;
}

export function clampPercent(p: number): number {
  return Number.isFinite(p) ? Math.max(0, Math.min(MAX_PERCENT, Math.round(p))) : 0;
}

export type CodeRow = { code: string; kind: string; label: string; percent: number; program: string | null; validUntil: Date | null; maxUses: number | null; active: boolean; referrerLeadId: number | null };

/** Why a code cannot be used here, in the visitor's words; null when it can. */
export function codeProblem(row: CodeRow | null, input: { program: string; leadId: number; usedCount: number }, now: Date): string | null {
  if (!row || !row.active) return "Ce code n’existe pas ou n’est plus actif.";
  if (row.program && row.program !== input.program) return "Ce code ne vaut pas pour cette formation.";
  if (row.validUntil && row.validUntil.getTime() < now.getTime()) return "Ce code a expiré.";
  if (row.maxUses !== null && input.usedCount >= row.maxUses) return "Ce code a déjà servi le nombre de fois prévu.";
  if (row.referrerLeadId === input.leadId) return "Votre code de parrainage est fait pour les personnes que vous recommandez.";
  return null;
}

export type Promo = {
  percent: number;
  source: "launch" | "code";
  code: string | null;
  /** "Tarif de lancement", "Code ABIDJAN-TECH (Partenaire)"… */
  label: string;
  /** Off the country's price, whole dollars, in cents. */
  discountUsdCents: number;
  /** What the card pays at once: price − discount − consulting credit. */
  amountUsdCents: number;
};

/**
 * The promo that applies, if any: the larger of the launch percentage and
 * the code's. The discount is taken off the country's price and rounded to
 * the dollar; a consulting credit still comes off after it.
 */
export function bestPromo(input: { listUsdCents: number; creditUsdCents: number; launch: number; code: { code: string; percent: number; kind: string } | null }): Promo | null {
  const launch = clampPercent(input.launch);
  const codePercent = input.code ? clampPercent(input.code.percent) : 0;
  if (!launch && !codePercent) return null;
  const useCode = codePercent > launch;
  const percent = useCode ? codePercent : launch;
  const discountUsdCents = Math.round((input.listUsdCents * percent) / 100 / 100) * 100;
  if (discountUsdCents <= 0) return null;
  return {
    percent,
    source: useCode ? "code" : "launch",
    code: useCode ? input.code!.code : null,
    label: useCode ? `Code ${input.code!.code}${input.code!.kind === "referral" ? " (parrainage)" : ""}` : "Tarif de lancement",
    discountUsdCents,
    amountUsdCents: Math.max(0, input.listUsdCents - discountUsdCents - input.creditUsdCents),
  };
}

/** A referral code for an alumnus: first name and four characters, e.g. "AWA-7K3Q". */
export function referralCode(firstName: string, random: () => number = Math.random): string {
  const name = firstName.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 10) || "AMI";
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const tail = Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
  return `${name}-${tail}`;
}
