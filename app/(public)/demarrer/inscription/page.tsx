import type { Metadata } from "next";
import Link from "next/link";

import { Footer, Topbar, eyebrow, shell } from "@/components/landing/sections";
import { TrackView } from "@/components/tracking/TrackView";
import { formatAdmissionDeadline, formatCohortMonth, remainingSeats, selectRegistrationCohort } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { mobileMoneyAvailable } from "@/lib/payments/netticket";
import { convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { PROGRAMS } from "@/lib/programs";
import { loadOpenCohorts, loadRates } from "@/lib/registration";
import { COUNTRIES } from "@/lib/scanner/questions";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import { payProgramByCard, payProgramByMobileMoney } from "../actions";

export const metadata: Metadata = { title: "S'inscrire à la formation CC — CISSP Bootcamp" };
export const dynamic = "force-dynamic";

/** Registration to the CC course: cohort, price for the country, contact, payment. */
export default async function ProgramRegistrationPage({ searchParams }: { searchParams: Promise<{ pays?: string; t?: string; annule?: string; erreur?: string }> }) {
  const { pays, t, annule, erreur } = await searchParams;
  const program = PROGRAMS.cc;

  const known = t && t.length >= 10
    ? await prisma.scannerResponse.findUnique({ where: { resultToken: t }, select: { lead: { select: { id: true, firstName: true, country: true } } } }).then((r) => r?.lead ?? null)
    : null;
  const country = known?.country ?? (pays && COUNTRIES.some((c) => c.value === pays) ? pays : "SN");

  const now = new Date();
  const [settings, tiers, prices, rates, cohort] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }),
    prisma.programPrice.findMany({ where: { program: "cc" } }),
    loadRates().catch(() => ({})),
    loadOpenCohorts(now, known?.id, "cc").then((cohorts) => selectRegistrationCohort(cohorts, now, "cc")),
  ]);
  const tierCode = resolveTierCode(country, tiers.map((tier) => ({ code: tier.code, countries: Array.isArray(tier.countries) ? (tier.countries as string[]) : [] })));
  const price = isQuoteOnly(tierCode) ? null : prices.find((p) => p.tier === tierCode) ?? null;
  const currency = localCurrencyFor(country);
  const local = price && currency !== "USD" ? convertUsdCents(price.amountUsd, currency, rates) : null;

  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const mobileReady = mobileMoneyAvailable(country, price?.netticketTicketCode) || Boolean(!process.env.NETTICKET_API_KEY && process.env.NETTICKET_FALLBACK_URL);

  return (
    <>
      <TrackView name="offer_view" label="cc" />
      <Topbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <div className="mx-auto max-w-xl pt-4 sm:pt-8">
          <Link href={`/demarrer${t ? `?t=${t}` : ""}`} className="text-sm text-muted">← La formation CC</Link>
          <div className={eyebrow + " mt-4"}>Inscription · {program.name}</div>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1] font-black tracking-[-.04em]">{known ? `${known.firstName}, réservez votre place.` : "Réservez votre place."}</h1>

          {annule && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Paiement annulé. Votre place n’est pas réservée.</p>}
          {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

          {!cohort || !price ? (
            <section className="mt-6 rounded-[22px] border border-line bg-white p-5">
              <p className="font-bold">{!cohort ? "Aucune session n’est ouverte à l’inscription pour le moment." : "Votre tarif se fait sur devis."}</p>
              <p className="mt-1 text-ink-2">{!cohort ? "Les prochaines dates arrivent. En attendant, une heure de conseil avec Ben vous dit si la CC est la bonne première marche." : "Écrivez à Ben pour une proposition adaptée à votre organisation."}</p>
              <Link href="/conseil/certif" className="mt-4 inline-flex rounded-[14px] border border-line bg-white px-5 py-3 font-extrabold">Choisir ma certification avec Ben →</Link>
            </section>
          ) : (
            <>
              <section className="mt-6 rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
                <p className="text-sm font-semibold tracking-wide text-accent uppercase">{cohort.name}</p>
                <p className="mt-1 text-muted">Démarre en {formatCohortMonth(cohort.startsAt)} · {program.hours} h sur {program.days} jours · en français · admissions jusqu’au {formatAdmissionDeadline(cohort.startsAt)}</p>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
                  <p className="display text-[2.2rem] leading-none font-black tracking-[-.04em]">{formatUsdCents(price.amountUsd)}</p>
                  {local !== null && <p className="font-bold text-muted">≈ {formatLocal(local, currency)}</p>}
                </div>
                <p className="mt-2 text-[.82rem] text-muted">Tarif {tierCode === "africa" ? "Afrique francophone" : "international"}. {program.examNote}</p>
                <p className="mt-3 text-sm font-semibold">{remainingSeats(cohort)} place{remainingSeats(cohort) > 1 ? "s" : ""} restante{remainingSeats(cohort) > 1 ? "s" : ""} sur {cohort.capacity}</p>
              </section>

              <form className="mt-6 grid gap-4">
                {t && <input type="hidden" name="t" value={t} />}
                {known ? (
                  <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{known.firstName}, l’inscription sera au nom de votre analyse de profil.</p>
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

                <button formAction={payProgramByCard} disabled={!stripeReady} className="rounded-[14px] bg-ink px-5 py-4 text-lg font-extrabold text-white disabled:opacity-50">
                  Payer par carte bancaire · {formatUsdCents(price.amountUsd)}
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
                      <button formAction={payProgramByMobileMoney} className="rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white">Lancer le paiement mobile</button>
                    </div>
                  </details>
                ) : (
                  <p className="text-center text-sm text-muted">Mobile money : disponible pour la zone CEMAC. Pour les autres pays, carte bancaire.</p>
                )}
                <p className="text-xs text-muted">Paiement sécurisé par Stripe. Votre place est confirmée dès réception du paiement, par e-mail, avec votre reçu.</p>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

const input = "w-full rounded-lg border border-line px-3 py-3 text-base";
