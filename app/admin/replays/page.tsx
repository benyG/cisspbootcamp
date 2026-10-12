import { Clapperboard, Plus } from "lucide-react";
import Link from "next/link";

import { type CohortOption, type ItemView, ReplayItemCard } from "@/components/admin/replays/ReplayItemCard";
import { prisma } from "@/lib/db";
import { courseModules, daysForModules } from "@/lib/reading-plan/data";
import { REOPEN_MONTHS } from "@/lib/replays";
import { cohortDays, cohortParticipants, itemModules, spaceUrl } from "@/lib/replays-server";
import { streamEnabled } from "@/lib/stream";

import { createItemAction, deleteItemAction, refuseAction, reopenAction, updateItemAction } from "./actions";

export const dynamic = "force-dynamic";
/** A Drive copy step runs up to 40 s per call. */
export const maxDuration = 60;

const PROGRAMS = { cissp: "CISSP", cc: "CC" } as const;

/**
 * The replay library (Ben, 12/10): recordings filed by programme and by
 * the course modules they cover, shared by every cohort. Each one is
 * published to the participants of any cohort; ?cohorte= preselects one.
 */
export default async function ReplayLibraryPage({ searchParams }: { searchParams: Promise<{ programme?: string; cohorte?: string; ok?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const preselected = sp.cohorte ? await prisma.cohort.findUnique({ where: { id: Number(sp.cohorte) || 0 }, select: { id: true, program: true } }) : null;
  const program = (sp.programme === "cc" || sp.programme === "cissp" ? sp.programme : preselected?.program ?? "cissp") as "cissp" | "cc";
  const modules = program === "cissp" ? courseModules() : [];
  const moduleLabel = (ns: number[]) => ns.map((n) => modules.find((m) => m.n === n)).filter(Boolean).map((m) => `M${m!.n} ${m!.title}`).join(" · ");

  const [items, cohorts, requests] = await Promise.all([
    prisma.replayItem.findMany({ where: { program }, include: { grants: { select: { cohortId: true, leadId: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.cohort.findMany({ where: { program }, orderBy: { startsAt: "desc" }, select: { id: true, name: true, startsAt: true } }),
    prisma.replayAccess.findMany({ where: { requestedAt: { not: null } }, include: { lead: { select: { firstName: true, lastName: true } }, cohort: { select: { name: true } } }, orderBy: { requestedAt: "asc" } }),
  ]);
  const options: CohortOption[] = await Promise.all(cohorts.map(async (c) => ({ id: c.id, name: c.name, people: (await cohortParticipants(c.id)).map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() })) })));
  const calendars = new Map(cohorts.map((c) => [c.id, program === "cissp" ? cohortDays(c.startsAt) : []]));
  const first = (m: unknown) => Math.min(...itemModules(m), 999);
  const sorted = [...items].sort((a, b) => first(a.modules) - first(b.modules));
  const views: ItemView[] = sorted.map((i) => {
    const ms = itemModules(i.modules);
    const granted: Record<number, number[]> = {};
    for (const g of i.grants) (granted[g.cohortId] ??= []).push(g.leadId);
    return {
      id: i.id, title: i.title, modulesLabel: moduleLabel(ms), videoStatus: i.videoStatus, videoName: i.videoName, videoError: i.videoError, durationSec: i.durationSec, source: i.source,
      size: i.sourceSize != null ? Number(i.sourceSize) : null, offset: i.transferOffset != null ? Number(i.transferOffset) : null, labName: i.labName, labSize: i.labSize, granted,
      daysByCohort: Object.fromEntries(cohorts.map((c) => [c.id, daysForModules(calendars.get(c.id) ?? [], ms)])),
    };
  });
  const covered = new Set(items.flatMap((i) => itemModules(i.modules)));
  const accesses = preselected ? await prisma.replayAccess.findMany({ where: { cohortId: preselected.id }, include: { lead: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }) : [];
  const keep = { programme: program, cohorte: preselected ? String(preselected.id) : "" };
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Clapperboard className="size-6 text-accent" aria-hidden />Vidéothèque</h1>
      <p className="mt-1 text-sm text-muted">Les enregistrements, rangés par module du programme, servent à toutes les cohortes : enregistrez une fois, publiez pour les inscrits de n&apos;importe quelle cohorte. Vidéo en lecture seule avec le nom de la personne en filigrane ; lab ZIP téléchargeable ; accès jusqu&apos;à 4 mois après la fin de sa cohorte.</p>
      <nav className="mt-3 flex gap-2 text-sm">
        {(Object.keys(PROGRAMS) as Array<keyof typeof PROGRAMS>).map((p) => (
          <Link key={p} href={`/admin/replays?programme=${p}`} aria-current={p === program ? "page" : undefined} className={`rounded-full border px-3 py-1 font-semibold ${p === program ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{PROGRAMS[p]}</Link>
        ))}
      </nav>
      {!streamEnabled() && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Cloudflare Stream n&apos;est pas configuré : ajoutez CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_STREAM_TOKEN sur Vercel, puis redéployez. Les labs fonctionnent déjà.</p>}
      {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}
      {sp.erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.erreur}</p>}

      {requests.length > 0 && (
        <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <h2 className="font-semibold">Demandes d&apos;accès ({requests.length})</h2>
          <ul className="mt-2 grid gap-2">
            {requests.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                <span><b>{a.lead.firstName} {a.lead.lastName}</b> · {a.cohort.name} · accès terminé le {a.expiresAt.toLocaleDateString("fr-FR")}<br /><span className="text-muted">« {a.requestNote} »</span></span>
                <span className="flex flex-wrap gap-2">
                  <form action={reopenAction} className="flex gap-2">
                    <Keep {...keep} />
                    <input type="hidden" name="accessId" value={a.id} />
                    <select name="months" defaultValue={2} className="rounded-lg border border-line px-2 py-1">{REOPEN_MONTHS.map((m) => <option key={m} value={m}>Rouvrir {m} mois</option>)}</select>
                    <button className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">Rouvrir</button>
                  </form>
                  <form action={refuseAction}>
                    <Keep {...keep} />
                    <input type="hidden" name="accessId" value={a.id} />
                    <button className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">Refuser</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="mt-5 rounded-xl border border-line bg-white p-4 text-sm" open={items.length === 0}>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Plus className="size-4 text-accent" aria-hidden />Ajouter un enregistrement</summary>
        <form action={createItemAction} className="mt-3 grid gap-3">
          <Keep {...keep} />
          <input type="hidden" name="program" value={program} />
          <label className="flex flex-col gap-1 font-medium">Titre
            <input name="title" required maxLength={200} placeholder="Ex. : Gouvernance, risques et lois (samedi)" className="rounded-lg border border-line px-3 py-2 text-base font-normal" /></label>
          {modules.length > 0 && <ModulePicker modules={modules} checked={[]} covered={covered} />}
          <div><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Ajouter</button></div>
        </form>
      </details>

      {program === "cissp" && (
        <p className="mt-3 text-xs text-muted">Modules sans enregistrement : {modules.filter((m) => !covered.has(m.n)).map((m) => `M${m.n}`).join(", ") || "aucun, tout est couvert"}.</p>
      )}

      <ul className="mt-4 grid gap-3">
        {views.length === 0 && <li className="rounded-xl border border-line bg-white p-4 text-sm text-muted">La vidéothèque est vide : ajoutez un premier enregistrement.</li>}
        {views.map((v) => {
          const raw = sorted.find((i) => i.id === v.id)!;
          return (
            <li key={v.id} className="grid gap-3 rounded-xl border border-line bg-white p-4 text-sm">
              <ReplayItemCard item={v} cohorts={options} defaultCohortId={preselected?.id ?? null} streamReady={streamEnabled()} />
              <details className="rounded-lg border border-dashed border-line p-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted">Modifier le titre ou les modules · supprimer</summary>
                <form action={updateItemAction} className="mt-2 grid gap-2">
                  <Keep {...keep} />
                  <input type="hidden" name="itemId" value={v.id} />
                  <input name="title" required maxLength={200} defaultValue={v.title} className="rounded-lg border border-line px-3 py-2 text-base" />
                  {modules.length > 0 && <ModulePicker modules={modules} checked={itemModules(raw.modules)} covered={new Set()} />}
                  <div><button className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">Enregistrer</button></div>
                </form>
                <form action={deleteItemAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
                  <Keep {...keep} />
                  <input type="hidden" name="itemId" value={v.id} />
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="confirm" />Supprimer la vidéo, le lab et tous les accès</label>
                  <button className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800">Supprimer</button>
                </form>
              </details>
            </li>
          );
        })}
      </ul>

      {preselected && accesses.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="font-semibold">Espaces des participants · {cohorts.find((c) => c.id === preselected.id)?.name}</h2>
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

function Keep({ programme, cohorte }: { programme: string; cohorte: string }) {
  return (
    <>
      <input type="hidden" name="programme" value={programme} />
      {cohorte && <input type="hidden" name="cohorte" value={cohorte} />}
    </>
  );
}

function ModulePicker({ modules, checked, covered }: { modules: Array<{ n: number; title: string; domain: number; hours: number }>; checked: number[]; covered: Set<number> }) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 font-medium">Modules couverts par l&apos;enregistrement</legend>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {modules.map((m) => (
          <label key={m.n} className="flex items-start gap-2 font-normal">
            <input type="checkbox" name="modules" value={m.n} defaultChecked={checked.includes(m.n)} className="mt-1" />
            <span>M{m.n} · {m.title} <span className="text-xs text-muted">({m.domain ? `D${m.domain}` : "synthèse"}, {m.hours % 1 ? `${Math.floor(m.hours)} h 30` : `${m.hours} h`}){covered.has(m.n) ? " · déjà enregistré" : ""}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
