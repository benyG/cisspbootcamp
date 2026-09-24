import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer, Topbar, eyebrow, shell } from "@/components/landing/sections";
import { TrackView } from "@/components/tracking/TrackView";
import { buildServiceOffer } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { mobileMoneyAvailable } from "@/lib/payments/netticket";
import { COUNTRIES } from "@/lib/scanner/questions";
import { isServiceCode } from "@/lib/services";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import { SlotPicker } from "@/components/booking/SlotPicker";
import { formatWhen, listSlots } from "@/lib/booking";
import { readPendingSlot } from "@/lib/pending-slot";

import { forgetConsultingSlot, holdConsultingSlot, payServiceByCard, payServiceByMobileMoney } from "../actions";

export const metadata: Metadata = { title: "Réserver une séance de conseil — CISSP Bootcamp" };
export const dynamic = "force-dynamic";

/**
 * One service: what it covers, the price for the country, the contact form
 * (skipped when the prospect comes from their scanner result) and the two
 * payment methods. Paid first, booked after.
 */
export default async function ServiceOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pays?: string; t?: string; annule?: string; erreur?: string }>;
}) {
  const { code } = await params;
  const { pays, t, annule, erreur } = await searchParams;
  if (!isServiceCode(code)) notFound();

  const known = t && t.length >= 10
    ? await prisma.scannerResponse.findUnique({ where: { resultToken: t }, select: { lead: { select: { firstName: true, country: true } } } }).then((r) => r?.lead ?? null)
    : null;
  const country = known?.country ?? (pays && COUNTRIES.some((c) => c.value === pays) ? pays : "SN");

  const [settings, offer] = await Promise.all([loadSiteSettings().catch(() => SITE_DEFAULTS), buildServiceOffer(code, country)]);
  if (!offer) notFound();
  const { service } = offer;

  // Slot first (Ben, 24/09): the payment form only appears once a slot is kept.
  const pending = await readPendingSlot();
  const held = pending?.kind === "consulting" && pending.service === service.code ? pending : null;
  const listing = held ? null : await listSlots(new Date(), { kind: "consulting", sessionMinutes: service.sessionMinutes }).catch(() => null);

  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const mobileReady = mobileMoneyAvailable(country, offer.netticketTicketCode) || Boolean(!process.env.NETTICKET_API_KEY && process.env.NETTICKET_FALLBACK_URL);

  return (
    <>
      <TrackView name="service_view" label={service.code} />
      <Topbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <div className="mx-auto max-w-xl pt-4 sm:pt-8">
          <Link href={`/rdv?type=approfondie${t ? `&t=${t}` : ""}`} className="text-sm text-muted">← Changer de séance ou de créneau</Link>
          <div className={eyebrow + " mt-4"}>Conseil carrière · {service.durationLabel}{service.code === "mentorat" ? " par mois" : ""}</div>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1] font-black tracking-[-.04em]">{service.name}</h1>
          <p className="mt-3 text-ink-2">{service.tagline}</p>

          {annule && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Paiement annulé. Aucune séance n’est réservée.</p>}
          {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

          <section className="mt-6 rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <ul className="grid gap-1.5 text-[.95rem] text-ink-2">
              {service.description.map((line) => <li key={line} className="relative pl-6 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{line}</li>)}
            </ul>
            <p className="mt-3 text-[.9rem] text-muted"><b className="text-ink">Vous repartez avec :</b> {service.deliverable}.</p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
              <p className="display text-[2.2rem] leading-none font-black tracking-[-.04em]">{offer.usdLabel}</p>
              {offer.localLabel && <p className="font-bold text-muted">≈ {offer.localLabel}</p>}
            </div>
            <p className="mt-2 text-[.82rem] text-muted">
              Tarif {offer.tierCode === "africa" ? "Afrique francophone" : "international"}. Vous choisissez votre créneau juste après le paiement. Report gratuit jusqu’à 24 h avant.
              {service.creditable && " Déduit du bootcamp CISSP si vous vous inscrivez dans les 90 jours."}
            </p>
          </section>

          {!held ? (
            <section className="mt-6">
              <h2 className="display text-[1.3rem] font-black">1. Choisissez votre créneau</h2>
              <p className="mt-1 mb-4 text-[.9rem] text-muted">Séance de {service.sessionMinutes} minutes, le mercredi soir. {known ? "Le paiement confirme ensuite." : "Ensuite, 3 minutes d’analyse de profil, puis le paiement confirme."}</p>
              {listing && listing.available ? (
                <SlotPicker
                  slots={listing.slots.map((s) => s.toISOString())}
                  coachTimeZone={listing.coachTimeZone}
                  submitLabel="Retenir ce créneau →"
                  emptyMessage="Aucun créneau de conseil libre dans les cinq prochaines semaines. Réessayez dans quelques jours."
                  onBook={async ({ start, timezone }) => {
                    "use server";
                    return holdConsultingSlot({ code: service.code, token: t, start, timezone, sessionMinutes: service.sessionMinutes });
                  }}
                />
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">La réservation est momentanément fermée. Réessayez un peu plus tard.</p>
              )}
            </section>
          ) : (
          <form className="mt-6 grid gap-4">
            <input type="hidden" name="code" value={service.code} />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm">
              <span><b>Créneau retenu : {formatWhen(new Date(held.start), held.timezone)}</b> ({held.timezone}). Le paiement le confirme.</span>
              <button formAction={forgetConsultingSlot} className="underline underline-offset-4">Changer</button>
            </div>
            {t && <input type="hidden" name="t" value={t} />}
            {known ? (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{known.firstName}, la séance sera au nom de votre analyse de profil.</p>
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
                  <span>J’accepte que Ben utilise ces informations pour organiser cette séance et me recontacter à ce sujet. <Link href="/confidentialite" className="underline" target="_blank">Politique de confidentialité</Link></span>
                </label>
              </fieldset>
            )}

            <button formAction={payServiceByCard} disabled={!stripeReady} className="rounded-[14px] bg-ink px-5 py-4 text-lg font-extrabold text-white disabled:opacity-50">
              Payer par carte bancaire · {offer.usdLabel}
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
                  <button formAction={payServiceByMobileMoney} className="rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white">Lancer le paiement mobile</button>
                </div>
              </details>
            ) : (
              <p className="text-center text-sm text-muted">Mobile money : disponible pour la zone CEMAC. Pour les autres pays, carte bancaire.</p>
            )}
            <p className="text-xs text-muted">Paiement sécurisé par Stripe. Dès la confirmation, votre séance est réservée et l’invitation arrive par e-mail.</p>
          </form>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}

const input = "w-full rounded-lg border border-line px-3 py-3 text-base";
