import { formatUsdCents } from "@/lib/pricing";
import type { Promo } from "@/lib/promo";

/**
 * The promo on a registration page (lot 6): the price by card in one
 * payment, and a small form to type a code. A plain GET form beside the
 * payment form (forms cannot nest): it reloads the page with ?code=.
 */
export function PromoCode({ promo, error, code, listUsdCents, page, keep }: { promo: Promo | null; error: string | null; code: string | null; listUsdCents: number; page: string; keep: Record<string, string | undefined> }) {
  return (
    <div className="grid gap-2">
      {promo && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">
          <b>{promo.label} : -{promo.percent} %.</b> Par carte, en une fois : <b>{formatUsdCents(promo.amountUsdCents)}</b> au lieu de {formatUsdCents(listUsdCents)}. En mobile money ou en deux fois, le prix reste {formatUsdCents(listUsdCents)}.
        </p>
      )}
      <form method="get" action={page} className="flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label htmlFor="promo-code" className="text-muted">Code promo</label>
        <input id="promo-code" name="code" defaultValue={code ?? ""} autoCapitalize="characters" className="w-36 rounded-lg border border-line bg-white px-2.5 py-1.5 uppercase" />
        <button className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">Appliquer</button>
      </form>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
