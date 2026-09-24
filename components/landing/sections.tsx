import Image from "next/image";
import Link from "next/link";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import { PracticeTestBox } from "@/components/examboot/PracticeTestBox";
import { TrackFaq } from "@/components/tracking/TrackFaq";
import { TrackLink } from "@/components/tracking/TrackLink";
import type { Gauge } from "@/lib/cohorts";
import { admissionClosesAt, formatAdmissionDeadline, formatCohortMonth } from "@/lib/cohorts";
import { AdmissionCountdown } from "@/components/offer/AdmissionCountdown";
import { examBootEnabled } from "@/lib/examboot/client";
import { DOMAIN_LABELS } from "@/lib/scanner/questions";
import { CISSP_DOMAINS } from "@/lib/scoring";
import type { SiteSettings } from "@/lib/site-settings";
import { splitHighlight } from "@/lib/site-settings";

/**
 * Landing sections (docs/LANDING.md, 24/09/2026): one question per section,
 * three proofs at most, one action. Copy comes from site settings; cohort
 * and gauge from the database.
 */

export const shell = "mx-auto w-[min(1180px,calc(100%-32px))]";
export const eyebrow = "inline-flex items-center gap-2.5 rounded-2xl border border-accent/20 bg-white px-3.5 py-2.5 text-[.76rem] font-extrabold tracking-[.08em] uppercase shadow-[var(--shadow-card)]";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-[14px] bg-ink px-5.5 py-4 font-extrabold text-white shadow-[0_10px_30px_rgba(7,26,51,.18)] transition-transform hover:-translate-y-0.5";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-[14px] border border-line bg-white px-5.5 py-4 font-extrabold";
const sectionTitle = "display mt-3 mb-7 max-w-[860px] text-[clamp(2rem,3.6vw,3.6rem)] leading-[.98] font-black tracking-[-.05em]";

export type HeroCohort = { name: string; startsAt: Date; gauge: Gauge } | null;

/**
 * Scarcity only when it is real (docs/LANDING.md §15): the capacity as a
 * fact until a seat is taken, the live gauge from the first one on.
 */
export function seatsLine(gauge: Gauge): string {
  const taken = gauge.confirmed + gauge.held;
  if (taken === 0) return `${gauge.capacity} participants maximum`;
  return gauge.label;
}

export function Topbar() {
  return (
    <header className={shell}>
      <div className="flex items-center justify-between py-5">
        <Link href="/" className="display text-[1.18rem] font-black tracking-[-.04em]">CISSP <span className="text-accent">Bootcamp</span></Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <TrackLink href="/conseil" label="topbar-conseil" className="px-2 py-2.5 text-[.92rem] font-bold text-ink-2 underline-offset-4 hover:underline">Conseil carrière</TrackLink>
          <TrackLink href="/#evaluation" label="topbar" className="hidden rounded-full border border-line bg-white px-4 py-2.5 text-[.92rem] font-bold sm:inline-flex">Analyser mon profil →</TrackLink>
        </nav>
      </div>
    </header>
  );
}

