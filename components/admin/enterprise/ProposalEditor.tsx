"use client";

import { Copy, Link2, Plus, Printer, Save, X } from "lucide-react";
import { useState, useTransition } from "react";

import { prepareDepositAction, saveProposalAction } from "@/app/admin/entreprises/actions";
import { type EnterpriseOffer, LEVELS, type Level, type Proposal, type Zone, ZONE_LABEL, formatUsd, priceOf, proposalTotals } from "@/lib/enterprise";

import { ProposalDocument } from "./ProposalDocument";

const field = "w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm";
const label = "grid gap-1 text-xs font-semibold";
const legend = "text-xs font-bold text-muted uppercase";

/**
 * The proposal editor (Ben, 22/11): edit on the left, the four A4 pages on
 * the right. « Enregistrer » numbers it (DEV-…), « Télécharger en PDF »
 * prints only the document, « Créer le lien d'acompte » fixes the deposit.
 */
export function ProposalEditor({ requestId, initial, offer, head, today, depositLink }: {
  requestId: number;
  initial: Proposal;
  offer: EnterpriseOffer;
  head: { number: string | null; organization: string };
  today: string;
  depositLink: string | null;
}) {
  const [p, setP] = useState<Proposal>({ ...initial, issuedOn: initial.issuedOn ?? today });
  const [number, setNumber] = useState(head.number);
  const [link, setLink] = useState(depositLink);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Proposal>(k: K, v: Proposal[K]) => { setP((prev) => ({ ...prev, [k]: v })); setDirty(true); };
  const totals = proposalTotals(p, offer);

  // A new zone resets the prices to the catalogue's for that zone.
  const setZone = (zone: Zone) => {
    setP((prev) => ({ ...prev, zone, lines: prev.lines.map((l) => ({ ...l, priceUsd: priceOf(offer.packages.find((x) => x.code === l.code)!, zone) })) }));
    setDirty(true);
  };
  const toggle = (code: Proposal["lines"][number]["code"], on: boolean) => {
    const pkg = offer.packages.find((x) => x.code === code)!;
    set("lines", on ? offer.packages.filter((x) => x.code === code || p.lines.some((l) => l.code === x.code)).map((x) => p.lines.find((l) => l.code === x.code) ?? { code: x.code, priceUsd: priceOf(pkg, p.zone) }) : p.lines.filter((l) => l.code !== code));
  };
  const price = (code: string, usd: number) => set("lines", p.lines.map((l) => (l.code === code ? { ...l, priceUsd: Math.max(0, Math.round(usd * 100)) } : l)));
  const goal = (i: number, k: "title" | "text", v: string) => set("goals", p.goals.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  const proc = (i: number, k: "name" | "before" | "after", v: string) => set("processes", p.processes.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  function save(then?: () => void) {
    start(async () => {
      const clean: Proposal = { ...p, heard: p.heard.map((h) => h.trim()).filter(Boolean), goals: p.goals.filter((g) => g.title.trim() && g.text.trim()), processes: p.processes.filter((r) => r.name.trim()) };
      const r = await saveProposalAction({ id: requestId, proposal: clean });
      if (!r.ok) return setNote({ ok: false, text: r.error });
      setNumber(r.number);
      setDirty(false);
      setNote({ ok: true, text: `Proposition enregistrée : ${r.number}.` });
      then?.();
    });
  }
  function deposit() {
    save(() => start(async () => {
      const r = await prepareDepositAction({ id: requestId });
      if (!r.ok) return setNote({ ok: false, text: r.error });
      setLink(r.url);
      setNote({ ok: true, text: `Lien d’acompte prêt (${r.amount}). Copiez-le dans votre e-mail avec le PDF.` });
    }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form onSubmit={(e) => e.preventDefault()} className="grid content-start gap-3 rounded-xl border border-line bg-white p-4 print:hidden xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>Numéro<input value={number ?? "à l’enregistrement"} readOnly className={field + " bg-slate-50"} /></label>
          <label className={label}>Date<input type="date" value={p.issuedOn} onChange={(e) => e.target.value && set("issuedOn", e.target.value)} className={field} /></label>
        </div>

        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className={legend}>Le client</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Contact<input value={p.contact} onChange={(e) => set("contact", e.target.value)} className={field} /></label>
            <label className={label}>Fonction<input value={p.role} onChange={(e) => set("role", e.target.value)} className={field} /></label>
          </div>
          <label className={label}>Zone de prix
            <select value={p.zone} onChange={(e) => setZone(e.target.value as Zone)} className={field}>{(Object.keys(ZONE_LABEL) as Zone[]).map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}</select>
          </label>
        </fieldset>

        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className={legend}>Ce qu’ils nous ont dit</legend>
          <label className={label}>Une phrase par ligne, avec leurs mots (5 au plus)
            <textarea rows={4} value={p.heard.join("\n")} onChange={(e) => set("heard", e.target.value.split("\n").slice(0, 5))} className={field} /></label>
        </fieldset>

        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className={legend}>Les objectifs (3 au plus)</legend>
          {p.goals.map((g, i) => (
            <div key={i} className="grid gap-1.5 rounded-lg bg-paper p-2">
              <div className="flex gap-1.5"><input value={g.title} maxLength={40} placeholder="Titre court (ex. : Zéro oubli)" onChange={(e) => goal(i, "title", e.target.value)} className={field + " font-semibold"} />
                {p.goals.length > 1 && <button type="button" aria-label="Retirer" onClick={() => set("goals", p.goals.filter((_, j) => j !== i))} className="px-1 text-muted"><X className="size-4" /></button>}</div>
              <input value={g.text} maxLength={200} placeholder="Le résultat mesurable" onChange={(e) => goal(i, "text", e.target.value)} className={field} />
            </div>
          ))}
          {p.goals.length < 3 && <button type="button" onClick={() => set("goals", [...p.goals, { title: "", text: "" }])} className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-accent"><Plus className="size-4" />Ajouter un objectif</button>}
        </fieldset>

        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className={legend}>Avant / après</legend>
          {p.processes.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1">
              <input value={r.name} maxLength={80} onChange={(e) => proc(i, "name", e.target.value)} className={field} />
              {(["before", "after"] as const).map((k) => <select key={k} aria-label={k === "before" ? "Aujourd’hui" : "Après"} value={r[k]} onChange={(e) => proc(i, k, e.target.value as Level)} className="rounded-lg border border-line bg-white px-1 py-1.5 text-xs">{(Object.keys(LEVELS) as Level[]).map((l) => <option key={l} value={l}>{LEVELS[l]}</option>)}</select>)}
              <button type="button" aria-label="Retirer" onClick={() => set("processes", p.processes.filter((_, j) => j !== i))} className="px-1 text-muted"><X className="size-4" /></button>
            </div>
          ))}
          {p.processes.length < 8 && <button type="button" onClick={() => set("processes", [...p.processes, { name: "", before: "manual", after: "assist" }])} className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-accent"><Plus className="size-4" />Ajouter un processus</button>}
        </fieldset>

        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className={legend}>Les marches proposées (USD)</legend>
          {offer.packages.map((k) => {
            const line = p.lines.find((l) => l.code === k.code);
            return (
              <div key={k.code} className="grid grid-cols-[auto_minmax(0,1fr)_96px] items-center gap-2 rounded-lg border border-line p-2">
                <input type="checkbox" checked={Boolean(line)} onChange={(e) => toggle(k.code, e.target.checked)} aria-label={k.name} />
                <span className="min-w-0"><b className="block text-sm">{k.name}</b><small className="text-muted">{k.duration}</small></span>
                <input type="number" min={0} step={100} disabled={!line} value={line ? line.priceUsd / 100 : priceOf(k, p.zone) / 100} onChange={(e) => price(k.code, Number(e.target.value) || 0)} aria-label={`Prix ${k.name}`} className={field + " text-right tabular-nums"} />
              </div>
            );
          })}
          <p className="text-sm">Total : <b className="tabular-nums">{formatUsd(totals.onceUsd)}{totals.monthlyUsd ? ` + ${formatUsd(totals.monthlyUsd)} / mois` : ""}</b> · acompte <b className="tabular-nums">{formatUsd(totals.depositUsd)}</b></p>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-2 border-t border-line pt-3"><legend className={legend}>Conditions</legend>
          <label className={label}>Validité (jours)<input type="number" min={7} max={90} value={p.validDays} onChange={(e) => set("validDays", Math.min(90, Math.max(7, Number(e.target.value) || 30)))} className={field} /></label>
          <label className={label}>Démarrage<input value={p.start} maxLength={60} placeholder="Ex. : 5 janvier 2027" onChange={(e) => set("start", e.target.value)} className={field} /></label>
        </fieldset>

        <div className="grid gap-2 border-t border-line pt-3">
          <button type="button" disabled={pending} onClick={() => save()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white"><Save className="size-4" aria-hidden />{number ? "Enregistrer" : "Enregistrer (donne le numéro DEV)"}</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"><Printer className="size-4" aria-hidden />Télécharger en PDF</button>
          <button type="button" disabled={pending} onClick={deposit} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold"><Link2 className="size-4" aria-hidden />Créer le lien d’acompte</button>
          <p className="text-xs text-muted">PDF : dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».{dirty && number ? " Modifications non enregistrées." : ""}</p>
          {note && <p className={`rounded-lg px-3 py-2 text-sm ${note.ok ? "bg-accent-soft text-accent-ink" : "bg-red-50 text-red-800"}`}>{note.text}</p>}
          {link && (
            <div className="flex items-center gap-2 rounded-lg bg-paper px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate font-mono">{link}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setNote({ ok: true, text: "Lien copié." }))} className="inline-flex items-center gap-1 font-semibold"><Copy className="size-3.5" aria-hidden />Copier</button>
            </div>
          )}
        </div>
      </form>
      <div className="min-w-0 rounded-xl bg-[#E7EBE8] p-4 print:bg-transparent print:p-0">
        <ProposalDocument p={p} offer={offer} head={{ number, organization: head.organization }} today={today} />
      </div>
    </div>
  );
}
