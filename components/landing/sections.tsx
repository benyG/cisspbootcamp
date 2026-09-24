import Image from "next/image";

import { PracticeTestBox } from "@/components/examboot/PracticeTestBox";
import { AdmissionCountdown } from "@/components/offer/AdmissionCountdown";
import { TrackFaq } from "@/components/tracking/TrackFaq";
import { TrackLink } from "@/components/tracking/TrackLink";
import Link from "next/link";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import type { Gauge } from "@/lib/cohorts";
import { admissionClosesAt, formatAdmissionDeadline, formatCohortMonth } from "@/lib/cohorts";
import { examBootEnabled } from "@/lib/examboot/client";
import type { SiteSettings } from "@/lib/site-settings";
import { splitHighlight } from "@/lib/site-settings";

/**
 * Landing sections (SPECS A1), in the order the prototype fixed. Copy comes
 * from site settings; cohort, gauge and prices from the database.
 */

export const shell = "mx-auto w-[min(1180px,calc(100%-32px))]";
export const eyebrow = "inline-flex items-center gap-2.5 rounded-2xl border border-accent/20 bg-white px-3.5 py-2.5 text-[.76rem] font-extrabold tracking-[.08em] uppercase shadow-[var(--shadow-card)]";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-[14px] bg-ink px-5.5 py-4 font-extrabold text-white shadow-[0_10px_30px_rgba(7,26,51,.18)] transition-transform hover:-translate-y-0.5";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-[14px] border border-line bg-white px-5.5 py-4 font-extrabold";
const sectionTitle = "display mt-3 mb-7 max-w-[860px] text-[clamp(2.2rem,4vw,4.3rem)] leading-[.98] font-black tracking-[-.05em]";

export function Topbar() {
  return (
    <header className={shell}>
      <div className="flex items-center justify-between py-5">
        <Link href="/" className="display text-[1.18rem] font-black tracking-[-.04em]">CISSP <span className="text-accent">Bootcamp</span></Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <TrackLink href="/conseil" label="topbar-conseil" className="px-2 py-2.5 text-[.92rem] font-bold text-ink-2 underline-offset-4 hover:underline">Conseil carrière</TrackLink>
          <TrackLink href="/#evaluation" label="topbar" className="hidden rounded-full border border-line bg-white px-4 py-2.5 text-[.92rem] font-bold sm:inline-flex">Évaluer mon profil →</TrackLink>
        </nav>
      </div>
    </header>
  );
}