/** One line of context, the headline, one sentence, three proofs, one action. */
export function Hero({ settings, cohort }: { settings: SiteSettings; cohort: HeroCohort }) {
  const { hero, coach } = settings;
  const title = splitHighlight(hero.title);
  return (
    <section className={shell + " grid items-center gap-10 pt-4 pb-12 lg:grid-cols-[1.1fr_.9fr]"}>
      <div>
        <p className="text-[.76rem] font-extrabold tracking-[.1em] text-accent-ink uppercase">
          {cohort ? `Cohorte ${formatCohortMonth(cohort.startsAt)} · ${cohort.gauge.capacity} places · admissions jusqu’au ${formatAdmissionDeadline(cohort.startsAt)}` : "Prochaine cohorte"} · 100 % en français
        </p>
        <h1 className={`display my-5 max-w-[840px] font-black tracking-[-.06em] ${hero.title.replace(/[{}]/g, "").length > 44 ? "text-[clamp(2.3rem,4.4vw,4.4rem)] leading-[1]" : "text-[clamp(3rem,6vw,5.9rem)] leading-[.94]"}`}>
          {title.before}{title.highlight && <span className="text-accent">{title.highlight}</span>}{title.after}
        </h1>
        <p className="mb-6 max-w-[700px] text-[clamp(1.08rem,1.4vw,1.3rem)] font-semibold text-ink-2">{hero.lead}</p>
        <ul className="mb-7 flex max-w-[720px] flex-wrap gap-x-6 gap-y-2 text-[.98rem] font-bold text-ink">
          {hero.promises.map((p) => (
            <li key={p.title} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-accent-soft text-[.7rem] font-black text-accent-ink">✓</span>{p.title}</li>
          ))}
        </ul>
        <TrackLink href="#evaluation" label="hero" className={btnPrimary + " w-full sm:w-auto"}>Analyser mon profil — 3 min →</TrackLink>
        <p className="mt-3 text-[.88rem] text-muted">{hero.microcopy}</p>
      </div>

      <div className="relative min-h-[520px] sm:min-h-[600px]">
        {/* The portrait fills the block, head at the top: nothing may sit on the face. */}
        <div className="absolute inset-0 flex items-end justify-center sm:left-14">
          <div className="absolute inset-x-0 bottom-0 h-[78%] rounded-[36px] bg-gradient-to-b from-accent-bright/10 to-accent-bright/[.02]" />
          <Image src="/images/coach-hero.webp" alt={`${coach.name}, coach CISSP`} width={900} height={1006} priority unoptimized className="relative h-full w-full object-contain object-bottom drop-shadow-[0_30px_40px_rgba(7,26,51,.18)]" />
        </div>
        {/* Cohort facts over the jacket, bottom-left, on every screen size (Ben, 24/09): seats and the admission countdown. */}
        <div className="absolute inset-x-4 bottom-6 flex flex-col gap-3 sm:inset-x-auto sm:left-0 sm:w-[280px]">
          {cohort && (
            <div className="flex items-center gap-4 rounded-2xl bg-ink px-4 py-3 text-white shadow-[0_20px_50px_rgba(7,26,51,.25)]">
              <div>
                <div className="text-[.7rem] font-extrabold tracking-[.1em] whitespace-nowrap text-[#7be0c8] uppercase">{cohort.gauge.confirmed + cohort.gauge.held > 0 ? "Places restantes" : "Cohorte"}</div>
                <div className="display text-[1.6rem] leading-none font-black">{cohort.gauge.confirmed + cohort.gauge.held > 0 ? cohort.gauge.remaining : cohort.gauge.capacity} <small className="text-sm font-semibold tracking-normal text-[#cbd5df]">{cohort.gauge.confirmed + cohort.gauge.held > 0 ? `sur ${cohort.gauge.capacity}` : "participants max."}</small></div>
              </div>
              {cohort.gauge.confirmed + cohort.gauge.held > 0 && <div className="flex-1"><CohortGauge gauge={cohort.gauge} showLabel={false} dark /></div>}
            </div>
          )}
          {cohort && (
            <div className="rounded-2xl bg-ink px-4 py-3 text-white shadow-[0_20px_50px_rgba(7,26,51,.25)]">
              <div className="text-[.7rem] font-extrabold tracking-[.1em] text-[#7be0c8] uppercase">Admissions jusqu’au {formatAdmissionDeadline(cohort.startsAt)}</div>
              <div className="mt-1"><AdmissionCountdown closesAt={admissionClosesAt(cohort.startsAt).toISOString()} dark compact /></div>
            </div>
          )}
          <div className="rounded-[18px] border border-line bg-white p-4 shadow-[0_20px_50px_rgba(7,26,51,.14)]">
            <strong className="display block text-base">{coach.name}</strong>
            <span className="mt-1 block text-[.86rem] text-muted">{coach.tagline}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Three numbers, then the sentence that installs the problem. */
export function Proof({ settings }: { settings: SiteSettings }) {
  return (
    <section className="bg-ink py-14 text-white sm:py-16">
      <div className={shell}>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {settings.proof.numbers.slice(0, 3).map((n) => (
            <div key={n.value + n.text} className="rounded-[18px] border border-white/10 bg-white/[.06] p-5">
              <div className="display text-[2.8rem] leading-none font-black tracking-[-.05em] text-[#7be0c8]">{n.value}</div>
              <p className="mt-2 text-[#cbd5df]">{n.text}</p>
            </div>
          ))}
        </div>
        <h2 className="display mt-10 max-w-[860px] text-[clamp(1.8rem,3.4vw,3.2rem)] leading-[1] font-black tracking-[-.05em]">{settings.proof.title}</h2>
        <p className="mt-3 max-w-[720px] text-[#cbd5df]">Votre diagnostic estime votre horizon de préparation selon votre profil : ni promesse, ni délai fixe.</p>
      </div>
    </section>
  );
}

/** Four steps, one line each. */
export function Method({ settings }: { settings: SiteSettings }) {
  const { method } = settings;
  return (
    <section id="methode" className="py-14 sm:py-16">
      <div className={shell}>
        <div className={eyebrow}>La méthode</div>
        <h2 className={sectionTitle}>{method.title}</h2>
        <ol className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {method.steps.map((s, i) => (
            <li key={s.title} className="rounded-[18px] border border-line bg-white p-5">
              <div className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">0{i + 1} · {s.kicker}</div>
              <h3 className="display mt-2.5 mb-2 text-[1.22rem] font-black">{s.title}</h3>
              <p className="text-[.95rem] text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The time objection: what the fifteen days look like next to a job. */
export function Planning({ settings }: { settings: SiteSettings }) {
  const { method } = settings;
  return (
    <section id="planning" className="pb-14 sm:pb-16">
      <div className={shell}>
        <div className={eyebrow}>Le planning</div>
        <h2 className={sectionTitle}>15 jours. Pensés pour les professionnels.</h2>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {method.rhythm.map((r) => (
            <div key={r.title} className="rounded-[18px] border border-line bg-white p-5">
              <strong className="display block text-[1.6rem] tracking-[-.04em]">{r.title}</strong>
              <p className="text-[.95rem] text-muted">{r.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 font-bold text-ink">Un format exigeant, mais compatible avec un emploi à temps plein.</p>
      </div>
    </section>
  );
}

/** The coach as a reason to trust: a quote, short credentials, one sentence. */
export function Coach({ settings }: { settings: SiteSettings }) {
  const { coach } = settings;
  return (
    <section id="coach" className="pb-14 sm:pb-16">
      <div className={shell + " grid items-start gap-8 lg:grid-cols-[auto_1fr]"}>
        <Image src="/images/coach-avatar.webp" alt={coach.name} width={512} height={512} unoptimized className="size-32 rounded-full border-4 border-white shadow-[var(--shadow-panel)] sm:size-40" />
        <div>
          <div className={eyebrow}>Votre coach</div>
          <h2 className={sectionTitle + " text-[clamp(1.8rem,3.2vw,3.2rem)]"}>« {coach.quote} »</h2>
          <p className="text-[.95rem] font-extrabold tracking-[.04em] text-accent-ink uppercase">{coach.credentials.join(" · ")}</p>
          <p className="mt-3 max-w-[720px] text-ink-2">{coach.bio}</p>
          {coach.linkedinUrl && <p className="mt-3 text-[.88rem]"><a href={coach.linkedinUrl} target="_blank" rel="noopener" className="underline underline-offset-4">Profil LinkedIn →</a></p>}
        </div>
      </div>
    </section>
  );
}

export type PublicTestimonial = { id: number; name: string; role: string | null; country: string | null; text: string; videoUrl: string | null };

/** Real testimonials only, three at most; the section disappears without them. */
export function Testimonials({ items }: { items: PublicTestimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section id="temoignages" className="pb-14 sm:pb-16">
      <div className={shell}>
        <div className={eyebrow}>Ils sont passés par là</div>
        <h2 className={sectionTitle}>Des professionnels en poste, comme vous.</h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 3).map((t) => (
            <figure key={t.id} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-6">
              <blockquote className="text-[1.02rem] text-ink-2"><span className="display mr-1 align-[-.3em] text-[2rem] leading-none text-accent">“</span>{t.text}</blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <span className="display grid size-10 place-items-center rounded-full bg-accent-soft font-extrabold text-accent-ink">{initials(t.name)}</span>
                <span><b className="block text-[.95rem]">{t.name}</b><span className="text-[.84rem] text-muted">{[t.role, t.country].filter(Boolean).join(" · ")}</span></span>
                {t.videoUrl && <a href={t.videoUrl} target="_blank" rel="noopener" className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-[.74rem] font-extrabold text-accent-ink">Vidéo</a>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The eight domains, named once, so the coverage is never in doubt. */
export function Domains() {
  return (
    <section id="domaines" className="pb-14 sm:pb-16">
      <div className={shell}>
        <div className={eyebrow}>Les 8 domaines</div>
        <h2 className={sectionTitle}>Tout le blueprint CISSP, relié.</h2>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CISSP_DOMAINS.map((d, i) => (
            <li key={d} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-4 py-3 text-[.95rem] font-bold">
              <span className="display text-[1.1rem] text-accent">{i + 1}</span>{DOMAIN_LABELS[d]}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The five-question practice test, as a demonstration of the method, late in the page. */
export function PracticeTest() {
  if (!examBootEnabled()) return null;
  return (
    <section id="test" className="pb-14 sm:pb-16">
      <div className={shell}>
        <PracticeTestBox placement="landing-methode" dark title="Testez votre raisonnement CISSP" text="5 questions d’entraînement originales, conçues au niveau et dans l’esprit du CISSP, alignées sur les domaines du blueprint. Corrigées à la fin, sans compte, en dix minutes." cta="Tester mon niveau — 10 min →" />
      </div>
    </section>
  );
}

export function Video({ settings }: { settings: SiteSettings }) {
  const { video } = settings;
  const embed = embedUrl(video.url);
  if (!embed) return null;
  return (
    <section id="video" className="pb-14 sm:pb-16">
      <div className={shell + " grid items-center gap-8 lg:grid-cols-2"}>
        <div className="aspect-video max-w-full overflow-hidden rounded-[22px] bg-ink shadow-[var(--shadow-panel)]">
          <iframe src={embed} title={video.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full" />
        </div>
        <div>
          <div className={eyebrow}>En {video.duration}</div>
          <h2 className={sectionTitle + " text-[clamp(1.8rem,3.2vw,3.2rem)]"}>{video.title}</h2>
          <p className="text-ink-2">{video.text}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * The two other ways to work with Ben, in one slim band (Ben, 24/09):
 * the CC course to start, and career consulting at every stage. Neither is
 * framed as a step before the bootcamp.
 */
export function LadderStrip({ services, ccCohort }: { services: Array<{ code: string; name: string; durationLabel: string }>; ccCohort: { startsAt: Date } | null }) {
  if (services.length === 0) return null;
  return (
    <section id="parcours" className="pb-14 sm:pb-16">
      <div className={shell}>
        <div className="grid gap-3 rounded-[22px] border border-line bg-white p-5 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-6 sm:p-6">
          <div className="sm:max-w-[220px]">
            <div className="text-[.72rem] font-extrabold tracking-[.1em] text-accent uppercase">Avec Ben, aussi</div>
            <p className="display mt-1 text-[1.25rem] leading-tight font-black">Deux autres façons d’avancer.</p>
          </div>
          <TrackLink href="/demarrer" label="parcours-cc" className="group rounded-[14px] border border-line px-4 py-3 hover:border-ink">
            <span className="block text-[.72rem] font-extrabold tracking-[.08em] text-muted uppercase">Débuter · certification CC d’ISC²</span>
            <span className="mt-0.5 block font-bold">15 jours pour votre première certification{ccCohort ? `, session ${formatCohortMonth(ccCohort.startsAt)}` : ""} <span className="text-accent-ink">→</span></span>
          </TrackLink>
          <TrackLink href="/conseil" label="parcours-conseil" className="group rounded-[14px] border border-line px-4 py-3 hover:border-ink">
            <span className="block text-[.72rem] font-extrabold tracking-[.08em] text-muted uppercase">Conseil carrière · à toutes les étapes</span>
            <span className="mt-0.5 block font-bold">Débuter, évoluer vers le RSSI, se repositionner : des séances d’une heure avec Ben <span className="text-accent-ink">→</span></span>
          </TrackLink>
        </div>
      </div>
    </section>
  );
}

/** Five objections, no more; the rest lives in the page itself. */
export function Faq({ settings }: { settings: SiteSettings }) {
  if (settings.faq.length === 0) return null;
  return (
    <section id="faq" className="pb-14 sm:pb-16">
      <div className={shell}>
        <div className={eyebrow}>Questions fréquentes</div>
        <h2 className={sectionTitle}>Avant de vous décider.</h2>
        <div className="grid max-w-[860px] gap-2.5">
          {settings.faq.map((f) => (
            <TrackFaq key={f.q} question={f.q} className="group rounded-[14px] border border-line bg-white px-4.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-bold [&::-webkit-details-marker]:hidden">{f.q}<span className="font-black text-accent group-open:hidden">+</span><span className="hidden font-black text-accent group-open:inline">–</span></summary>
              <p className="pb-4 text-ink-2">{f.a}</p>
            </TrackFaq>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The last word: one action. */
export function FinalCta({ cohort }: { cohort: HeroCohort }) {
  return (
    <section className="pb-16 sm:pb-20">
      <div className={shell}>
        <div className="rounded-[28px] bg-ink px-6 py-10 text-center text-white sm:py-14">
          <h2 className="display text-[clamp(1.9rem,3.8vw,3.4rem)] leading-[1] font-black tracking-[-.05em]">Êtes-vous prêt pour le CISSP ?</h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[#cbd5df]">Trois minutes pour le savoir{cohort ? `, avant la cohorte de ${formatCohortMonth(cohort.startsAt)}` : ""}. Résultat immédiat, gratuit, sans engagement.</p>
          <TrackLink href="#evaluation" label="final" className="mt-6 inline-flex items-center justify-center rounded-[14px] bg-accent-bright px-6 py-4 font-extrabold text-ink">Analyser mon profil →</TrackLink>
        </div>
      </div>
    </section>
  );
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const { contact, coach } = settings;
  return (
    <footer className="border-t border-line py-7 pb-24 text-[.86rem] text-muted sm:pb-12">
      <div className={shell + " flex flex-wrap justify-between gap-x-6 gap-y-3.5"}>
        <span>{contact.legalName} · Formation en français · {coach.name}</span>
        <span className="flex flex-wrap gap-x-3">
          <Link href="/demarrer" className="underline underline-offset-4">Formation CC</Link>
          <Link href="/conseil" className="underline underline-offset-4">Conseil carrière</Link>
          {contact.whatsapp && <a href={`https://wa.me/${contact.whatsapp.replace("+", "")}`} className="underline underline-offset-4">WhatsApp</a>}
          {coach.linkedinUrl && <a href={coach.linkedinUrl} target="_blank" rel="noopener" className="underline underline-offset-4">LinkedIn</a>}
          <Link href="/confidentialite" className="underline underline-offset-4">Confidentialité</Link>
        </span>
      </div>
      {contact.legalText && <p className={shell + " mt-4 text-[.8rem]"}>{contact.legalText}</p>}
    </footer>
  );
}

/** The public gauge, or the plain capacity while nothing is sold yet. */
export function SeatsGauge({ gauge, dark = false }: { gauge: Gauge; dark?: boolean }) {
  if (gauge.confirmed + gauge.held === 0) return <p className={"text-sm font-semibold " + (dark ? "text-[#cbd5df]" : "text-ink-2")}>{seatsLine(gauge)}</p>;
  return <CohortGauge gauge={gauge} dark={dark} />;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** YouTube and Vimeo page URLs to their embed form; anything else is not embedded. */
export function embedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (u.hostname.endsWith("vimeo.com")) {
      const id = u.pathname.match(/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
