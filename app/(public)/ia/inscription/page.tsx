import type { Metadata } from "next";
import Link from "next/link";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { eyebrow, shell } from "@/components/landing/sections";
import { PlanAmount, PlanChoice } from "@/components/payment/PlanChoice";
import { TrackView } from "@/components/tracking/TrackView";
import { formatAdmissionDeadline } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { IA_ZONE, journeeSlot, longDate } from "@/lib/ia-days";
import { twoPaymentPlan } from "@/lib/installments";
import { openIaEntries } from "@/lib/ia-days-server";
import { mobileMoneyAvailable } from "@/lib/payments/netticket";
import { convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { PROGRAMS } from "@/lib/programs";
import { loadRates } from "@/lib/registration";
import { COUNTRIES } from "@/lib/scanner/questions";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import { payIaByCard, payIaByMobileMoney } from "./actions";
import { iaPath } from "@/lib/ia-domain";

export const metadata: Metadata = {
  title: "Réserver ma place · Bâtisseur IA",
  robots: { index: false, follow: true },
  openGraph: { title: "Bâtisseur IA : réservez votre place", description: "6 journées le week-end pour construire votre application avec Claude Code.", siteName: "Bâtisseur IA" },
  twitter: { title: "Bâtisseur IA : réservez votre place" },
};
export const dynamic = "force-dynamic";

const clock = (d: Date, timeZone: string) => d.toLocaleTimeString("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).replace(":", " h ").replace(" h 00", " h");

/** Bâtisseur IA registration: entry date, price for the country, contact, payment. */
export default async function IaRegistrationPage({ searchParams }: { searchParams: Promise<{ pays?: string; t?: string; entree?: string; annule?: string; erreur?: string }> }) {
  const { pays, t, entree, annule, erreur } = await searchParams;
  const program = PROGRAMS.ia;

  const known = t && t.length >= 10
    ? await prisma.iaDiagnostic.findUnique({ where: { token: t }, select: { lead: { select: { id: true, firstName: true, country: true } } } }).then((r) => r?.lead ?? null)
    : null;
  const country = known?.country ?? (pays && COUNTRIES.some((c) => c.value === pays) ? pays : "SN");

  const [settings, tiers, prices, rates, entries] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }),
    prisma.programPrice.findMany({ where: { program: "ia" } }),
    loadRates().catch(() => ({})),
    openIaEntries(new Date(), known?.id),
  ]);
  const tierCode = resolveTierCode(country, tiers.map((tier) => ({ code: tier.code, countries: Array.isArray(tier.countries) ? (tier.countries as string[]) : [] })));
  const price = isQuoteOnly(tierCode) ? null : prices.find((p) => p.tier === tierCode) ?? null;
  const currency = localCurrencyFor(country);
  const local = price && currency !== "USD" ? convertUsdCents(price.amountUsd, currency, rates) : null;
  // Payment in two instalments (lib/installments.ts), when Ben set an instalment for this tier.
  const plan = price ? twoPaymentPlan(price.installmentUsd) : null;
  const firstLocal = plan && currency !== "USD" ? convertUsdCents(plan.firstUsd, currency, rates) : null;
  const selected = entries.find((e) => String(e.cohortId) === entree)?.cohortId ?? entries[0]?.cohortId;

  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const mobileReady = mobileMoneyAvailable(country, price?.netticketTicketCode) || Boolean(!process.env.NETTICKET_API_KEY && process.env.NETTICKET_FALLBACK_URL);

  return (
    <>
      <TrackView name="offer_view" label="ia" />
      <IaTopbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <div className="mx-auto max-w-xl pt-2 sm:pt-6">
          <Link href={iaPath("/ia")} className="text-sm text-muted">← Le programme</Link>
          <div className={eyebrow + " mt-4"}>Inscription · {program.name}</div>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1] font-black tracking-[-.04em]">{known ? `${known.firstName}, réservez votre place.` : "Réservez votre place."}</h1>

          {annule && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Paiement annulé. Votre place n’est pas réservée.</p>}
          {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

          {!entries.length || !price ? (
            <section className="mt-6 rounded-[22px] border border-line bg-white p-5">
              <p className="font-bold">{!entries.length ? "Aucune date d’entrée n’est ouverte pour le moment." : "Votre tarif se fait sur devis."}</p>
              <p className="mt-1 text-ink-2">{!entries.length ? "Les prochaines dates arrivent. Faites le diagnostic : Ben vous écrit dès l’ouverture." : "Écrivez à Ben pour une proposition adaptée à votre organisation."}</p>
              <Link href={iaPath("/ia/diagnostic")} className="mt-4 inline-flex rounded-[14px] border border-line bg-white px-5 py-3 font-extrabold">Faire le diagnostic →</Link>
            </section>
          ) : (
            <form className="group mt-6 grid gap-4">
              {t && <input type="hidden" name="t" value={t} />}
              <fieldset className="grid gap-2 rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
                <legend className="px-1 text-sm font-bold">Votre J1</legend>
                {entries.map((e) => {
                  const slot = journeeSlot(e.date, e.start);
                  return (
                    <label key={e.cohortId} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                      <input type="radio" name="entree" value={e.cohortId} defaultChecked={e.cohortId === selected} className="mt-1 size-4 shrink-0 accent-accent" />
                      <span>
                        <b className="block first-letter:uppercase">{longDate(e.date)}</b>
                        <span className="text-[.88rem] text-muted">{clock(slot.startsAt, IA_ZONE)}–{clock(slot.endsAt, IA_ZONE)} Montréal · {clock(slot.startsAt, "Africa/Douala")}–{clock(slot.endsAt, "Africa/Douala")} Douala · {e.left} place{e.left > 1 ? "s" : ""} sur {e.capacity} · inscriptions jusqu’au {formatAdmissionDeadline(e.startsAt)}</span>
                      </span>
                    </label>
                  );
                })}
                <p className="text-[.82rem] text-muted">Vous choisissez ensuite vos J2 à J6 parmi les week-ends suivants, sur votre calendrier personnel.</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 border-t border-line pt-3">
                  <p className="display text-[2.2rem] leading-none font-black tracking-[-.04em]">{formatUsdCents(price.amountUsd)}</p>
                  {local !== null && <p className="font-bold text-muted">≈ {formatLocal(local, currency)}</p>}
                </div>
                <p className="text-[.82rem] text-muted">Tarif {tierCode === "africa" ? "Afrique francophone" : "international"} · {program.hours} h en direct sur {program.days} journées. {program.examNote}</p>
              </fieldset>

              {plan && (
                <PlanChoice
                  fullUsd={price.amountUsd}
                  fullLocal={local !== null ? formatLocal(local, currency) : null}
                  plan={plan}
                  firstLocal={firstLocal !== null ? formatLocal(firstLocal, currency) : null}
                  deadline="votre J1"
                  mobileTwo={Boolean(price.netticketInstallmentCode) || !process.env.NETTICKET_API_KEY}
                />
              )}

              {known ? (
                <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{known.firstName}, l’inscription sera au nom de votre diagnostic.</p>
              ) : (
                <fieldset className="grid gap-3 rounded-[18px] border border-line bg-white p-4">
                  <legend className="px-1 text-sm font-bold">Vos coordonnées</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="firstName" placeholder="Prénom" autoComplete="given-name" required className={input} />
                    <input name="lastName" placeholder="Nom" autoComplete="family-name" required className={input} />
                  </div>
                  <input name="email" type="email" placeholder="E-mail" autoComplete="email" required className={input} />
                  <input name="whatsapp" type="tel" placeholder="WhatsApp (facultatif, ex. +237 6…)" autoComplete="tel" className={input} />
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Pays</span>
                    <select name="pays" defaultValue={country} className={input}>
                      {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <span className="text-xs text-muted">Le prix affiché dépend du pays ; changez-le ici puis rechargez la page si besoin.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input name="consent" type="checkbox" required className="mt-1 size-5 shrink-0 accent-accent" />
                    <span>J’accepte que Ben utilise ces informations pour organiser la formation et me recontacter à ce sujet. <Link href="/confidentialite" className="underline" target="_blank">Politique de confidentialité</Link></span>
                  </label>
                </fieldset>
              )}

              <button formAction={payIaByCard} disabled={!stripeReady} className="rounded-[14px] bg-ink px-5 py-4 text-lg font-extrabold text-white disabled:opacity-50">
                Payer par carte bancaire · <PlanAmount full={formatUsdCents(price.amountUsd)} first={plan ? formatUsdCents(plan.firstUsd) : null} />
              </button>
              {mobileReady ? (
                <details className="rounded-[14px] border border-line bg-white">
                  <summary className="cursor-pointer list-none px-5 py-4 text-center font-bold">Payer par mobile money (Orange Money, MTN MoMo)</summary>
                  <div className="grid gap-3 border-t border-line p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"><input type="radio" name="operator" value="orange" defaultChecked className="accent-accent" />Orange Money</label>
                      <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"><input type="radio" name="operator" value="mtn" className="accent-accent" />MTN MoMo</label>
                    </div>
                    <input name="phone" inputMode="numeric" placeholder="Numéro mobile money, ex. 677123456" className={input} />
                    <p className="text-xs text-muted">Vous recevrez une demande de confirmation sur votre téléphone. Montant en FCFA au tarif Netticket.</p>
                    <button formAction={payIaByMobileMoney} className="rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white">Lancer le paiement mobile</button>
                  </div>
                </details>
              ) : (
                <p className="text-center text-sm text-muted">Mobile money : disponible pour la zone CEMAC. Pour les autres pays, carte bancaire.</p>
              )}
              <p className="text-xs text-muted">Paiement sécurisé par Stripe. Votre place est confirmée dès réception du paiement, par e-mail, avec votre reçu.</p>
            </form>
          )}
        </div>
      </main>
      <IaFooter coach={settings.coach.name} />
    </>
  );
}

const input = "w-full rounded-lg border border-line px-3 py-3 text-base";