export function Hero({ settings, cohort }: { settings: SiteSettings; cohort: { name: string; startsAt: Date; gauge: Gauge } | null }) {
  const { hero, coach } = settings;
  const title = splitHighlight(hero.title);
  return (
    <section className={shell + " grid items-center gap-12 pt-4 pb-14 lg:grid-cols-[1.1fr_.9fr]"}>
      <div>
        <div className={eyebrow}>
          <span className="rounded-full border border-accent/10 bg-accent/10 px-2.5 py-1.5 tracking-[.1em] text-accent">Cohorte</span>
          <span>{cohort ? cap(formatCohortMonth(cohort.startsAt)) : "Prochaine session"}</span>
          <span className="size-1.5 rounded-full bg-accent/30" />
          <span>100 % en français</span>
        </div>
        {/* A long title steps down one size so the hero keeps its rhythm (three to four lines). */}
        <h1 className={`display my-5 max-w-[840px] font-black tracking-[-.06em] ${hero.title.replace(/[{}]/g, "").length > 44 ? "text-[clamp(2.3rem,4.4vw,4.4rem)] leading-[1]" : "text-[clamp(3rem,6vw,5.9rem)] leading-[.94]"}`}>
          {title.before}{title.highlight && <span className="text-accent">{title.highlight}</span>}{title.after}
        </h1>
        <p className="mb-6 max-w-[760px] text-[clamp(1.08rem,1.4vw,1.3rem)] text-ink-2">{hero.lead}</p>
        <div className="my-6 grid max-w-[720px] gap-3 sm:grid-cols-3">
          {hero.promises.map((p) => (
            <div key={p.title} className="flex min-h-[88px] flex-col justify-between rounded-[18px] border border-line bg-white px-4 py-3.5 shadow-[var(--shadow-card)]">
              <strong className="display text-[1.02rem] leading-[1.1]">{p.title}</strong>
              <span className="text-[.86rem] text-muted">{p.text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TrackLink href="#evaluation" label="hero" className={btnPrimary + " w-full sm:w-auto"}>Analyser mon profil — 3 min →</TrackLink>
          <TrackLink href="#methode" label="hero-methode" className={btnGhost + " w-full sm:w-auto"}>Voir la méthode</TrackLink>
        </div>
        <p className="mt-3 text-[.88rem] text-muted">{hero.microcopy}</p>
      </div>

      <div className="relative min-h-[460px] sm:min-h-[600px]">
        {/* The portrait fills the block, head at the top: nothing may sit on the face. */}
        <div className="absolute inset-0 flex items-end justify-center sm:left-14">
          <div className="absolute inset-x-0 bottom-0 h-[78%] rounded-[36px] bg-gradient-to-b from-accent-bright/10 to-accent-bright/[.02]" />
          <Image src="/images/coach-hero.webp" alt={`${coach.name}, coach CISSP`} width={900} height={1006} priority unoptimized className="relative h-full w-full object-contain object-bottom drop-shadow-[0_30px_40px_rgba(7,26,51,.18)]" />
        </div>
        {/* Both cards stack over the jacket, bottom-left, on every screen size. */}
        <div className="absolute inset-x-4 bottom-6 flex flex-col gap-3 sm:inset-x-auto sm:left-0 sm:w-[280px]">
          {cohort && (
            <div className="flex items-center gap-4 rounded-2xl bg-ink px-4 py-3 text-white shadow-[0_20px_50px_rgba(7,26,51,.25)]">
              <div>
                <div className="text-[.7rem] font-extrabold tracking-[.1em] whitespace-nowrap text-[#7be0c8] uppercase">Places restantes</div>
                <div className="display text-[1.6rem] leading-none font-black">{cohort.gauge.remaining} <small className="text-sm font-semibold tracking-normal text-[#cbd5df]">sur {cohort.gauge.capacity}</small></div>
              </div>
              <div className="flex-1"><CohortGauge gauge={cohort.gauge} showLabel={false} dark /></div>
            </div>
          )}
          {cohort && (
            <div className="rounded-2xl bg-ink px-4 py-3 text-white shadow-[0_20px_50px_rgba(7,26,51,.25)]">
              <div className="text-[.7rem] font-extrabold tracking-[.1em] text-[#7be0c8] uppercase">{settings.offer.promoLabel} · jusqu’au {formatAdmissionDeadline(cohort.startsAt)}</div>
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

export function Proof({ settings }: { settings: SiteSettings }) {
  return (
    <section className="bg-ink py-16 text-white sm:py-20">
      <div className={shell}>
        <h2 className="display mb-8 max-w-[900px] text-[clamp(2.2rem,4vw,4.4rem)] leading-[.98] font-black tracking-[-.05em]">{settings.proof.title}</h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {settings.proof.numbers.map((n) => (
            <div key={n.value + n.text} className="rounded-[18px] border border-white/10 bg-white/[.06] p-5">
              <div className="display text-[2.8rem] leading-none font-black tracking-[-.05em] text-[#7be0c8]">{n.value}</div>
              <p className="mt-2 text-[#cbd5df]">{n.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The three steps (docs/OFFRES.md §1): after the proof, before the method.
 * The bootcamp card leads; the two others are there for whoever is not yet
 * at that step, so the page never has to send them away empty-handed.
 */
export function Ladder({ services, ccCohort }: { services: Array<{ code: string; name: string; durationLabel: string }>; ccCohort: { startsAt: Date; gauge: Gauge } | null }) {
  if (services.length === 0) return null;
  const consulting = services.filter((s) => s.code !== "mentorat").slice(0, 3);
  return (
    <section id="parcours" className="py-16 sm:py-20">
      <div className={shell}>
        <div className={eyebrow}>Trois façons de travailler avec Ben</div>
        <h2 className={sectionTitle + " text-[clamp(2rem,3.4vw,3.4rem)]"}>Le bootcamp est la destination. Il y a une marche pour chacun.</h2>
        <div className="grid gap-3.5 lg:grid-cols-3">
          <article className="rounded-[18px] border border-line bg-white p-5">
            <div className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">Débuter</div>
            <h3 className="display mt-2.5 mb-2 text-[1.35rem] font-black">15 jours pour votre première certification</h3>
            <p className="text-[.95rem] text-muted">Aucune expérience, ou une reconversion : la certification CC d’ISC², la maison du CISSP, préparée en 10 h de sessions live en français. Sans prérequis.{ccCohort ? ` Prochaine session en ${formatCohortMonth(ccCohort.startsAt)}, ${ccCohort.gauge.label.toLowerCase()}.` : ""}</p>
            <TrackLink href="/demarrer" label="parcours-cc" className="mt-4 inline-flex font-extrabold text-accent-ink underline underline-offset-4">Voir la formation CC →</TrackLink>
          </article>
          <article className="rounded-[18px] border border-line bg-white p-5">
            <div className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">Être conseillé</div>
            <h3 className="display mt-2.5 mb-2 text-[1.35rem] font-black">Une heure de conseil carrière</h3>
            <p className="text-[.95rem] text-muted">Vous n’avez pas encore les cinq ans, vous hésitez sur la voie, vous changez de métier : une séance et vous repartez avec un plan écrit.</p>
            <ul className="mt-3 grid gap-1 text-[.9rem] text-ink-2">
              {consulting.map((s) => <li key={s.code}>· {s.name} <span className="text-muted">({s.durationLabel})</span></li>)}
            </ul>
            <p className="mt-2 text-[.9rem] text-muted">Et pour tenir le rythme : le mentorat mensuel, deux séances de 45 min et vos questions entre les deux.</p>
            <TrackLink href="/conseil" label="parcours-conseil" className="mt-4 inline-flex font-extrabold text-accent-ink underline underline-offset-4">Voir les séances →</TrackLink>
          </article>
          <article className="rounded-[18px] border-2 border-ink bg-ink p-5 text-white shadow-[var(--shadow-panel)]">
            <div className="text-[.78rem] font-extrabold tracking-[.08em] text-[#7be0c8] uppercase">Certifier son expertise</div>
            <h3 className="display mt-2.5 mb-2 text-[1.35rem] font-black">Le bootcamp CISSP</h3>
            <p className="text-[.95rem] text-[#cbd5df]">Quatre ans d’expérience ou plus : 40 heures sur 15 jours, en français, jusqu’à la date d’examen. Le produit pour lequel ce site existe.</p>
            <TrackLink href="/#evaluation" label="parcours-bootcamp" className={btnPrimary + " mt-4 w-full border border-white/20"}>Analyser mon profil →</TrackLink>
          </article>
        </div>
      </div>
    </section>
  );
}

export function Method({ settings }: { settings: SiteSettings }) {
  const { method } = settings;
  return (
    <section id="methode" className="py-16 sm:py-20">
      <div className={shell}>
        <div className={eyebrow}>La méthode</div>
        <h2 className={sectionTitle}>{method.title}</h2>
        <ol className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {method.steps.map((s, i) => (
            <li key={s.title} className="rounded-[18px] border border-line bg-white p-5">
              <div className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">{i + 1} · {s.kicker}</div>
              <h3 className="display mt-2.5 mb-2 text-[1.22rem] font-black">{s.title}</h3>
              <p className="text-[.95rem] text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          {method.rhythm.map((r) => (
            <div key={r.title} className="rounded-[18px] border border-line bg-white p-5">
              <strong className="display block text-[1.6rem] tracking-[-.04em]">{r.title}</strong>
              <p className="text-[.95rem] text-muted">{r.text}</p>
            </div>
          ))}
        </div>
        {examBootEnabled() && (
          <div className="mt-3.5">
            <PracticeTestBox placement="landing-methode" dark title="Voyez par vous-même : 5 vraies questions d’examen" text="Pas une démo. Cinq questions du vrai niveau CISSP, tirées d’une banque d’examen, corrigées à la fin. Sans compte, en dix minutes. Puis revenez ici : l’analyse de profil vous dit quoi en faire." />
          </div>
        )}
      </div>
    </section>
  );
}

export type PublicTestimonial = { id: number; name: string; role: string | null; country: string | null; text: string; videoUrl: string | null };

export function Testimonials({ items }: { items: PublicTestimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section id="temoignages" className="pb-16 sm:pb-20">
      <div className={shell}>
        <div className={eyebrow}>Ils sont passés par là</div>
        <h2 className={sectionTitle}>Des professionnels en poste, comme vous.</h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
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

export function Video({ settings }: { settings: SiteSettings }) {
  const { video } = settings;
  const embed = embedUrl(video.url);
  if (!embed) return null;
  return (
    <section id="video" className="pb-16 sm:pb-20">
      <div className={shell + " grid items-center gap-8 lg:grid-cols-2"}>
        <div className="aspect-video max-w-full overflow-hidden rounded-[22px] bg-ink shadow-[var(--shadow-panel)]">
          <iframe src={embed} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full" />
        </div>
        <div>
          <div className={eyebrow}>En {video.duration}</div>
          <h2 className={sectionTitle + " text-[clamp(2rem,3.4vw,3.4rem)]"}>{video.title}</h2>
          <p className="text-ink-2">{video.text}</p>
          <TrackLink href="#evaluation" label="video" className={btnGhost + " mt-5"}>Analyser mon profil →</TrackLink>
        </div>
      </div>
    </section>
  );
}

export function Coach({ settings }: { settings: SiteSettings }) {
  const { coach } = settings;
  return (
    <section id="coach" className="pb-16 sm:pb-20">
      <div className={shell + " grid items-start gap-8 lg:grid-cols-[auto_1fr]"}>
        {/* The head only, as a selfie in a circle: the full portrait already carries the hero. */}
        <Image src="/images/coach-avatar.webp" alt={coach.name} width={512} height={512} unoptimized className="size-36 rounded-full border-4 border-white shadow-[var(--shadow-panel)] sm:size-44" />
        <div>
          <div className={eyebrow}>Votre coach</div>
          <h2 className={sectionTitle + " text-[clamp(2rem,3.4vw,3.6rem)]"}>« {coach.quote} »</h2>
          <p className="max-w-[720px] text-ink-2">{coach.bio}</p>
          <ul className="mt-5 grid gap-2.5">
            {coach.credentials.map((c) => (
              <li key={c} className="flex items-start gap-3 text-ink-2"><span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-black text-accent-ink">✓</span>{c}</li>
            ))}
          </ul>
          {coach.linkedinUrl && <p className="mt-4 text-[.88rem]"><a href={coach.linkedinUrl} target="_blank" rel="noopener" className="underline underline-offset-4">Profil LinkedIn →</a></p>}
        </div>
      </div>
    </section>
  );
}

export function Faq({ settings }: { settings: SiteSettings }) {
  if (settings.faq.length === 0) return null;
  return (
    <section id="faq" className="pb-16 sm:pb-20">
      <div className={shell}>
        <div className={eyebrow}>Questions fréquentes</div>
        <h2 className={sectionTitle + " text-[clamp(2rem,3.4vw,3.4rem)]"}>Ce qu’on nous demande avant de s’inscrire.</h2>
        <div className="grid max-w-[860px] gap-2.5">
          {settings.faq.map((f) => (
            <TrackFaq key={f.q} question={f.q} className="group rounded-[14px] border border-line bg-white px-4.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-bold [&::-webkit-details-marker]:hidden">{f.q}<span className="font-black text-accent group-open:hidden">+</span><span className="hidden font-black text-accent group-open:inline">–</span></summary>
              <p className="pb-4 text-ink-2">{f.a}</p>
            </TrackFaq>
          ))}
        </div>
        {examBootEnabled() && (
          <div className="mt-6 max-w-[860px]">
            <PracticeTestBox placement="faq" compact title="Une question que la FAQ ne règle pas : « suis-je au niveau ? ». Cinq vraies questions y répondent." />
          </div>
        )}
      </div>
    </section>
  );
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const { contact, coach } = settings;
  return (
    <footer className="border-t border-line py-7 pb-12 text-[.86rem] text-muted">
      <div className={shell + " flex flex-wrap justify-between gap-x-6 gap-y-3.5"}>
        <span>{contact.legalName} · Formation en français · {coach.name}</span>
        <span className="flex flex-wrap gap-x-3">
          {contact.whatsapp && <a href={`https://wa.me/${contact.whatsapp.replace("+", "")}`} className="underline underline-offset-4">WhatsApp</a>}
          {coach.linkedinUrl && <a href={coach.linkedinUrl} target="_blank" rel="noopener" className="underline underline-offset-4">LinkedIn</a>}
          <Link href="/confidentialite" className="underline underline-offset-4">Confidentialité</Link>
        </span>
      </div>
      {contact.legalText && <p className={shell + " mt-4 text-[.8rem]"}>{contact.legalText}</p>}
    </footer>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
