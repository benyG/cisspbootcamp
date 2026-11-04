import { formatUsdCents } from "@/lib/pricing";
import type { TwoPaymentPlan } from "@/lib/installments";

/**
 * Pay at once or in two instalments (Ben, 04/11). A plain radio named
 * "plan" inside the payment form: no script, the server reads it. The
 * form's buttons show the amount of the chosen plan with PlanAmount.
 */
export function PlanChoice({ fullUsd, fullLocal, plan, firstLocal, deadline, mobileTwo = true }: {
  fullUsd: number;
  fullLocal?: string | null;
  plan: TwoPaymentPlan;
  firstLocal?: string | null;
  /** "le samedi 23 janvier (premier jour)", "votre J1"… */
  deadline: string;
  /** False when mobile money takes only a payment at once. */
  mobileTwo?: boolean;
}) {
  const card = "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft";
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-bold">Comment souhaitez-vous payer ?</legend>
      <label className={card}>
        <input type="radio" name="plan" value="full" defaultChecked className="mt-1 size-4 shrink-0 accent-accent" />
        <span>
          <b className="block">En une fois · {formatUsdCents(fullUsd)}</b>
          {fullLocal && <span className="text-[.88rem] text-muted">≈ {fullLocal}</span>}
        </span>
      </label>
      <label className={card}>
        <input type="radio" name="plan" value="two" className="mt-1 size-4 shrink-0 accent-accent" />
        <span>
          <b className="block">En deux fois · {plan.firstUsd === plan.balanceUsd ? `2 × ${formatUsdCents(plan.balanceUsd)}` : `${formatUsdCents(plan.firstUsd)} + ${formatUsdCents(plan.balanceUsd)}`}</b>
          <span className="text-[.88rem] text-muted">
            {formatUsdCents(plan.firstUsd)}{firstLocal ? ` (≈ ${firstLocal})` : ""} aujourd’hui, puis {formatUsdCents(plan.balanceUsd)} avant {deadline}. Total {formatUsdCents(plan.totalUsd)}. Votre place est réservée dès le premier versement.
            {!mobileTwo && " Mobile money : en une fois seulement."}
          </span>
        </span>
      </label>
    </fieldset>
  );
}

/** The amount on a pay button, following the plan picked in the same form (the form carries the "group" class). */
export function PlanAmount({ full, first }: { full: string; first: string | null }) {
  if (!first) return <>{full}</>;
  return (
    <>
      <span className="group-has-[input[name=plan][value=two]:checked]:hidden">{full}</span>
      <span className="hidden group-has-[input[name=plan][value=two]:checked]:inline">{first}</span>
    </>
  );
}
