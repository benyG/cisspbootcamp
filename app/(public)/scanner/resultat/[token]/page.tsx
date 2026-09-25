import Link from "next/link";
import { notFound } from "next/navigation";

import { btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import { QuickSlots } from "@/components/booking/QuickSlots";
import { PracticeTestBox } from "@/components/examboot/PracticeTestBox";
import { bookWithResultToken } from "@/app/(public)/rdv/actions";
import { bookingCode, formatWhen, listSlots } from "@/lib/booking";
import { PromoPrice } from "@/components/offer/PromoPrice";
import { TrackLink } from "@/components/tracking/TrackLink";
import { TrackView } from "@/components/tracking/TrackView";
import type { ProfileAnalysis } from "@/lib/analysis";
import { prospectAxes } from "@/lib/analysis";
import { publicCohortSummary } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { examBootEnabled } from "@/lib/examboot/client";
import { formatCohortMonth as formatCohortMonthLabel } from "@/lib/cohorts";
import { convertUsdCents, formatLocal, formatUsdCents, isQuoteOnly, localCurrencyFor, resolveTierCode } from "@/lib/pricing";
import { loadRates } from "@/lib/registration";
import { buildServiceOffer } from "@/lib/consulting";
import { PROGRAMS, recommendedProgram } from "@/lib/programs";
import { loadScannerContext } from "@/lib/scanner/context";
import { recommendedService } from "@/lib/services";
import { QUESTIONS } from "@/lib/scanner/questions";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import { RevealBars } from "./reveal";

export const dynamic = "force-dynamic";

const VERDICT = {
  ready: { badge: "Éligible au titre CISSP", tone: "bg-accent-soft text-accent-ink" },
  conditional: { badge: "Éligible via Associate of ISC²", tone: "bg-amber-100 text-amber-900" },
  not_yet: { badge: "Fondations, puis Associate of ISC²", tone: "bg-slate-100 text-ink-2" },
} as const;

/**
 * The prospect's result, shown the moment the questionnaire is submitted and
 * reachable by token afterwards (the e-mail links here). The sales follow-up
 * Ben validates is a separate message; it never gates this page.
 */
export default async function ScannerResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await prisma.scannerResponse.findUnique({
    where: { resultToken: token },
    include: { lead: { select: { firstName: true, country: true, bookings: { where: { status: "scheduled", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 1 } } } },
  });
  if (!response) notFound();
  const upcoming = response.lead.bookings[0] ?? null;

  // The offer, priced for the prospect's country: this page is the hottest
  // moment of the funnel (docs/CONVERSION.md §2.6), so the promotional price
  // and the admission deadline are shown here, not only on the landing.
  const [settings, cohort, context, rates] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    publicCohortSummary().catch(() => null),
    loadScannerContext().catch(() => null),
    loadRates().catch(() => ({})),
  ]);
  const tierCode = context ? resolveTierCode(response.lead.country, context.tiers) : null;
  const tier = context && tierCode && !isQuoteOnly(tierCode) ? context.tiers.find((t) => t.code === tierCode) : null;
  const currency = localCurrencyFor(response.lead.country);
  const localCents = tier && currency !== "USD" ? convertUsdCents(tier.amountUsd, currency, rates) : null;
  const localLabel = localCents !== null ? formatLocal(localCents, currency) : null;
  const ccLocal = (cents: number) => {
    if (currency === "USD") return null;
    const local = convertUsdCents(cents, currency, rates);
    return local === null ? null : formatLocal(local, currency);
  };

  const answers = response.answers as { examGoal?: string; experience?: "none" | "one_two" | "three_four" | "five_plus"; professionalStatus?: "employed" | "student" | "career_change" | "freelance" };
  const goalQuestion = QUESTIONS.find((q) => q.id === "examGoal");
  const goalLabel = goalQuestion && "options" in goalQuestion ? goalQuestion.options.find((o) => o.value === answers.examGoal)?.label ?? null : null;

  const analysis = response.analysis as unknown as ProfileAnalysis;
  const axes = prospectAxes(analysis.axes);
  const verdict = VERDICT[analysis.readiness];
  // The free 15-minute contact is open to every verdict (Ben, 24/09).
  const canBook = true;
  const canRegisterNow = response.status === "approved" || response.status === "sent" || (analysis.readiness === "ready" && settings.offer.directRegistrationForReady);

  // The step that fits (docs/OFFRES.md §4): the main offer for "pas encore",
  // a secondary one for "sous conditions", nothing for "prêt".
  const profile = { experience: answers.experience ?? "one_two", professionalStatus: answers.professionalStatus ?? "employed" } as const;
  // Consulting speaks to every level (Ben, 24/09): the session that fits this profile, whatever the verdict.
  const serviceCode = recommendedService(analysis.readiness, profile);
  const service = await buildServiceOffer(serviceCode, response.lead.country).catch(() => null);
  const serviceLead =
    analysis.readiness === "ready"
      ? "Et après le CISSP ? Une heure pour dessiner la suite : poste, spécialisation, management."
      : analysis.readiness === "conditional"
        ? "En parallèle, une heure pour poser votre trajectoire, pas seulement l’examen."
        : "Et pour poser toute la trajectoire, pas seulement la première marche ?";
  // Foundations path: the CC course first, the CISSP as Associate right after (Ben, 25/09).
  const programCode = recommendedProgram(analysis.readiness, profile);
  const ccCohort = programCode === "cc" ? await publicCohortSummary("cc").catch(() => null) : null;
  const ccPrice = programCode === "cc" && tierCode && !isQuoteOnly(tierCode) ? await prisma.programPrice.findUnique({ where: { program_tier: { program: "cc", tier: tierCode } } }).catch(() => null) : null;

  // The next slots, right here: the call is booked in one tap (brainstorm 24/09).
  const slots = canBook && !upcoming ? await listSlots().then((l) => (l.available ? l : null)).catch(() => null) : null;

  // One route per profile (docs/LANDING.md §24); the headline names it plainly.
  const route = analysis.recommendation !== "build_first" ? "bootcamp" : programCode === "cc" ? "cc" : "career";
  const headline =
    route === "cc" ? "Vous êtes sur la bonne trajectoire, mais le CISSP est encore prématuré."
    : route === "career" ? "Votre prochaine étape est surtout de structurer votre trajectoire."
    : analysis.readiness === "ready" ? "Votre profil est compatible avec le bootcamp."
    : analysis.headline;

  return (
    <main className={shell + " py-8 sm:py-12"}>
      <TrackView name="result_view" label={route} />
      <div className="mx-auto max-w-2xl">
        {upcoming && (
          <p className="mb-5 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm">
            <b>Rendez-vous confirmé : {formatWhen(upcoming.startsAt, upcoming.timezone)}</b> ({upcoming.timezone}) · code {bookingCode(upcoming.id)}. L’invitation est dans votre boîte mail.{" "}
            <Link href={`/rdv/${upcoming.rescheduleToken}`} className="underline underline-offset-4">Déplacer ou annuler</Link>
          </p>
        )}
        <span className={`inline-flex rounded-full px-3 py-1.5 text-[.82rem] font-extrabold ${verdict.tone}`}>{verdict.badge}</span>
        <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.8rem)] leading-[.98] font-black tracking-[-.05em]">
          {response.lead.firstName}, {headline.charAt(0).toLowerCase() + headline.slice(1)}
        </h1>

        <RevealBars axes={axes.map((a) => ({ key: a.key, label: a.label, score: a.score, detail: a.detail }))} />

        {examBootEnabled() && (
          <div className="mt-8">
            <PracticeTestBox placement="resultat" token={token} title="Testez votre raisonnement CISSP" text="Votre analyse dit où vous en êtes. Cinq questions d’entraînement, au niveau et dans l’esprit du CISSP, corrigées, montrent comment vous raisonnez. Sans compte, en dix minutes." />
          </div>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] bg-ink p-5 text-white">
            <div className="text-[.72rem] font-extrabold tracking-[.1em] text-[#7be0c8] uppercase">Avec accompagnement</div>
            <div className="display mt-1 text-[2.4rem] leading-none font-black tracking-[-.04em]">{analysis.timeline.label}</div>
            <p className="mt-2 text-[.9rem] text-[#cbd5df]">jusqu’à l’examen, avec quelqu’un qui tient le rythme avec vous.</p>
          </div>
          <div className="rounded-[18px] border border-line bg-white p-5">
            <div className="text-[.72rem] font-extrabold tracking-[.1em] text-muted uppercase">Seul</div>
            <div className="display mt-1 text-[2.4rem] leading-none font-black tracking-[-.04em] text-muted">{analysis.timeline.soloLabel}</div>
            <p className="mt-2 text-[.9rem] text-muted">d’après ce que Ben observe chez les candidats qui préparent sans cadre.</p>
          </div>
        </section>
        {goalLabel && (
          <p className="mt-3 text-[.95rem] text-ink-2">
            <b>Votre objectif :</b> {goalLabel.charAt(0).toLowerCase() + goalLabel.slice(1)}. Seul, comptez {analysis.timeline.soloLabel} ; accompagné, {analysis.timeline.label}.
          </p>
        )}
        {analysis.goalIsTight && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[.92rem] text-amber-900">Votre objectif de date est plus serré que cette estimation. Il reste jouable, à condition d’attaquer les domaines non couverts dès la première semaine.</p>
        )}

        <section className="mt-8">
          <div className={eyebrow}>Ce qu’il faut en retenir</div>
          <ul className="mt-4 grid gap-3">
            {analysis.axes.filter((a) => a.audience === "prospect").map((a) => (
              <li key={a.key} className="rounded-[14px] border border-line bg-white px-4 py-3 text-ink-2"><b className="text-ink">{a.label}</b> — {a.detail}</li>
            ))}
          </ul>
        </section>

        {canBook && (
          <section className="mt-8 rounded-[18px] bg-ink p-5 text-white">
            <div className="text-[.72rem] font-extrabold tracking-[.1em] text-[#7be0c8] uppercase">Ce que coûte un essai raté</div>
            <ul className="mt-3 grid gap-2 text-[.95rem] text-[#e6ebf1] sm:grid-cols-3">
              <li><b className="display block text-[1.5rem] text-white">~750 USD</b>de frais d’examen ISC², à repayer intégralement.</li>
              <li><b className="display block text-[1.5rem] text-white">30 jours</b>d’attente minimum avant de pouvoir repasser.</li>
              <li><b className="display block text-[1.5rem] text-white">Des semaines</b>de révision à refaire, et la promotion qui attend.</li>
            </ul>
            {tier && <p className="mt-3 text-[.86rem] text-[#cbd5df]">Le bootcamp coûte moins qu’un seul échec, et il est conçu pour qu’il n’y en ait pas.</p>}
          </section>
        )}

        <section className="mt-10 rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-panel)]">
          <h2 className="display text-[1.6rem] leading-tight font-black">
            {upcoming
              ? "Votre rendez-vous est pris."
              : analysis.readiness === "conditional"
                ? "Prochaine étape : 15 minutes avec Ben pour caler votre plan Associate et votre date d’examen."
                : analysis.readiness === "ready"
                  ? "Prochaine étape : 15 minutes avec Ben, puis votre place."
                  : "Prochaine étape : 15 minutes avec Ben, gratuites, pour caler votre première certification et la suite vers le CISSP."}
          </h2>
          <p className="mt-2 text-ink-2">
            {upcoming
              ? "Ben arrive à l’appel avec votre analyse sous les yeux. D’ici là, tout ce qui suit reste ouvert."
              : analysis.readiness === "conditional"
                ? "Un appel vidéo, sans engagement. Ben passe en revue vos années comptables et la dérogation possible, puis vous fixez ensemble votre date d’examen. Le titre Associate of ISC² s’obtient dès l’examen réussi."
                : analysis.readiness === "ready"
                  ? "Un appel vidéo, sans engagement, pour caler votre date d’examen et le plan des 15 jours. Si vous avez déjà décidé, vous pouvez réserver votre place directement."
                  : "Un premier contact gratuit, sans engagement : Ben regarde votre profil avec vous, cale la CC en 15 jours et le passage au CISSP en Associate of ISC² juste après."}
          </p>
          {canBook && tier && analysis.readiness !== "not_yet" && (
            <div className="mt-5 rounded-[18px] border border-line bg-[#fbfffd] p-4">
              <PromoPrice amountUsdCents={tier.amountUsd} localLabel={localLabel} offer={settings.offer} cohort={cohort ? { startsAt: cohort.startsAt } : null} />
              {cohort && <p className="mt-2 text-[.86rem] text-muted">{cohort.gauge.label}, cohorte de {cohort.name.replace(/^Cohorte /, "")}.</p>}
            </div>
          )}
          {canBook ? (
            <>
              {slots && slots.slots.length > 0 ? (
                <QuickSlots
                  slots={slots.slots.slice(0, 4).map((s) => s.toISOString())}
                  coachTimeZone={slots.coachTimeZone}
                  moreHref={`/rdv?t=${token}`}
                  onBook={async ({ start, timezone }) => {
                    "use server";
                    return bookWithResultToken({ token, start, timezone });
                  }}
                />
              ) : (
                <TrackLink href={`/rdv?t=${token}`} event="book_click" label="resultat" className={btnPrimary + " mt-5 w-full"}>Réserver mon appel →</TrackLink>
              )}
              {canRegisterNow && tier && analysis.readiness !== "not_yet" && (
                <TrackLink href={`/inscription?t=${token}`} event="cta_click" label="resultat-inscription" className="mt-3 inline-flex w-full items-center justify-center rounded-[14px] border border-line bg-white px-5 py-3.5 font-extrabold">
                  Rejoindre la cohorte →
                </TrackLink>
              )}
              {analysis.readiness === "not_yet" && programCode === "cc" && (
                <div className="mt-4 rounded-[18px] border-2 border-ink bg-ink p-4 text-white">
                  <p className="text-[.78rem] font-extrabold tracking-[.06em] text-[#7be0c8] uppercase">Votre première marche · {PROGRAMS.cc.hours} h sur {PROGRAMS.cc.days} jours</p>
                  <p className="display mt-1 text-[1.25rem] leading-tight font-black">15 jours pour votre première certification : la CC d’ISC².</p>
                  <p className="mt-1 text-[.92rem] text-[#cbd5df]">Aucun prérequis, la même maison que le CISSP, et le CISSP en Associate of ISC² juste derrière.{ccCohort ? ` Prochaine session en ${formatCohortMonthLabel(ccCohort.startsAt)}.` : ""}{ccPrice ? ` ${formatUsdCents(ccPrice.amountUsd)}${ccLocal(ccPrice.amountUsd) ? ` ≈ ${ccLocal(ccPrice.amountUsd)}` : ""}.` : ""}</p>
                  <TrackLink href={`/demarrer?t=${token}`} event="cta_click" label="resultat-cc" className="mt-3 inline-flex w-full items-center justify-center rounded-[14px] border border-white/30 px-5 py-3 font-extrabold text-white">Commencer par ISC² CC →</TrackLink>
                </div>
              )}
              {service && (
                <p className="mt-3 rounded-[14px] border border-line bg-white px-4 py-3 text-[.9rem] text-ink-2">
                  {serviceLead} <TrackLink href={`/conseil/${service.service.code}?t=${token}`} event="cta_click" label={`resultat-${service.service.code}`} className="font-bold underline underline-offset-4">{service.service.name}</TrackLink>, {service.service.durationLabel} avec Ben, {service.usdLabel}. <TrackLink href={`/rdv?type=approfondie&t=${token}`} event="cta_click" label="resultat-conseil" className="underline underline-offset-4">Toutes les séances</TrackLink>.
                </p>
              )}
            </>
          ) : programCode === "cc" ? (
            <>
              <div className="mt-5 rounded-[18px] border-2 border-ink bg-ink p-4 text-white">
                <p className="text-[.78rem] font-extrabold tracking-[.06em] text-[#7be0c8] uppercase">Votre première marche · {PROGRAMS.cc.hours} h sur {PROGRAMS.cc.days} jours</p>
                <p className="display mt-1 text-[1.35rem] leading-tight font-black">15 jours pour votre première certification : la CC d’ISC².</p>
                <p className="mt-1 text-[.95rem] text-[#cbd5df]">Aucun prérequis, un examen reconnu, la même maison que le CISSP. Vous en sortez avec une certification, et le CISSP en Associate of ISC² vient juste derrière.{ccCohort ? ` Prochaine session en ${formatCohortMonthLabel(ccCohort.startsAt)} : ${ccCohort.gauge.label.toLowerCase()}.` : ""}</p>
                {ccPrice && <p className="mt-2 text-[.9rem]"><b>{formatUsdCents(ccPrice.amountUsd)}</b>{ccLocal(ccPrice.amountUsd) && <span className="text-[#cbd5df]"> ≈ {ccLocal(ccPrice.amountUsd)}</span>}</p>}
                <TrackLink href={`/demarrer?t=${token}`} event="cta_click" label="resultat-cc" className={btnPrimary + " mt-4 w-full border border-white/20"}>Commencer par ISC² CC →</TrackLink>
              </div>
              {service && (
                <p className="mt-3 rounded-[14px] border border-line bg-white px-4 py-3 text-[.9rem] text-ink-2">
                  Vous préférez d’abord en parler ? <TrackLink href={`/conseil/${service.service.code}?t=${token}`} event="cta_click" label={`resultat-${service.service.code}`} className="font-bold underline underline-offset-4">{service.service.name}</TrackLink>, {service.service.durationLabel} avec Ben, {service.usdLabel}.
                </p>
              )}
            </>
          ) : service ? (
            <div className="mt-5 rounded-[18px] border border-line bg-[#fbfffd] p-4">
              <p className="text-[.78rem] font-extrabold tracking-[.06em] text-accent uppercase">La marche qui vous convient maintenant · {service.service.durationLabel}</p>
              <p className="display mt-1 text-[1.35rem] leading-tight font-black">{service.service.name}</p>
              <p className="mt-1 text-[.95rem] text-ink-2">{service.service.tagline} Vous repartez avec : {service.service.deliverable.charAt(0).toLowerCase() + service.service.deliverable.slice(1)}.</p>
              <p className="mt-2 text-[.9rem]"><b>{service.usdLabel}</b>{service.localLabel && <span className="text-muted"> ≈ {service.localLabel}</span>}{service.service.creditable && <span className="text-muted"> · déduit du bootcamp si vous vous inscrivez dans les 90 jours</span>}</p>
              <TrackLink href={`/conseil/${service.service.code}?t=${token}`} event="cta_click" label={`resultat-${service.service.code}`} className={btnPrimary + " mt-4 w-full"}>Réserver un conseil carrière →</TrackLink>
              <TrackLink href={`/rdv?type=approfondie&t=${token}`} event="cta_click" label="resultat-conseil" className="mt-2 inline-flex w-full items-center justify-center py-2 text-[.9rem] font-bold text-muted underline underline-offset-4">Voir les autres séances</TrackLink>
            </div>
          ) : (
            <Link href="/" className={btnPrimary + " mt-5 w-full"}>Retour à l’accueil</Link>
          )}
          <p className="mt-3 text-[.86rem] text-muted">Cette analyse vous a aussi été envoyée par e-mail. Ben la lit et vous écrit personnellement.</p>
        </section>
      </div>
    </main>
  );
}
