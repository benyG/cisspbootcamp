import type { Metadata } from "next";
import Link from "next/link";

import { PromoPrice } from "@/components/offer/PromoPrice";
import { formatCohortMonth } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { buildOffer } from "@/lib/registration";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import { mobileMoneyAvailable } from "@/lib/payments/netticket";

import { leadIdFromToken, payByCard, payByMobileMoney } from "./actions";

export const metadata: Metadata = { title: "S'inscrire au bootcamp — CISSP Bootcamp" };
export const dynamic = "force-dynamic";

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; annule?: string; erreur?: string }>;
}) {
  const { t, annule, erreur } = await searchParams;
  const leadId = await leadIdFromToken(t);

  if (!leadId) {
    return (
      <Shell title="Commencez par votre analyse de profil.">
        <p className="text-[var(--color-muted)]">
          L&apos;inscription passe par le diagnostic : 3 minutes, et Ben vous dit où vous en êtes.
        </p>
        <Link href="/scanner" className={primary}>Analyser mon profil</Link>
      </Shell>
    );
  }

  const [lead, result, settings] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { firstName: true } }),
    buildOffer(leadId),
    loadSiteSettings().catch(() => SITE_DEFAULTS),
  ]);

  if (!result.offer) {
    return (
      <Shell title={result.reason === "no_cohort" ? "Aucune cohorte ouverte pour l'instant." : "Votre tarif se fait sur devis."}>
        <p className="text-[var(--color-muted)]">
          {result.reason === "no_cohort"
            ? "Ben vous prévient dès que les inscriptions de la prochaine cohorte ouvrent."
            : "Écrivez à Ben pour une proposition adaptée à votre entreprise."}
        </p>
      </Shell>
    );
  }

  const { offer } = result;
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const mobileReady = mobileMoneyAvailable(offer.country, offer.netticketTicketCode) || Boolean(!process.env.NETTICKET_API_KEY && process.env.NETTICKET_FALLBACK_URL);

  return (
    <Shell title={`${lead.firstName}, réservez votre place.`}>
      {annule && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Paiement annulé. Votre place n&apos;est pas réservée.</p>}
      {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
          {offer.cohort.name}
        </p>
        <p className="mt-1 text-[var(--color-muted)]">
          Démarre en {formatCohortMonth(offer.cohort.startsAt)} · 40 h sur 15 jours · en français
        </p>
        <div className="mt-4">
          <PromoPrice amountUsdCents={offer.amountUsdCents} localLabel={offer.localLabel} offer={settings.offer} cohort={{ startsAt: offer.cohort.startsAt }} />
        </div>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Formation et préparation. Les frais d&apos;examen ISC² (~750 USD) se règlent séparément auprès d&apos;ISC².
        </p>
        <p className="mt-3 text-sm font-semibold">
          {offer.seatsLeft} place{offer.seatsLeft > 1 ? "s" : ""} restante{offer.seatsLeft > 1 ? "s" : ""} sur {offer.cohort.capacity}
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <form action={async (formData) => {
          "use server";
          const result = await payByCard(formData);
          if (result && !result.ok) {
            const { redirect } = await import("next/navigation");
            redirect(`/inscription?t=${formData.get("t")}&erreur=${encodeURIComponent(result.error)}`);
          }
        }}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" disabled={!stripeReady} className={primary + " w-full disabled:opacity-50"}>
            Payer par carte bancaire
          </button>
        </form>
        {mobileReady ? (
          <details className="rounded-lg border border-line bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-center font-semibold">Payer par mobile money (Orange Money, MTN MoMo)</summary>
            <form
              className="grid gap-3 border-t border-line p-4"
              action={async (formData) => {
                "use server";
                const result = await payByMobileMoney(formData);
                if (result && !result.ok) {
                  const { redirect } = await import("next/navigation");
                  redirect(`/inscription?t=${formData.get("t")}&erreur=${encodeURIComponent(result.error)}`);
                }
              }}
            >
              <input type="hidden" name="t" value={t} />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"><input type="radio" name="operator" value="orange" defaultChecked className="accent-accent" />Orange Money</label>
                <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"><input type="radio" name="operator" value="mtn" className="accent-accent" />MTN MoMo</label>
              </div>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Numéro mobile money</span><input name="phone" inputMode="numeric" placeholder="677123456" required className="rounded-lg border border-line px-3 py-3 text-base" /></label>
              <p className="text-xs text-muted">Vous recevrez une demande de confirmation sur votre téléphone. Montant en FCFA au tarif Netticket de votre palier.</p>
              <button type="submit" className={primary + " w-full"}>Lancer le paiement mobile</button>
            </form>
          </details>
        ) : (
          <p className="text-center text-sm text-muted">Mobile money : disponible pour la zone CEMAC. Pour les autres pays, carte bancaire.</p>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Paiement sécurisé par Stripe. Votre place est confirmée dès réception du paiement, par e-mail.
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-10">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">Inscription</p>
      <h1 className="-mt-4 text-3xl font-bold text-balance">{title}</h1>
      {children}
    </main>
  );
}

const primary = "block rounded-lg bg-[var(--color-accent)] px-5 py-4 text-center text-lg font-semibold text-white";
