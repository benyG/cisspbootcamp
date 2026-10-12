import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReplayDay, type ReplayRow } from "@/components/admin/replays/ReplayDay";
import { prisma } from "@/lib/db";
import { REOPEN_MONTHS } from "@/lib/replays";
import { cohortDays, cohortParticipants, spaceUrl } from "@/lib/replays-server";
import { streamEnabled } from "@/lib/stream";

import { refuseAction, reopenAction } from "./actions";

export const dynamic = "force-dynamic";
/** A Drive copy step runs up to 40 s per call. */
export const maxDuration = 60;

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/** Replays and labs of a cohort (Ben, 12/10): one card per teaching day, then the access requests. */
export default async function ReplaysAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { id } = await params;
  const { ok, erreur } = await searchParams;
  const cohort = await prisma.cohort.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, name: true, program: true, startsAt: true } });
  if (!cohort) notFound();
  const [replays, people, accesses] = await Promise.all([
    prisma.cohortReplay.findMany({ where: { cohortId: cohort.id }, include: { grants: { select: { leadId: true } } } }),
    cohortParticipants(cohort.id),
    prisma.replayAccess.findMany({ where: { cohortId: cohort.id }, include: { lead: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const byDay = new Map(replays.map((r) => [r.day, r]));
  const days = cohortDays(cohort.startsAt);
  const requests = accesses.filter((a) => a.requestedAt);
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href={`/admin/cohortes/${cohort.id}`} className="text-sm text-muted">← {cohort.name}</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Clapperboard className="size-6 text-accent" aria-hidden />Replays et labs</h1>
      <p className="mt-1 text-sm text-muted">Pour chaque jour : l&apos;enregistrement (depuis votre ordinateur ou votre Google Drive), le lab ZIP, puis « Publier et prévenir ». Chaque personne reçoit le lien de son espace : vidéo en lecture seule, avec son nom en filigrane ; lab téléchargeable. Accès jusqu&apos;à 4 mois après la fin de la cohorte.</p>
      {!streamEnabled() && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Cloudflare Stream n&apos;est pas configuré : ajoutez CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_STREAM_TOKEN sur Vercel, puis redéployez. Les labs fonctionnent déjà.</p>}
      {ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{ok}</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      {requests.length > 0 && (
        <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <h2 className="font-semibold">Demandes d&apos;accès ({requests.length})</h2>
          <ul className="mt-2 grid gap-2">
            {requests.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                <span><b>{a.lead.firstName} {a.lead.lastName}</b> · accès terminé le {a.expiresAt.toLocaleDateString("fr-FR")}<br /><span className="text-muted">« {a.requestNote} »</span></span>
                <span className="flex flex-wrap gap-2">
                  <form action={reopenAction} className="flex gap-2">
                    <input type="hidden" name="cohortId" value={cohort.id} />
                    <input type="hidden" name="accessId" value={a.id} />
                    <select name="months" defaultValue={2} className="rounded-lg border border-line px-2 py-1">{REOPEN_MONTHS.map((m) => <option key={m} value={m}>Rouvrir {m} mois</option>)}</select>
                    <button className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">Rouvrir</button>
                  </form>
                  <form action={refuseAction}>
                    <input type="hidden" name="cohortId" value={cohort.id} />
                    <input type="hidden" name="accessId" value={a.id} />
                    <button className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">Refuser</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-5 grid gap-3">
        {days.map((d) => {
          const r = byDay.get(d.n);
          const row: ReplayRow = {
            id: r?.id ?? null,
            videoStatus: r?.videoStatus ?? "none",
            videoName: r?.videoName ?? null,
            videoError: r?.videoError ?? null,
            durationSec: r?.durationSec ?? null,
            source: r?.source ?? null,
            size: r?.sourceSize != null ? Number(r.sourceSize) : null,
            offset: r?.transferOffset != null ? Number(r.transferOffset) : null,
            labName: r?.labName ?? null,
            labSize: r?.labSize ?? null,
            grantedIds: r?.grants.map((g) => g.leadId) ?? [],
          };
          return <ReplayDay key={d.n} cohortId={cohort.id} day={d.n} title={d.title} date={dayLabel(d.date)} row={row} people={people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() }))} streamReady={streamEnabled()} />;
        })}
      </ul>

      {accesses.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="font-semibold">Espaces des participants</h2>
          <ul className="mt-2 divide-y divide-line">
            {accesses.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b>{a.lead.firstName} {a.lead.lastName}</b> · {a.expiresAt > now ? `ouvert jusqu'au ${a.expiresAt.toLocaleDateString("fr-FR")}` : `terminé le ${a.expiresAt.toLocaleDateString("fr-FR")}`}{a.lastViewedAt ? ` · dernière vue le ${a.lastViewedAt.toLocaleDateString("fr-FR")}` : " · pas encore regardé"}</span>
                <a href={spaceUrl(a.token)} target="_blank" rel="noopener" className="text-xs underline">Son espace</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
