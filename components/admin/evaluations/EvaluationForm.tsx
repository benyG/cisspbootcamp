"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createEvaluationAction } from "@/app/admin/evaluations/actions";
import { type DomainChoice, KINDS, type Kind, MAX_QUESTIONS, splitQuestions } from "@/lib/evaluations";

export type CohortPeople = { id: number; name: string; people: Array<{ id: number; name: string; note: string }> };

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-base font-normal";

/** Compose and send an evaluation: domains, size, people (prototype validated by Ben, 14/10). */
export function EvaluationForm({ domains, cohorts, defaultDue }: { domains: DomainChoice[]; cohorts: CohortPeople[]; defaultDue: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("test");
  const [split, setSplit] = useState<"weight" | "equal" | "hand">("weight");
  const [total, setTotal] = useState(25);
  const [chosen, setChosen] = useState<number[]>(domains.slice(0, 2).map((d) => d.id));
  const [hand, setHand] = useState<Record<number, number>>({});
  const [timer, setTimer] = useState(0);
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? 0);
  const cohort = cohorts.find((c) => c.id === cohortId);
  const [people, setPeople] = useState<number[]>(cohort?.people.map((p) => p.id) ?? []);
  const [due, setDue] = useState(defaultDue);
  const [remind, setRemind] = useState(true);
  const [message, setMessage] = useState("");

  const selected = domains.filter((d) => chosen.includes(d.id));
  const counts = useMemo(() => {
    if (split === "hand") return selected.map((d) => Math.min(d.cap, hand[d.id] ?? 0));
    return splitQuestions(total, selected.map((d) => (split === "equal" ? 1 : d.weight)), selected.map((d) => d.cap));
  }, [split, total, hand, selected]);
  const sum = counts.reduce((a, b) => a + b, 0);
  const minutes = kind === "exam" ? timer : 0;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function pickCohort(id: number) {
    setCohortId(id);
    setPeople(cohorts.find((c) => c.id === id)?.people.map((p) => p.id) ?? []);
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await createEvaluationAction({
        cohortId, title, kind, split, total: split === "hand" ? sum : total, domainIds: chosen,
        perDomain: Object.fromEntries(selected.map((d, i) => [String(d.id), counts[i]])), timer: minutes, dueDay: due, remind, message, leadIds: people,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/admin/evaluations?id=${r.id}&ok=${encodeURIComponent(r.message)}`);
    });
  }

  const dueLabel = due ? new Date(`${due}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" }) : "…";
  const names = selected.length === domains.length ? "tous les domaines" : selected.map((d) => (d.n ? `D${d.n}` : d.label)).join(", ") || "aucun domaine";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
      <section className="grid gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="text-base font-bold">Composer</h2>
        <label className="grid gap-1 font-medium">Titre
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex. : Point d'étape : gouvernance et actifs" className={input} /></label>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 overflow-hidden rounded-xl border border-line">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`grid px-3 py-2 text-left ${kind === k ? "bg-accent-soft text-accent-ink" : "bg-white"}`}>
              <b>{KINDS[k]}</b><span className="text-xs text-muted">{k === "test" ? "corrigé question par question" : "chronométré, sans correction"}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 font-medium">Questions
            <input type="number" min={1} max={MAX_QUESTIONS} value={split === "hand" ? sum : total} disabled={split === "hand"} onChange={(e) => setTotal(Number(e.target.value) || 0)} className={`${input} disabled:bg-paper`} /></label>
          <label className="grid gap-1 font-medium">Répartition
            <select value={split} onChange={(e) => { const next = e.target.value as typeof split; if (next === "hand") setHand(Object.fromEntries(selected.map((d, i) => [d.id, counts[i]]))); setSplit(next); }} className={input}>
              <option value="weight">Selon le poids à l&apos;examen</option><option value="equal">À parts égales</option><option value="hand">À la main</option>
            </select></label>
          <label className="grid gap-1 font-medium">Durée (min)
            <input type="number" min={0} max={600} value={minutes} disabled={kind !== "exam"} onChange={(e) => setTimer(Number(e.target.value) || 0)} className={`${input} disabled:bg-paper`} /></label>
        </div>
        {kind === "exam" && timer === 0 && <p className="text-xs text-muted">Durée à 0 : ExamBoot la calcule d&apos;après le nombre de questions.</p>}
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 font-medium">Domaines</legend>
          {domains.map((d) => {
            const i = selected.findIndex((s) => s.id === d.id);
            const on = i >= 0;
            return (
              <label key={d.id} className={`grid grid-cols-[20px_34px_minmax(0,1fr)_64px] items-center gap-2 rounded-xl border px-2.5 py-1.5 ${on ? "border-accent bg-accent-soft" : "border-line"}`}>
                <input type="checkbox" checked={on} onChange={() => setChosen(toggle(chosen, d.id))} />
                <b>{d.n ? `D${d.n}` : "·"}</b>
                <span className="min-w-0">{d.label}<span className="block text-xs text-muted">{d.n ? `${d.weight} % de l'examen · ` : ""}{d.cap} questions dans la banque</span></span>
                <input type="number" min={0} max={d.cap} aria-label={`Questions ${d.label}`} disabled={!on || split !== "hand"} value={on ? counts[i] : ""} onChange={(e) => setHand({ ...hand, [d.id]: Number(e.target.value) || 0 })} className="rounded-lg border border-line px-2 py-1 text-right tabular-nums disabled:bg-paper disabled:text-muted" />
              </label>
            );
          })}
        </fieldset>
      </section>

      <section className="grid gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="text-base font-bold">Envoyer</h2>
        {cohorts.length === 0 ? <p className="text-muted">Aucune cohorte CISSP avec des inscrits payés.</p> : (
          <>
            <label className="grid gap-1 font-medium">Cohorte
              <select value={cohortId} onChange={(e) => pickCohort(Number(e.target.value))} className={input}>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.people.length})</option>)}</select></label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">Destinataires</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setPeople(cohort?.people.map((p) => p.id) ?? [])} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold">Toute la cohorte</button>
                <button type="button" onClick={() => setPeople([])} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold">Aucun</button>
              </span>
            </div>
            <div className="grid max-h-64 gap-1 overflow-auto rounded-xl border border-line p-2.5">
              {cohort?.people.map((p) => (
                <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={people.includes(p.id)} onChange={() => setPeople(toggle(people, p.id))} />{p.name}{p.note && <span className="text-xs text-muted">{p.note}</span>}</label>
              ))}
            </div>
          </>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-medium">À faire avant le
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} /></label>
          <label className="grid gap-1 font-medium">Relance
            <select value={remind ? "1" : "0"} onChange={(e) => setRemind(e.target.value === "1")} className={input}><option value="1">2 jours avant, aux retardataires</option><option value="0">Aucune</option></select></label>
        </div>
        <label className="grid gap-1 font-medium">Mot pour les inscrits (facultatif)
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1000} className={input} /></label>
        <p className="grid gap-1 rounded-xl bg-accent-soft p-3" aria-live="polite">
          <span><b>{KINDS[kind]}</b> de <b>{sum} question{sum > 1 ? "s" : ""}</b> sur {names}{minutes ? <>, <b>{minutes} min</b></> : kind === "exam" ? ", durée calculée par ExamBoot" : ", sans chrono"}.</span>
          <span>Envoyé à <b>{people.length} personne{people.length > 1 ? "s" : ""}</b>, à faire avant le {dueLabel}. Tout le monde reçoit les mêmes questions.</span>
          {sum > MAX_QUESTIONS && <span className="text-red-800">{MAX_QUESTIONS} questions au maximum.</span>}
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        <button type="button" disabled={pending || !people.length || !sum || sum > MAX_QUESTIONS || title.trim().length < 3} onClick={submit} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-50">
          {pending ? "Envoi en cours…" : `Envoyer à ${people.length} personne${people.length > 1 ? "s" : ""}`}
        </button>
      </section>
    </div>
  );
}
