import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { balanceOpen, firstDueUsd } from "@/lib/installments";
import { NETTICKET_COUNTRIES } from "@/lib/payments/netticket";
import { formatUsdCents } from "@/lib/pricing";
import { PROGRAMS } from "@/lib/programs";
import { balanceDeadline } from "@/lib/registration";

import { payBalanceByCard, payBalanceByMobileMoney } from "./actions";

export const metadata: Metadata = { title: "Second versement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * The second instalment (Ben, 04/11): the link of the confirmation e-mail
 * and of the reminders. It never marks anything paid: the webhook or the
 * server-side check does; until then the page waits and refreshes.
 */
export default async function BalancePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ attente?: string; mobile?: string; annule?: string; erreur?: string }> }) {
  const { reference } = await params;
  const { attente, mobile, annule, erreur } = await searchParams;
  const registration = /^CB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(reference)
    ? await prisma.registration.findUnique({ where: { reference }, include: { lead: { select: { firstName: true, country: true } }, cohort: { select: { name: true, program: true, startsAt: true } } } })
    : null;
  if (!registration || registration.status !== "paid" || registration.balanceUsd <= 0) notFound();

  const program = PROGRAMS[registration.cohort.program];
  const open = balanceOpen(registration);
  const waiting = open && Boolean(attente);
  const ticket = registration.cohort.program === "cissp"
    ? await prisma.pricingTier.findUnique({ where: { code: registration.tier }, select: { netticketInstallmentCode: true } }).then((r) => r?.netticketInstallmentCode ?? null)
    : await prisma.programPrice.findFirst({ where: { program: registration.cohort.program, tier: registration.tier }, select: { netticketInstallmentCode: true } }).then((r) => r?.netticketInstallmentCode ?? null);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const mobileReady = NETTICKET_COUNTRIES.has(registration.lead.country.toUpperCase()) && (process.env.NETTICKET_API_KEY ? Boolean(ticket) : Boolean(process.env.NETTICKET_FALLBACK_URL));
  const name = `${program.name} — ${registration.cohort.name}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-10">
      {waiting && <meta httpEquiv="refresh" content="5" />}
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">{open ? (waiting ? "Paiement en cours de confirmation" : "Second versement") : "C'est réglé"}</p>
      <h1 className="-mt-3 text-3xl font-bold text-balance">
        {open ? (waiting ? "Encore quelques secondes." : `${registration.lead.firstName}, votre solde : ${formatUsdCents(registration.balanceUsd)}`) : `Merci ${registration.lead.firstName}, votre inscription est entièrement réglée.`}
      </h1>

      {annule && open && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Paiement annulé. Votre solde reste à régler.</p>}
      {erreur && open && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}
      {waiting && (
        <p className="text-lg text-[var(--color-muted)]">
          {mobile ? "Confirmez le paiement sur votre téléphone (code USSD ou notification de l'opérateur). " : "Nous attendons la confirmation de votre banque. "}Cette page se met à jour toute seule ; vous recevrez aussi un e-mail.
        </p>
      )}

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <p className="font-semibold">{name}</p>
        <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5">
          <dt className="text-[var(--color-muted)]">Premier versement{registration.paidAt ? `, le ${day(registration.paidAt)}` : ""}</dt>
          <dd className="text-right font-semibold">{formatUsdCents(firstDueUsd(registration))}</dd>
          <dt className="text-[var(--color-muted)]">{registration.balancePaidAt ? `Second versement, le ${day(registration.balancePaidAt)}` : `Second versement, avant le ${balanceDeadline(registration.cohort.startsAt)}`}</dt>
          <dd className="text-right font-semibold">{formatUsdCents(registration.balanceUsd)}</dd>
          <dt className="border-t border-line pt-1.5 font-semibold">Total</dt>
          <dd className="border-t border-line pt-1.5 text-right font-bold">{formatUsdCents(registration.amountUsd)}</dd>
        </dl>
        <p className="mt-3 text-[var(--color-muted)]">Référence {registration.reference} · <Link href={`/inscription/recu/${registration.reference}`} className="underline">votre reçu</Link></p>
      </section>

      {open && !waiting && (
        <form className="flex flex-col gap-3">
          <input type="hidden" name="reference" value={registration.reference} />
          <button formAction={payBalanceByCard} disabled={!stripeReady} className={primary + " disabled:opacity-50"}>
            Payer par carte bancaire · {formatUsdCents(registration.balanceUsd)}
          </button>
          {mobileReady ? (
            <details className="rounded-lg border border-line bg-white">
              <summary className="cursor-pointer list-none px-5 py-4 text-center font-semibold">Payer par mobile money (Orange Money, MTN MoMo)</summary>
              <div className="grid gap-3 border-t border-line p-4">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"><input type="radio" name="operator" value="orange" defaultChecked className="accent-accent" />Orange Money</label>
                  <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"><input type="radio" name="operator" value="mtn" className="accent-accent" />MTN MoMo</label>
                </div>
                <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Numéro mobile money</span><input name="phone" inputMode="numeric" placeholder="677123456" className="rounded-lg border border-line px-3 py-3 text-base" /></label>
                <p className="text-xs text-muted">Vous recevrez une demande de confirmation sur votre téléphone. Montant en FCFA au tarif Netticket.</p>
                <button formAction={payBalanceByMobileMoney} className={primary}>Lancer le paiement mobile</button>
              </div>
            </details>
          ) : (
            <p className="text-center text-sm text-muted">Mobile money : disponible pour la zone CEMAC. Pour les autres pays, carte bancaire.</p>
          )}
          <p className="text-xs text-[var(--color-muted)]">Paiement sécurisé par Stripe. Vous recevez un e-mail de confirmation et votre reçu mis à jour. Une question ? Répondez simplement à l&apos;e-mail de confirmation de votre place.</p>
        </form>
      )}
    </main>
  );
}

const primary = "block w-full rounded-lg bg-[var(--color-accent)] px-5 py-4 text-center text-lg font-semibold text-white";
