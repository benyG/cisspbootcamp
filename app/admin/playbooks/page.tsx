import { Workflow } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { MODE_LABEL, MODES, PLAYBOOK_IDS, PLAYBOOKS, PRESSURE_DAYS, type PlaybookId } from "@/lib/playbooks/rules";
import { loadModes, planAll } from "@/lib/playbooks/server";

import { setPlaybookMode } from "./actions";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** What each journal type means, in Ben's words. */
const JOURNAL: Record<string, string> = {
  playbook_health: "Alerte technique envoyée",
  playbook_unfinished: "E-mail « finalisez votre place » envoyé",
  playbook_unfinished_done: "Inscription non finalisée traitée par vous",
  playbook_late: "Alerte de retard envoyée, avec pack de rattrapage",
};

/**
 * Playbooks (lot 3): each one with its mode, what it would do now (a dry
 * run, nothing is sent from this page), what it did over seven days, and
 * the journal. Read in ten seconds.
 */
export default async function PlaybooksPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [modes, plans, logs, converted] = await Promise.all([
    loadModes(),
    planAll(now),
    prisma.actionLog.findMany({ where: { type: { startsWith: "playbook_" }, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 40, include: { lead: { select: { id: true, firstName: true, lastName: true } } } }),
    unfinishedConverted(since),
  ]);
  const count = (type: string) => logs.filter((l) => l.type === type).length;
  const week: Record<PlaybookId, string> = {
    health: count("playbook_health") ? `${count("playbook_health")} alerte(s)` : "Aucune alerte",
    unfinished: count("playbook_unfinished") ? `${count("playbook_unfinished")} e-mail(s) · ${converted} inscription(s) finalisée(s) ensuite` : "Aucun e-mail",
    late: count("playbook_late") ? `${count("playbook_late")} alerte(s)` : "Aucune alerte",
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Workflow className="size-6 shrink-0 text-accent" aria-hidden />Playbooks</h1>
      <p className="mt-1 text-sm text-muted">Ils tournent chaque jour. <b>Actif</b> : il agit. <b>Essai</b> : il montre ce qu’il ferait, sans rien envoyer. <b>Arrêté</b> : rien.</p>

      <ul className="mt-6 grid gap-3">
        {PLAYBOOK_IDS.map((id) => {
          const p = PLAYBOOKS[id];
          const steps = plans[id];
          return (
            <li key={id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold">{p.title}</h2>
                  <p className="text-sm text-muted">{p.trigger}</p>
                  <p className="mt-0.5 text-sm text-ink-2">{p.action}</p>
                </div>
                <form action={setPlaybookMode} className="flex overflow-hidden rounded-lg border border-line text-sm">
                  <input type="hidden" name="id" value={id} />
                  {MODES.map((m) => (
                    <button key={m} name="mode" value={m} aria-pressed={modes[id] === m} className={"px-3 py-1.5 font-semibold " + (modes[id] === m ? (m === "trial" ? "bg-[#2f6fb5] text-white" : m === "off" ? "bg-slate-500 text-white" : "bg-ink text-white") : "bg-white text-muted hover:text-ink") + (m !== "on" ? " border-l border-line" : "")}>{MODE_LABEL[m]}</button>
                  ))}
                </form>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-extrabold tracking-[.06em] text-muted uppercase">{modes[id] === "on" ? "Au prochain passage" : modes[id] === "trial" ? "Ce qu’il ferait maintenant" : "S’il était actif"}</h3>
                  {steps.length ? (
                    <ul className="mt-1 grid gap-1">{steps.slice(0, 6).map((s, i) => <li key={i}>{s.summary}</li>)}{steps.length > 6 && <li className="text-muted">et {steps.length - 6} de plus</li>}</ul>
                  ) : <p className="mt-1 text-muted">Rien à faire.</p>}
                  {id === "unfinished" && steps[0] && (
                    <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-ink-2">Voir l’e-mail</summary><pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 font-sans text-xs text-ink-2">{steps[0].email.subject}{"\n\n"}{steps[0].email.text}</pre></details>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-extrabold tracking-[.06em] text-muted uppercase">7 derniers jours</h3>
                  <p className="mt-1">{week[id]}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-muted">Au plus un message automatique par personne tous les {PRESSURE_DAYS} jours</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-muted">Consentement vérifié, désinscription respectée</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-muted">Rien de public ni de prix sans vous</span>
      </p>

      <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Journal</h2>
        {logs.length ? (
          <ul className="mt-2 divide-y divide-line text-sm">
            {logs.map((l) => (
              <li key={l.id} className="grid grid-cols-[4.5rem_1fr] gap-3 py-2">
                <span className="text-xs text-muted tabular-nums">{when.format(l.createdAt)}</span>
                <span>{JOURNAL[l.type] ?? l.type}{l.lead && <> · <Link href={`/admin/leads/${l.lead.id}`} className="underline">{l.lead.firstName} {l.lead.lastName}</Link></>}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">Rien cette semaine.</p>}
      </section>
    </main>
  );
}

/** Registrations paid after the playbook's e-mail, among those e-mailed since `since`. */
async function unfinishedConverted(since: Date): Promise<number> {
  const sent = await prisma.actionLog.findMany({ where: { type: "playbook_unfinished", createdAt: { gte: since } }, select: { leadId: true, createdAt: true, payload: true } });
  if (!sent.length) return 0;
  const paid = await prisma.registration.findMany({ where: { status: "paid", leadId: { in: sent.map((s) => s.leadId!).filter(Boolean) } }, select: { leadId: true, cohortId: true, paidAt: true } });
  return sent.filter((s) => paid.some((p) => p.leadId === s.leadId && p.cohortId === (s.payload as { cohortId?: number }).cohortId && p.paidAt && p.paidAt > s.createdAt)).length;
}
