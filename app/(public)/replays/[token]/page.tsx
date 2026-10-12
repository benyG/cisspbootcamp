import { Download, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ReplayPlayer } from "@/components/replays/ReplayPlayer";
import { RequestAccess } from "@/components/replays/RequestAccess";
import { formatBytes, formatDuration, isAccessOpen, watermarkText } from "@/lib/replays";
import { daysForModules } from "@/lib/reading-plan/data";
import { accessByToken, calendarFor, grantedItems, itemModules, playbackFor } from "@/lib/replays-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vos replays · CISSP Bootcamp", robots: { index: false } };

const longDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * A participant's replays and labs (Ben, 12/10), from the link in the
 * publication e-mail: the recordings Ben published to them, in course
 * order and labelled with the day of their own calendar, the video played on
 * this page only, the lab to download; once the access is over, a form to
 * ask Ben to reopen it.
 */
export default async function ReplaysPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ video?: string }> }) {
  const { token } = await params;
  const { video } = await searchParams;
  const access = await accessByToken(token);
  if (!access) notFound();
  const now = new Date();
  const open = isAccessOpen(access.expiresAt, now);
  const header = (
    <section className="grid gap-2 rounded-[22px] bg-gradient-to-br from-ink to-ink-2 p-5 text-white">
      <span className="text-xs font-bold tracking-[.08em] text-accent-bright uppercase">CISSP Bootcamp · {access.cohort.name}</span>
      <h1 className="text-2xl font-extrabold sm:text-3xl">Bonjour {access.lead.firstName}, {open ? "vos replays et vos labs" : "votre accès aux replays est terminé"}</h1>
      <p className="text-white/80">{open ? "Les enregistrements apparaissent ici au fur et à mesure que Ben les publie, dans l’ordre du programme. Les vidéos se regardent en ligne, sans téléchargement ; les labs se téléchargent." : `Il était ouvert jusqu’au ${longDate(access.expiresAt)}.`}</p>
      {open && <p className="text-sm text-white/70">Accès ouvert jusqu&apos;au <b>{longDate(access.expiresAt)}</b>.</p>}
    </section>
  );

  if (!open) {
    return (
      <main className="mx-auto grid w-full max-w-3xl flex-1 gap-5 px-4 py-6 sm:px-5">
        {header}
        <section className="grid gap-3 rounded-[22px] border border-line bg-white p-5">
          <h2 className="text-lg font-extrabold">Besoin de revoir une session ?</h2>
          <p className="text-muted">Dites à Ben pourquoi (examen reporté, révision d&apos;un domaine…). Il peut rouvrir votre accès.</p>
          <RequestAccess token={token} alreadyAsked={Boolean(access.requestedAt)} />
        </section>
      </main>
    );
  }

  const [replays, sessions] = await Promise.all([grantedItems(access), calendarFor(access, access.cohort.startsAt)]);
  const dayOf = (r: { modules: unknown }) => daysForModules(sessions, itemModules(r.modules));
  const selected = replays.find((r) => String(r.id) === video) ?? replays[0];
  const playToken = selected && selected.videoStatus === "ready" ? await playbackFor(access, selected.id, now, { log: !(await auth())?.user?.email }) : null;
  const selectedDay = selected ? dayOf(selected) : "";

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-5 px-4 py-6 sm:px-5">
      {header}
      {replays.length === 0 ? (
        <p className="rounded-[22px] border border-line bg-white p-5 text-muted">Rien n&apos;est encore publié : vous recevrez un e-mail à chaque nouvel enregistrement.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <nav aria-label="Vos sessions" className="rounded-[22px] border border-line bg-white p-4">
            <h2 className="text-lg font-extrabold">Vos sessions</h2>
            <ul className="mt-3 grid gap-1.5">
              {replays.map((r) => {
                const day = dayOf(r);
                const current = r.id === selected?.id;
                return (
                  <li key={r.id}>
                    <Link href={`/replays/${token}?video=${r.id}`} aria-current={current ? "true" : undefined} className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2.5 py-2 ${current ? "border-accent bg-accent-soft" : "border-line hover:border-accent"}`}>
                      <span className="text-sm font-extrabold">{day || "·"}</span>
                      <span className="min-w-0 truncate text-sm">{r.title}</span>
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-ink">{r.videoStatus === "ready" && r.labPathname ? "Vidéo + lab" : r.videoStatus === "ready" ? "Vidéo" : "Lab"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {selected && (
            <section className="min-w-0 rounded-[22px] border border-line bg-white p-4">
              <span className="text-xs font-bold tracking-[.08em] text-accent-ink uppercase">{[selectedDay, selected.durationSec ? formatDuration(selected.durationSec) : ""].filter(Boolean).join(" · ") || "Enregistrement"}</span>
              <h2 className="mt-1 mb-3 text-xl font-extrabold">{selected.title}</h2>
              {playToken ? (
                <ReplayPlayer token={playToken} watermark={watermarkText(access.lead)} title={selected.title} />
              ) : selected.videoStatus === "ready" ? (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">La vidéo ne peut pas être lue pour l&apos;instant. Rechargez la page dans un moment.</p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted"><PlayCircle className="size-4" aria-hidden />Pas de vidéo pour cet enregistrement.</p>
              )}
              <div className="mt-4">
                {selected.labPathname ? (
                  <a href={`/replays/${token}/lab/${selected.id}`} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold">
                    <Download className="size-4 text-accent" aria-hidden />Télécharger le lab · {selected.labName}{selected.labSize ? ` (${formatBytes(selected.labSize)})` : ""}
                  </a>
                ) : (
                  <span className="text-sm text-muted">Pas de lab pour cet enregistrement.</span>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
