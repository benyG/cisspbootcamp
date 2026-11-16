import { CARD_ONLY_LINE, MAX_IT_TIP, showMaxItTip } from "@/lib/payments/card-only";

/** Under the card button: card only, and the Max it tip for Orange Money countries. */
export function CardOnlyNote({ country }: { country: string | null | undefined }) {
  return (
    <div className="grid gap-2 text-center text-sm text-muted">
      <p>{CARD_ONLY_LINE}</p>
      {showMaxItTip(country) && <p className="rounded-lg bg-accent-soft px-3 py-2 text-left text-accent-ink">{MAX_IT_TIP}</p>}
    </div>
  );
}
